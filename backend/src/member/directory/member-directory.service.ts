import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

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

  constructor(private readonly prisma: PrismaService) {}

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

    await this.prisma.memberDirectory.upsert({
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
   */
  async resolveByPhone(
    phone: string,
  ): Promise<Array<{ tenantId: string; memberId: string }>> {
    const normalized = this.normalizePhone(phone);
    if (!normalized) return [];
    const rows = await this.prisma.memberDirectory.findMany({
      where: { phone: normalized, status: 'active' },
      select: { tenant_id: true, member_id: true },
    });
    return rows.map((r) => ({ tenantId: r.tenant_id, memberId: r.member_id }));
  }

  /**
   * Reconcile the directory from existing members across all tenants.
   * Idempotent (upserts). Returns the number of rows reconciled. Safe to run
   * repeatedly; intended as a one-off backfill and a periodic safety net.
   *
   * Reads members via raw SQL joined to studios (cross-tenant by design — this
   * is the one maintenance path allowed to span gyms), so it bypasses the
   * gym_id-scoped client intentionally.
   */
  async backfill(): Promise<number> {
    const members = await this.prisma.$queryRaw<
      Array<{ member_id: string; tenant_id: string; phone: string; status: string }>
    >`
      SELECT m.id AS member_id, m.gym_id AS tenant_id, m.phone, m.status
      FROM studio_template.members m
      INNER JOIN public.studios s ON s.id = m.gym_id
      WHERE m.phone IS NOT NULL AND m.phone <> ''
    `;

    let reconciled = 0;
    for (const m of members) {
      try {
        await this.syncMember({
          memberId: m.member_id,
          tenantId: m.tenant_id,
          phone: m.phone,
          status: m.status,
        });
        reconciled++;
      } catch (err) {
        this.logger.error(
          `Backfill failed for member ${m.member_id}: ${(err as Error).message}`,
        );
      }
    }
    this.logger.log(`member_directory backfill reconciled ${reconciled} member(s)`);
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
