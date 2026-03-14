import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MeiliSearch, Index } from 'meilisearch';
import { PrismaService } from '../prisma/prisma.service';

export interface SearchResult {
  entity: string;
  id: string;
  title: string;
  subtitle?: string;
  metadata?: Record<string, unknown>;
}

export interface GlobalSearchResponse {
  query: string;
  results: SearchResult[];
  totalHits: number;
  processingTimeMs: number;
}

const SEARCH_INDEXES = {
  MEMBERS: 'members',
  STAFF: 'staff',
  LEADS: 'leads',
  PAYMENTS: 'payments',
  CLASSES: 'classes',
} as const;

@Injectable()
export class SearchService implements OnModuleInit {
  private readonly logger = new Logger(SearchService.name);
  private client: MeiliSearch | null = null;
  private initialized = false;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {}

  async onModuleInit() {
    const enableSearch = this.config.get<string>('ENABLE_SEARCH');
    if (enableSearch === 'false') {
      this.logger.warn('ENABLE_SEARCH=false — search will always use Prisma fallback');
      return;
    }

    const host = this.config.get<string>('MEILISEARCH_HOST');
    const apiKey = this.config.get<string>('MEILISEARCH_API_KEY');

    if (!host) {
      this.logger.warn('MEILISEARCH_HOST not configured — search will use Prisma fallback');
      return;
    }

    try {
      this.client = new MeiliSearch({ host, apiKey });
      await this.client.health();
      await this.configureIndexes();
      this.initialized = true;
      this.logger.log('Meilisearch connected and indexes configured');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Meilisearch connection failed — using Prisma fallback: ${message}`);
      this.client = null;
    }
  }

  private async configureIndexes(): Promise<void> {
    if (!this.client) return;

    const indexConfigs = [
      {
        uid: SEARCH_INDEXES.MEMBERS,
        primaryKey: 'id',
        searchableAttributes: ['full_name', 'email', 'phone', 'member_code'],
        filterableAttributes: ['branch_id', 'status'],
        sortableAttributes: ['created_at', 'full_name'],
      },
      {
        uid: SEARCH_INDEXES.STAFF,
        primaryKey: 'id',
        searchableAttributes: ['full_name', 'email', 'phone', 'employee_code'],
        filterableAttributes: ['branch_id', 'role', 'status'],
        sortableAttributes: ['created_at', 'full_name'],
      },
      {
        uid: SEARCH_INDEXES.LEADS,
        primaryKey: 'id',
        searchableAttributes: ['full_name', 'email', 'phone', 'notes'],
        filterableAttributes: ['status', 'lead_source', 'assigned_staff_id'],
        sortableAttributes: ['created_at', 'full_name'],
      },
      {
        uid: SEARCH_INDEXES.PAYMENTS,
        primaryKey: 'id',
        searchableAttributes: ['receipt_number', 'notes'],
        filterableAttributes: ['member_id', 'branch_id', 'payment_method', 'status'],
        sortableAttributes: ['payment_date', 'amount'],
      },
      {
        uid: SEARCH_INDEXES.CLASSES,
        primaryKey: 'id',
        searchableAttributes: ['name', 'description', 'class_type'],
        filterableAttributes: ['branch_id', 'status', 'trainer_id'],
        sortableAttributes: ['created_at', 'name'],
      },
    ];

    for (const { uid, primaryKey, ...settings } of indexConfigs) {
      try {
        await this.client!.createIndex(uid, { primaryKey });
        const index = this.client!.index(uid);
        await index.updateSettings({
          searchableAttributes: settings.searchableAttributes,
          filterableAttributes: settings.filterableAttributes,
          sortableAttributes: settings.sortableAttributes,
        });
      } catch {
        // Index may already exist — that's OK
      }
    }
  }

  // ─── Global Cross-Entity Search ────────────────────────────

  async globalSearch(query: string, options?: {
    entities?: string[];
    limit?: number;
    branchId?: string;
  }): Promise<GlobalSearchResponse> {
    const startTime = Date.now();
    const entities = options?.entities || Object.values(SEARCH_INDEXES);
    const limit = options?.limit || 20;

    if (this.client && this.initialized) {
      return this.searchMeilisearch(query, entities, limit, options?.branchId, startTime);
    }

    return this.searchPrismaFallback(query, entities, limit, options?.branchId, startTime);
  }

  private async searchMeilisearch(
    query: string,
    entities: string[],
    limit: number,
    branchId: string | undefined,
    startTime: number,
  ): Promise<GlobalSearchResponse> {
    const filter = branchId ? `branch_id = "${branchId}"` : undefined;
    const perEntityLimit = Math.ceil(limit / entities.length);

    const queries = entities.map((entity) => ({
      indexUid: entity,
      q: query,
      limit: perEntityLimit,
      filter,
    }));

    const response = await this.client!.multiSearch({ queries });
    const results: SearchResult[] = [];
    let totalHits = 0;

    for (const searchResult of response.results) {
      totalHits += searchResult.estimatedTotalHits || 0;
      for (const hit of searchResult.hits) {
        results.push(this.mapHitToResult(searchResult.indexUid, hit));
      }
    }

    return {
      query,
      results: results.slice(0, limit),
      totalHits,
      processingTimeMs: Date.now() - startTime,
    };
  }

  private async searchPrismaFallback(
    query: string,
    entities: string[],
    limit: number,
    branchId: string | undefined,
    startTime: number,
  ): Promise<GlobalSearchResponse> {
    const results: SearchResult[] = [];
    const perEntityLimit = Math.ceil(limit / entities.length);
    const branchFilter = branchId ? { branch_id: branchId } : {};

    if (entities.includes(SEARCH_INDEXES.MEMBERS)) {
      const members = await this.prisma.member.findMany({
        where: {
          ...branchFilter,
          OR: [
            { full_name: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
            { phone: { contains: query, mode: 'insensitive' } },
          ],
        },
        take: perEntityLimit,
        select: { id: true, full_name: true, email: true, status: true },
      });
      members.forEach((m) =>
        results.push({
          entity: 'member',
          id: m.id,
          title: m.full_name,
          subtitle: m.email ?? undefined,
          metadata: { status: m.status },
        }),
      );
    }

    if (entities.includes(SEARCH_INDEXES.STAFF)) {
      const staff = await this.prisma.staff.findMany({
        where: {
          ...branchFilter,
          OR: [
            { full_name: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
          ],
        },
        take: perEntityLimit,
        select: { id: true, full_name: true, email: true, role: true },
      });
      staff.forEach((s) =>
        results.push({
          entity: 'staff',
          id: s.id,
          title: s.full_name,
          subtitle: s.role ?? undefined,
        }),
      );
    }

    if (entities.includes(SEARCH_INDEXES.LEADS)) {
      const leads = await this.prisma.lead.findMany({
        where: {
          OR: [
            { full_name: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
            { phone: { contains: query, mode: 'insensitive' } },
          ],
        },
        take: perEntityLimit,
        select: { id: true, full_name: true, email: true, status: true },
      });
      leads.forEach((l) =>
        results.push({
          entity: 'lead',
          id: l.id,
          title: l.full_name,
          subtitle: l.email ?? undefined,
          metadata: { status: l.status },
        }),
      );
    }

    return {
      query,
      results: results.slice(0, limit),
      totalHits: results.length,
      processingTimeMs: Date.now() - startTime,
    };
  }

  private mapHitToResult(entity: string, hit: Record<string, any>): SearchResult {
    switch (entity) {
      case SEARCH_INDEXES.MEMBERS:
        return {
          entity: 'member',
          id: hit.id,
          title: hit.full_name || '',
          subtitle: hit.email,
          metadata: { status: hit.status },
        };
      case SEARCH_INDEXES.STAFF:
        return {
          entity: 'staff',
          id: hit.id,
          title: hit.full_name || '',
          subtitle: hit.role,
        };
      case SEARCH_INDEXES.LEADS:
        return {
          entity: 'lead',
          id: hit.id,
          title: hit.full_name || '',
          subtitle: hit.email,
          metadata: { status: hit.status },
        };
      default:
        return {
          entity,
          id: hit.id,
          title: hit.name || hit.title || hit.id,
        };
    }
  }

  // ─── Index Sync Methods (call from services on write) ──────

  async indexDocument(indexName: string, document: Record<string, unknown>): Promise<void> {
    if (!this.client || !this.initialized) return;
    try {
      await this.client.index(indexName).addDocuments([document]);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Failed to index document in ${indexName}: ${message}`);
    }
  }

  async removeDocument(indexName: string, documentId: string): Promise<void> {
    if (!this.client || !this.initialized) return;
    try {
      await this.client.index(indexName).deleteDocument(documentId);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Failed to remove document from ${indexName}: ${message}`);
    }
  }

  async reindexAll(indexName: string): Promise<{ indexed: number }> {
    if (!this.client) throw new Error('Meilisearch not configured');

    const index = this.client.index(indexName);
    let indexed = 0;

    switch (indexName) {
      case SEARCH_INDEXES.MEMBERS: {
        const members = await this.prisma.member.findMany({
          select: {
            id: true, full_name: true,
            email: true, phone: true, status: true,
            branch_id: true, member_code: true, created_at: true,
          },
        });
        await index.addDocuments(members);
        indexed = members.length;
        break;
      }
      case SEARCH_INDEXES.STAFF: {
        const staff = await this.prisma.staff.findMany({
          select: {
            id: true, full_name: true,
            email: true, phone: true, role: true,
            branch_id: true, status: true, created_at: true,
          },
        });
        await index.addDocuments(staff);
        indexed = staff.length;
        break;
      }
      case SEARCH_INDEXES.LEADS: {
        const leads = await this.prisma.lead.findMany({
          select: {
            id: true, full_name: true, email: true, phone: true,
            status: true, lead_source: true, created_at: true,
          },
        });
        await index.addDocuments(leads);
        indexed = leads.length;
        break;
      }
    }

    return { indexed };
  }
}
