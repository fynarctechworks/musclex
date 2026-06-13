import { Injectable, Logger } from '@nestjs/common';
import { PublicPrismaService } from '../../prisma/public-prisma.service';
import { TenantPrisma } from '../../prisma/tenant-prisma.accessor';
import { TenantTaskRunner } from '../../prisma/tenant-task-runner';

/**
 * ────────────────────────────────────────────────────────────────
 * MEMBER DIRECTORY SERVICE
 * ────────────────────────────────────────────────────────────────
 *
 * Owns public.member_directory — the only cross-tenant table the member auth
 * path reads. It maps a phone (E.164) to (tenant_id = Studio UUID, member_id)
 * so the BFF can resolve a member's gym(s) from a phone before any tenant
 * context exists.
 *
 * Population: the admin member-creation flow calls syncMember() post-commit
 * (fire-and-forget, mirroring the dashboard projection). backfill() reconciles
 * the table from existing members and is the safety net if a sync was missed.
 *
 * This service uses the RAW PrismaService (public schema). member_directory is
 * NOT a tenant model, so gym_id is never auto-injected — resolveByPhone()
 * deliberately reads across tenants by phone, which is the whole point.
 */
@Injectable()
export class MemberDirectoryService {
  private readonly logger = new Logger(MemberDirectoryService.name);

  constructor(
    private readonly pub: PublicPrismaService, // registry: public.member_directory
    private readonly tenant: TenantPrisma, // per-gym member reads inside forEachTenant
    private readonly tasks: TenantTaskRunner, // backfill fans out per gym
  ) {}

  /**
   * Upsert a single directory entry. Keyed on (tenant_id, member_id) so repeated
   * syncs (create, later status/phone changes) are idempotent.
   */
  async syncMember(entry: {
    memberId: string;
    tenantId: string; // Studio UUID (== gym_id)
    phone: string;
    status?: string; // member.status; mapped to active|inactive
  }): Promise<void> {
    const phone = this.normalizePhone(entry.phone);
    if (!phone) {
      this.logger.warn(
        `Skipping directory sync for member ${entry.memberId}: empty/invalid phone`,
      );
      return;
    }
    const status = this.toDirectoryStatus(entry.status);

    await this.pub.memberDirectory.upsert({
      where: {
        tenant_id_member_id: {
          tenant_id: entry.tenantId,
          member_id: entry.memberId,
        },
      },
      create: {
        phone,
        tenant_id: entry.tenantId,
        member_id: entry.memberId,
        status,
      },
      update: { phone, status },
    });
  }

  /**
   * Resolve all gyms a phone is a member of (active entries only).
   * Used by the auth path (/auth/otp/request, /auth/session).
   *
   * Directory phones were entered inconsistently (with/without the +91 country
   * code, with a leading STD 0), while the login phone always arrives E.164
   * (Supabase, or the app prepending +91). So we compare on a canonical national
   * key, not raw digits: a coarse DB filter on the last 10 digits, then an exact
   * national-key match in code. This only ever returns entries for the SAME human
   * number the caller proved ownership of — no cross-number widening.
   */
  async resolveByPhone(
    phone: string,
  ): Promise<Array<{ tenantId: string; memberId: string }>> {
    const normalized = this.normalizePhone(phone);
    if (!normalized) return [];
    const key = this.nationalKey(normalized);
    const rows = await this.pub.memberDirectory.findMany({
      where: { phone: { endsWith: key.slice(-10) }, status: 'active' },
      select: { tenant_id: true, member_id: true, phone: true },
    });
    return rows
      .filter((r) => {
        const rk = this.normalizePhone(r.phone);
        return rk !== null && this.nationalKey(rk) === key;
      })
      .map((r) => ({ tenantId: r.tenant_id, memberId: r.member_id }));
  }

  /**
   * Collapse a digits-only phone to a country-agnostic national key so that
   * "+917386648648", "917386648648", "07386648648" and "7386648648" all match.
   * India-first: strips leading zeros and a leading 91 country code. (Pure
   * country-code disambiguation across regions is out of scope — the app is
   * India-only today; documented in normalizePhone.)
   */
  private nationalKey(digits: string): string {
    let d = digits.replace(/^0+/, '');
    if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
    return d;
  }

  /**
   * Reconcile the directory from existing members across all tenants.
   * Idempotent (upserts). Returns the number of rows reconciled. Safe to run
   * repeatedly; intended as a one-off backfill and a periodic safety net.
   *
   * Road B: instead of one cross-tenant raw scan of studio_template, fan out
   * per gym via forEachTenant — each gym's members are read from its own schema
   * (this.tenant.client, schema-dynamic) and upserted into the public directory
   * via syncMember (pub). No request context, so this MUST run inside
   * forEachTenant (never touch this.tenant.client at the top level).
   */
  async backfill(): Promise<number> {
    let reconciled = 0;
    const summary = await this.tasks.forEachTenant(async ({ gymId }) => {
      const members = await this.tenant.client.member.findMany({
        where: { phone: { not: '' } },
        select: { id: true, phone: true, status: true },
      });
      for (const m of members) {
        if (!m.phone) continue;
        try {
          await this.syncMember({
            memberId: m.id,
            tenantId: gymId,
            phone: m.phone,
            status: m.status,
          });
          reconciled++;
        } catch (err) {
          this.logger.error(
            `Backfill failed for member ${m.id} (gym ${gymId}): ${(err as Error).message}`,
          );
        }
      }
    });
    this.logger.log(
      `member_directory backfill reconciled ${reconciled} member(s) across ${summary.ok}/${summary.total} gyms`,
    );
    return reconciled;
  }

  /** Member statuses that count as a usable login. Everything else → inactive. */
  private toDirectoryStatus(memberStatus?: string): string {
    const active = new Set([
      'active',
      'trial',
      'expiring_soon',
      'frozen',
      'expired',
    ]);
    return memberStatus && active.has(memberStatus) ? 'active' : 'inactive';
  }

  /**
   * Normalize to digits-only (no leading +). Both the admin-entered member phone
   * and the Supabase user phone pass through this, so "+919876543210" and
   * "919876543210" resolve to the same key. (Country-code vs local-number
   * mismatches are a data-quality concern flagged separately, not solved here.)
   */
  normalizePhone(phone?: string | null): string | null {
    if (!phone) return null;
    const digits = phone.replace(/[^\d]/g, '');
    return digits || null;
  }
}
