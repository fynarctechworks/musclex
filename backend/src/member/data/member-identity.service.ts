import { Injectable, Logger } from '@nestjs/common';
import * as QRCode from 'qrcode';
import { TenantPrisma } from '../../prisma/tenant-prisma.accessor';
import { QrTokenService } from '../../check-ins/qr/qr-token.service';
import { MemberException } from '../common/member-exception';
import { CurrentMemberContext } from '../decorators/current-member.decorator';

/**
 * Member digital ID + visit history.
 *
 * Reuses the admin `QrTokenService` so the token a member displays is byte-
 * identical to the one staff mint from the member profile — same HMAC secret,
 * same `qr_version` invalidation, same scanner-side verification. The member
 * app previously only SCANNED (a camera pointed at the gym); competitors show
 * a member-side code at the turnstile, which this enables.
 *
 * Identity comes exclusively from the member JWT (@CurrentMember) — never from
 * the request body — per the member-BFF security convention.
 */
@Injectable()
export class MemberIdentityService {
  private readonly logger = new Logger(MemberIdentityService.name);
  private static readonly VISIT_PAGE_MAX = 100;

  constructor(
    private readonly tenant: TenantPrisma,
    private readonly qrTokens: QrTokenService,
  ) {}

  /**
   * Render a token as a PNG data URI server-side. The member app has no QR
   * encoder dependency (and we are not adding one) — `qrcode` is already a
   * backend dep for 2FA, and RN's <Image> renders a data URI natively on iOS,
   * Android and web. Returns null on failure so the card still shows the
   * member code rather than erroring the whole screen.
   */
  private async renderQr(token: string): Promise<string | null> {
    try {
      return await QRCode.toDataURL(token, {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 512,
      });
    } catch (err) {
      this.logger.warn(`QR render failed: ${(err as Error).message}`);
      return null;
    }
  }

  /**
   * The member's digital ID: a signed static token for their own card, plus a
   * short-lived rolling token for turnstiles that reject replays.
   */
  async getDigitalId(member: CurrentMemberContext) {
    const row = await this.tenant.client.member.findFirst({
      where: { id: member.memberId },
      select: {
        id: true,
        full_name: true,
        member_code: true,
        qr_version: true,
        profile_photo_url: true,
        status: true,
      },
    });
    if (!row) throw MemberException.notFound('Member not found.');

    const staticToken = this.qrTokens.signStatic({
      member_id: row.id,
      studio_id: member.tenantId,
      qr_version: row.qr_version,
    });
    const dynamic = this.qrTokens.signDynamic({
      member_id: row.id,
      studio_id: member.tenantId,
    });

    const [staticQr, dynamicQr] = await Promise.all([
      this.renderQr(staticToken),
      this.renderQr(dynamic.token),
    ]);

    return {
      memberCode: row.member_code,
      fullName: row.full_name,
      status: row.status,
      photoUrl: row.profile_photo_url ?? null,
      /** Long-lived; safe to cache on device and render offline. */
      staticToken,
      staticQr,
      /** Rolling ~30s token; re-fetch when it expires. */
      dynamicToken: dynamic.token,
      dynamicQr,
      dynamicExpiresAt: new Date(dynamic.exp * 1000).toISOString(),
    };
  }

  /**
   * Paged visit history for the member's own check-ins. Denials are included
   * so a member can see why an entry failed rather than silently missing it.
   */
  async getVisits(
    member: CurrentMemberContext,
    opts: { limit?: number; cursor?: string } = {},
  ) {
    const limit = Math.min(
      Math.max(opts.limit ?? 30, 1),
      MemberIdentityService.VISIT_PAGE_MAX,
    );

    const rows = await this.tenant.client.checkIn.findMany({
      where: { member_id: member.memberId },
      select: {
        id: true,
        checked_in_at: true,
        check_out_at: true,
        checkin_method: true,
        status: true,
        branch: { select: { name: true } },
      },
      orderBy: { checked_in_at: 'desc' },
      take: limit + 1,
      ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    return {
      visits: page.map((r) => ({
        id: r.id,
        checkedInAt: r.checked_in_at?.toISOString() ?? null,
        checkedOutAt: r.check_out_at?.toISOString() ?? null,
        durationMinutes:
          r.checked_in_at && r.check_out_at
            ? Math.max(
                0,
                Math.round(
                  (r.check_out_at.getTime() - r.checked_in_at.getTime()) / 60000,
                ),
              )
            : null,
        method: r.checkin_method,
        status: r.status,
        branchName: r.branch?.name ?? null,
      })),
      nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
    };
  }

  /**
   * Per-month visit counts for a calendar/heat view, plus this month's total.
   * Computed in JS over a bounded window — no raw SQL, so gym scoping stays
   * on the tenant client.
   */
  async getVisitSummary(member: CurrentMemberContext, months = 6) {
    const since = new Date();
    since.setMonth(since.getMonth() - Math.min(Math.max(months, 1), 24));
    since.setHours(0, 0, 0, 0);

    const rows = await this.tenant.client.checkIn.findMany({
      where: {
        member_id: member.memberId,
        status: 'success',
        checked_in_at: { gte: since },
      },
      select: { checked_in_at: true },
      orderBy: { checked_in_at: 'desc' },
    });

    const byMonth = new Map<string, number>();
    const byDay = new Map<string, number>();
    for (const r of rows) {
      if (!r.checked_in_at) continue;
      const iso = r.checked_in_at.toISOString();
      const month = iso.slice(0, 7);
      const day = iso.slice(0, 10);
      byMonth.set(month, (byMonth.get(month) ?? 0) + 1);
      byDay.set(day, (byDay.get(day) ?? 0) + 1);
    }

    const thisMonth = new Date().toISOString().slice(0, 7);
    return {
      totalVisits: rows.length,
      thisMonthVisits: byMonth.get(thisMonth) ?? 0,
      months: [...byMonth.entries()]
        .sort((a, b) => (a[0] < b[0] ? 1 : -1))
        .map(([month, count]) => ({ month, count })),
      /** yyyy-mm-dd → visit count, for the calendar grid. */
      days: [...byDay.entries()].map(([date, count]) => ({ date, count })),
    };
  }
}
