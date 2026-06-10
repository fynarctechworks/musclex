/**
 * SAFETY NET — SEARCH TENANT ISOLATION (audit finding C1)
 *
 * Proves that Meilisearch global search is scoped by gym_id from the
 * trusted tenant context, never just by a client-supplied branch_id.
 * Without this guard, gym A could see gym B's members/staff/leads via
 * the shared Meilisearch indexes.
 *
 * The test injects a fake Meilisearch client into SearchService and
 * captures the `multiSearch({queries})` payload to assert that every
 * per-index query carries a `gym_id = "<owning-gym>"` clause.
 */

import { ConfigService } from '@nestjs/config';
import { SearchService } from '../../src/search/search.service';
import { tenantContext } from '../../src/common/tenant-context';

describe('SAFETY-NET / SearchService tenant isolation (C1)', () => {
  function buildService() {
    const config = {
      get: (key: string) => {
        if (key === 'ENABLE_SEARCH') return 'true';
        if (key === 'MEILISEARCH_HOST') return 'http://test';
        return undefined;
      },
    } as unknown as ConfigService;

    const prisma: any = {
      member: { findMany: jest.fn().mockResolvedValue([]) },
      staff: { findMany: jest.fn().mockResolvedValue([]) },
      lead: { findMany: jest.fn().mockResolvedValue([]) },
    };

    const service = new SearchService(config, prisma);

    // Capture the queries Meilisearch is asked to run.
    const captured: { queries: any[] } = { queries: [] };
    const fakeClient = {
      createIndex: jest.fn().mockResolvedValue(undefined),
      multiSearch: jest.fn(async ({ queries }: any) => {
        captured.queries = queries;
        return {
          results: queries.map((q: any) => ({
            indexUid: q.indexUid,
            hits: [],
            estimatedTotalHits: 0,
          })),
        };
      }),
      index: jest.fn(() => ({
        addDocuments: jest.fn().mockResolvedValue(undefined),
        deleteDocument: jest.fn().mockResolvedValue(undefined),
        updateSettings: jest.fn().mockResolvedValue(undefined),
      })),
    };

    // Bypass onModuleInit and inject the fake client directly.
    (service as any).client = fakeClient;
    (service as any).initialized = true;

    return { service, captured, fakeClient, prisma };
  }

  function runAsGym<T>(gymId: string, fn: () => Promise<T>): Promise<T> {
    return tenantContext.run(
      {
        schemaName: `studio_${gymId.replace(/-/g, '_')}`,
        gymId,
        activeBranchId: null,
        allowedBranchIds: 'ALL',
        bypassBranchScope: false,
      },
      fn,
    );
  }

  it('applies a gym_id filter to every Meilisearch query from the tenant context', async () => {
    const { service, captured } = buildService();
    const GYM_A = '11111111-1111-1111-1111-111111111111';

    await runAsGym(GYM_A, () =>
      service.globalSearch('priya', { entities: ['members', 'staff', 'leads'] }),
    );

    expect(captured.queries.length).toBe(3);
    for (const q of captured.queries) {
      // The filter Meilisearch receives must include the tenant's gym_id.
      // Anything else (undefined / branch_id-only) means a cross-gym leak.
      expect(q.filter).toBeDefined();
      expect(String(q.filter)).toContain(`gym_id = "${GYM_A}"`);
    }
  });

  it('combines gym_id (from context) with branch_id (from caller) when both are present', async () => {
    const { service, captured } = buildService();
    const GYM_A = '11111111-1111-1111-1111-111111111111';
    const BRANCH = '22222222-2222-2222-2222-222222222222';

    await runAsGym(GYM_A, () =>
      service.globalSearch('priya', {
        entities: ['members'],
        branchId: BRANCH,
      }),
    );

    const q = captured.queries[0];
    expect(String(q.filter)).toContain(`gym_id = "${GYM_A}"`);
    expect(String(q.filter)).toContain(`branch_id = "${BRANCH}"`);
  });

  it('refuses to query Meilisearch when no tenant context is present (fail-closed)', async () => {
    const { service, fakeClient } = buildService();

    // No tenantContext.run wrap → getTenantGymId() returns undefined.
    await expect(
      service.globalSearch('priya', { entities: ['members'] }),
    ).rejects.toThrow(/tenant|gym/i);

    expect(fakeClient.multiSearch).not.toHaveBeenCalled();
  });

  it('declares gym_id as a filterable attribute on every index settings update', async () => {
    const { service, fakeClient } = buildService();

    // Call the private configureIndexes via the OnModuleInit-equivalent path.
    await (service as any).configureIndexes();

    // updateSettings was called once per index; collect the filterableAttributes args.
    const settingsCalls: any[] = [];
    for (const indexCall of (fakeClient.index as jest.Mock).mock.results) {
      const idx = indexCall.value;
      for (const call of (idx.updateSettings as jest.Mock).mock.calls) {
        settingsCalls.push(call[0]);
      }
    }

    expect(settingsCalls.length).toBeGreaterThan(0);
    for (const settings of settingsCalls) {
      expect(settings.filterableAttributes).toContain('gym_id');
    }
  });

  it('reindexAll selects gym_id and pushes it on every document', async () => {
    const { service, prisma, fakeClient } = buildService();

    prisma.member.findMany.mockResolvedValue([
      {
        id: 'm1',
        full_name: 'Priya',
        email: 'p@example.com',
        phone: null,
        status: 'active',
        branch_id: 'b1',
        member_code: 'C1',
        created_at: new Date(),
        gym_id: 'gym-A',
      },
    ]);

    await service.reindexAll('members');

    // The Prisma select must have asked for gym_id.
    const selectArg = prisma.member.findMany.mock.calls[0][0];
    expect(selectArg.select).toBeDefined();
    expect(selectArg.select.gym_id).toBe(true);

    // The docs handed to Meilisearch must carry gym_id.
    const indexHandle = (fakeClient.index as jest.Mock).mock.results[0].value;
    const docs = (indexHandle.addDocuments as jest.Mock).mock.calls[0][0];
    expect(docs[0].gym_id).toBe('gym-A');
  });
});
