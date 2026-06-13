import { Injectable, Logger } from '@nestjs/common';
import { PublicPrismaService } from './public-prisma.service';
import { tenantContext } from '../common/tenant-context';

/**
 * ────────────────────────────────────────────────────────────────────────────
 * TENANT TASK RUNNER — per-gym execution for background jobs (Road B)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Crons and other background jobs have NO HTTP request, so nothing sets the
 * tenant context that `TenantPrisma` (and the per-gym client) require. Under the
 * old shared-schema model a context-less query simply read all gyms' rows out of
 * `studio_template`; under per-gym physical schemas that is impossible — a tenant
 * client MUST be bound to one gym's schema.
 *
 * `forEachTenant` is the bridge: it lists every registered studio and runs the
 * job once per studio, inside that studio's tenant context. The schema is taken
 * from the REGISTRY (`studios.schema_name`) — never derived from `gym_id`, since
 * `schema_name = studio_<owner_user_id>` ≠ `studio_<gym_id>`.
 *
 * Per-gym failures are isolated and logged so one bad gym can't abort the sweep.
 */
const TENANT_SCHEMA_RE = /^studio_[0-9a-f_]+$/i;

@Injectable()
export class TenantTaskRunner {
  private readonly logger = new Logger(TenantTaskRunner.name);

  constructor(private readonly pub: PublicPrismaService) {}

  /**
   * Run `fn` once per registered studio, each inside its own tenant context
   * (so `this.tenant.client.*` inside `fn` is bound to that gym's schema).
   * Returns a small summary; never throws for a single-gym failure.
   */
  async forEachTenant(
    fn: (ctx: { gymId: string; schemaName: string }) => Promise<void>,
  ): Promise<{ total: number; ok: number; failed: number }> {
    const studios = await this.pub.studio.findMany({
      select: { id: true, schema_name: true },
    });

    let ok = 0;
    let failed = 0;
    for (const s of studios) {
      if (!TENANT_SCHEMA_RE.test(s.schema_name)) {
        this.logger.warn(`forEachTenant: skipping gym ${s.id} — invalid schema_name "${s.schema_name}"`);
        failed++;
        continue;
      }
      try {
        await tenantContext.run(
          {
            schemaName: s.schema_name,
            gymId: s.id,
            activeBranchId: null,
            allowedBranchIds: 'ALL',
            bypassBranchScope: true,
          },
          () => fn({ gymId: s.id, schemaName: s.schema_name }),
        );
        ok++;
      } catch (e) {
        this.logger.error(`forEachTenant: gym ${s.id} failed: ${(e as Error).message}`);
        failed++;
      }
    }

    return { total: studios.length, ok, failed };
  }
}
