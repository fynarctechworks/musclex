import { Injectable, Logger, OnModuleInit, ForbiddenException } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import { getTenantSchema, getTenantGymId } from '../common/tenant-context';
import { createTenantExtension, TenantPrismaClient } from './tenant-prisma.extension';
import { createBranchScopeExtension } from './branch-scope.extension';
// Single source of truth for gym_id models — shared with the $extends tenant
// extension so the two layers can never drift (the drift previously leaked).
import { TENANT_MODELS as TENANT_MODELS_PRISMA } from './tenant-models';

const READ_ACTIONS = new Set([
  'findMany', 'findFirst', 'findFirstOrThrow', 'count', 'aggregate', 'groupBy',
]);
const WHERE_MUTATION_ACTIONS = new Set([
  'update', 'updateMany', 'delete', 'deleteMany',
]);
const WRITE_ACTIONS = new Set([
  'create', 'createMany', 'update', 'updateMany', 'delete', 'deleteMany', 'upsert',
]);

function injectGymIdInWhere(where: any, gymId: string): any {
  if (!where || typeof where !== 'object') return { gym_id: gymId };
  if (where.gym_id !== undefined) return where; // respect caller-provided filter
  return { ...where, gym_id: gymId };
}

/**
 * Does a write already carry its own explicit gym_id scoping? Such writes are
 * trusted even without ALS context — they're how onboarding, seeds, and system
 * jobs operate before/outside a request's tenant scope (e.g. creating the first
 * branch with an explicit gym_id).
 */
