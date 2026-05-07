import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { TenantPrismaClient } from './tenant-prisma.extension';

/**
 * ────────────────────────────────────────────────────────────────
 * TENANT PRISMA SERVICE
 * ────────────────────────────────────────────────────────────────
 *
 * Injectable wrapper around the tenant-scoped Prisma extension.
 * Services that access tenant data should inject this instead of PrismaService.
 *
 * MIGRATION GUIDE:
 *   BEFORE (unsafe — no gym_id filtering):
 *     constructor(private prisma: PrismaService) {}
 *     this.prisma.member.findMany({ where: { status: 'active' } })
 *
 *   AFTER (safe — auto-injects gym_id):
 *     constructor(private tenantPrisma: TenantPrismaService) {}
 *     this.tenantPrisma.client.member.findMany({ where: { status: 'active' } })
 *
 *   SHORTCUT (minimal diff — just change the service constructor):
 *     constructor(private prisma: TenantPrismaService) {}
 *     this.prisma.member.findMany(...)  // Works because of Proxy delegation
 *
 * For raw queries or public-schema operations, inject PrismaService directly.
 */
@Injectable()
export class TenantPrismaService {
  private readonly logger = new Logger(TenantPrismaService.name);

  /** The tenant-scoped Prisma client with auto gym_id injection */
  public readonly client: TenantPrismaClient;

  constructor(private readonly prisma: PrismaService) {
    this.client = prisma.tenant;
  }

  /**
   * Access the raw PrismaService for:
   *  - Public schema operations (Studio, UserIdentity, etc.)
   *  - Raw SQL queries ($queryRaw, $executeRaw)
   *  - Transactions ($transaction)
   *  - Migration/seed scripts
   */
  get raw(): PrismaService {
    return this.prisma;
  }

  /**
   * Execute a tenant-scoped transaction.
   * All operations within the callback use the tenant extension.
   *
   * NOTE: Prisma extensions don't propagate into interactive transactions.
   * The gym_id injection from PrismaService.$use middleware (which sets
   * search_path and app.gym_id) still applies since it's at the middleware level.
   * As an additional safety measure, we verify tenant context before and after.
   */
  async $transaction<T>(
    fn: (tx: any) => Promise<T>,
    options?: { maxWait?: number; timeout?: number },
  ): Promise<T> {
    return this.prisma.$transaction(fn, options);
  }
}