function writeCarriesExplicitGymId(action: string, args: any): boolean {
  if (!args) return false;
  switch (action) {
    case 'create':
      return !!args.data?.gym_id;
    case 'createMany':
      return Array.isArray(args.data)
        ? args.data.length > 0 && args.data.every((d: any) => d?.gym_id)
        : !!args.data?.gym_id;
    case 'upsert':
      return !!args.create?.gym_id && !!args.where?.gym_id;
    case 'update':
    case 'updateMany':
    case 'delete':
    case 'deleteMany':
      return !!args.where?.gym_id;
    default:
      return false;
  }
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);

  /**
   * Tenant-scoped Prisma client.
   * ALL service-layer code should use `prisma.tenant` instead of raw `prisma`.
   * This auto-injects gym_id on every query as defense-in-depth.
   */
  public readonly tenant: TenantPrismaClient;

  constructor() {
    super({
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    });

    // Create the tenant-scoped extension
    this.tenant = createTenantExtension(this);

    // Branch-scope observer — logs missing branch filters without modifying queries
    createBranchScopeExtension(this);

    // ────────────────────────────────────────────────────────────
    // NOTE: Prisma with multiSchema generates fully-qualified table
    // names ("studio_template"."table_name"), so SET search_path has
    // NO effect. Tenant isolation relies entirely on:
    //   Layer 2: gym_id column filter (tenant-prisma.extension.ts)
    //   Layer 3: RLS policies (app.gym_id session variable)
    //
    // The $use middleware below only sets app.gym_id for RLS.
    // ────────────────────────────────────────────────────────────
    this.$use(async (params, next) => {
      const gymId = getTenantGymId();

      if (params.model && gymId) {
        try {
          // Parameterized — set_config() is injection-safe; avoids $executeRawUnsafe.
          // Third arg `false` = session-scoped (not transaction-local).
          await this.$queryRaw`SELECT set_config('app.gym_id', ${gymId}, false)`;
        } catch (err) {
          this.logger.warn(
            `Failed to set app.gym_id="${gymId}": ${err instanceof Error ? err.message : err}`,
          );
        }
      }

      return next(params);
    });

    // ────────────────────────────────────────────────────────────
    // GLOBAL TENANT ISOLATION — Injects gym_id on every query against
    // tenant models. Services using raw `this.prisma.model.*` are now
    // safe by default; the extension client (this.tenant) is kept as
    // defense-in-depth for callers that opt in explicitly.
    // ────────────────────────────────────────────────────────────
    this.$use(async (params, next) => {
      if (!params.model || !TENANT_MODELS_PRISMA.has(params.model)) {
        return next(params);
      }

      const gymId = getTenantGymId();

      // ── No tenant context on a tenant model ──────────────────────────
      // Reads are left untouched: some context-less flows legitimately read
      // tenant models (e.g. RBAC resolution during login, which runs on the
      // /auth routes that are excluded from TenantMiddleware). But WRITES must
      // never touch tenant data without scoping — block them unless the payload
      // carries an explicit gym_id (onboarding, seeds, system jobs scope
      // manually). This turns the cryptic Prisma "Argument `gym_id` is missing"
      // into a clear, fail-fast error and prevents accidental unscoped writes.
      if (!gymId) {
        if (
          WRITE_ACTIONS.has(params.action) &&
          !writeCarriesExplicitGymId(params.action, params.args)
        ) {
          this.logger.error(
            `TENANT SAFETY: blocked ${params.action} on ${params.model} — no gym_id in ` +
              `context and none in the payload. A tenant-scoped write reached the DB with ` +
              `no authenticated studio (likely a stale/missing token or a missing guard).`,
          );
          throw new ForbiddenException(
            'Tenant context missing: this action could not be scoped to your studio. ' +
              'Please sign in again and retry.',
          );
        }
        return next(params);
      }

      const { action, args } = params;

      if (READ_ACTIONS.has(action)) {
        params.args = { ...args, where: injectGymIdInWhere(args?.where, gymId) };
        return next(params);
      }

      if (action === 'findUnique' || action === 'findUniqueOrThrow') {
        // findUnique/ByUniqueInput can't accept gym_id in where; post-check the result.
        const result = await next(params);
        if (result && (result as any).gym_id && (result as any).gym_id !== gymId) {
          this.logger.error(
            `TENANT VIOLATION: ${params.model}.${action} returned cross-tenant record`,
          );
          if (action === 'findUniqueOrThrow') {
            throw new Error('Record not found');
          }
          return null;
        }
        return result;
      }

      if (WHERE_MUTATION_ACTIONS.has(action)) {
        params.args = { ...args, where: injectGymIdInWhere(args?.where, gymId) };
        return next(params);
      }

      if (action === 'create') {
        const data = args?.data;
        if (data && typeof data === 'object' && !Array.isArray(data) && !(data as any).gym_id) {
          params.args = { ...args, data: { ...(data as any), gym_id: gymId } };
        }
        return next(params);
      }

      if (action === 'createMany') {
        const data = args?.data;
        if (Array.isArray(data)) {
          params.args = {
            ...args,
            data: data.map((d: any) =>
              d && typeof d === 'object' && !d.gym_id ? { ...d, gym_id: gymId } : d,
            ),
          };
        } else if (data && typeof data === 'object' && !(data as any).gym_id) {
          params.args = { ...args, data: { ...(data as any), gym_id: gymId } };
        }
        return next(params);
      }

      if (action === 'upsert') {
        const newArgs: any = { ...args };
        newArgs.where = injectGymIdInWhere(args?.where, gymId);
        if (args?.create && typeof args.create === 'object' && !(args.create as any).gym_id) {
          newArgs.create = { ...args.create, gym_id: gymId };
        }
        params.args = newArgs;
        return next(params);
      }

      return next(params);
    });
  }

  async onModuleInit() {
    try {
      const connectPromise = this.$connect();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Connection timeout after 10s')), 10000),
      );
      await Promise.race([connectPromise, timeoutPromise]);
      this.logger.log('Database connected successfully');
    } catch (error) {
      this.logger.warn(
        `Database connection failed: ${error.message}. API will start but DB queries will fail.`,
      );
    }
  }

  /**
   * PHASE B (keystone) — run a unit of tenant work with a TRANSACTION-LOCAL
   * `app.gym_id`. This is the propagation fix that must ship WITH the cutover to
   * the non-BYPASSRLS role (see docs/RLS-PHASE-B-CUTOVER-RUNBOOK-2026-06-03.md §3):
   *
   *   - `set_config(..., true)` is transaction-local: it is bound to THIS
   *     transaction's connection and auto-resets at COMMIT/ROLLBACK, so it can
   *     never bleed onto the next request that reuses a pooled connection (the
   *     session-scoped `$use` set is the racy hole the cutover closes).
   *   - Raw queries (`tx.$queryRaw` / `tx.$executeRaw`) issued inside `work`
   *     inherit the same local GUC, so the ~21 raw-SQL tenant sites become
   *     correctly scoped under RLS without each re-setting it.
   *
   * Behavior-neutral TODAY: while the app still connects as a BYPASSRLS role the
   * GUC is unused, so this is safe to land ahead of the maintenance window. It is
   * intentionally NOT wired into request handling yet — the cutover task routes
   * tenant request handlers through it and then repoints DATABASE_URL.
   *
   * SECURITY: `gymId` MUST originate from a verified token claim, never from
   * client-supplied body/query/header input.
   */
  async forTenant<T>(
    gymId: string,
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    if (!gymId) {
      throw new ForbiddenException(
        'forTenant requires a gym_id: this work could not be scoped to a studio.',
      );
    }
    return this.$transaction(async (tx) => {
      // Parameterized set_config — injection-safe; third arg `true` = tx-local.
      await tx.$queryRaw`SELECT set_config('app.gym_id', ${gymId}, true)`;
      return work(tx);
    });
  }

  /**
   * Verify that the current connection's search_path matches the expected tenant.
   * Use in critical operations (payments, PII access) as defense-in-depth.
   */
  async verifyTenantContext(expectedStudioId: string): Promise<boolean> {
    const result = await this.$queryRaw<Array<{ current_setting: string }>>`
      SELECT current_setting('search_path') as current_setting
    `;
    const currentPath = result?.[0]?.current_setting || '';
    const expectedSchema = `studio_${expectedStudioId.replace(/-/g, '_')}`;
    return currentPath.includes(expectedSchema);
  }

  /**
   * Verify BOTH search_path AND app.gym_id match for critical operations.
   * Call this before payments, PII exports, or data deletions.
   */
  async verifyFullTenantIsolation(expectedStudioId: string): Promise<boolean> {
    const result = await this.$queryRaw<
      Array<{ search_path: string; gym_id: string }>
    >`
      SELECT
        current_setting('search_path') as search_path,
        current_setting('app.gym_id', true) as gym_id
    `;
    const row = result?.[0];
    if (!row) return false;

    const expectedSchema = `studio_${expectedStudioId.replace(/-/g, '_')}`;
    const pathOk = row.search_path.includes(expectedSchema);
    const gymOk = row.gym_id === expectedStudioId;

    if (!pathOk || !gymOk) {
      this.logger.error(
        `TENANT ISOLATION FAILURE: expected studio=${expectedStudioId}, ` +
        `got search_path="${row.search_path}", app.gym_id="${row.gym_id}"`,
      );
    }

    return pathOk && gymOk;
  }
}
