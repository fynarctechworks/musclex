import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Platform subscription coupons — the codes created in the SaaS Control Center
 * (SCC → Discounts). These are PLATFORM-level (gym pays MuscleX), which is a
 * different thing from the per-gym `studio_*.discounts` table used when a
 * MEMBER pays a gym. Do not conflate the two.
 *
 * `scc.discounts` is not part of the gym backend's Prisma client (that client
 * only maps `public` + `studio_template`), so it is read with parameterised
 * raw SQL. There is no `gym_id` on this table — it is deliberately not
 * tenant-scoped — so the usual tenant-injection rules do not apply here.
 */

export interface ResolvedCoupon {
  id: string;
  code: string;
  name: string;
  type: 'PERCENTAGE' | 'FLAT';
  value: number;
  /** Rupees taken off the pre-GST subtotal. */
  discount_amount: number;
}

interface DiscountRow {
  id: string;
  name: string;
  code: string | null;
  type: 'PERCENTAGE' | 'FLAT';
  value: string | number;
  plan_id: string | null;
  max_uses: number | null;
  used_count: number;
  plan_name: string | null;
}

@Injectable()
export class SubscriptionCouponService {
  private readonly logger = new Logger(SubscriptionCouponService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Validate a coupon for a plan and compute the rupee discount off `subtotal`.
   *
   * Throws BadRequestException with a user-facing reason when the code cannot
   * be applied. Returns null only when no code was supplied.
   *
   * The caller MUST use the returned `discount_amount` server-side — never a
   * client-supplied figure — because the Razorpay order is created from it.
   */
  async resolve(
    code: string | undefined | null,
    planName: string,
    subtotal: number,
  ): Promise<ResolvedCoupon | null> {
    const trimmed = (code ?? '').trim();
    if (!trimmed) return null;

    const rows = await this.prisma.$queryRaw<DiscountRow[]>`
      SELECT d.id, d.name, d.code, d.type, d.value, d.plan_id,
             d.max_uses, d.used_count, p.name AS plan_name
      FROM scc.discounts d
      LEFT JOIN scc.subscription_plans p ON p.id = d.plan_id
      WHERE upper(d.code) = upper(${trimmed})
        AND d.is_active = true
        AND d.valid_from <= now()
        AND d.valid_to   >= now()
      LIMIT 1
    `;

    const row = rows[0];
    if (!row) throw new BadRequestException('Invalid or expired coupon code.');

    // Plan-restricted coupons only apply to their plan.
    if (row.plan_id && row.plan_name && row.plan_name !== planName) {
      throw new BadRequestException(
        `This coupon only applies to the ${row.plan_name} plan.`,
      );
    }

    if (row.max_uses !== null && row.used_count >= row.max_uses) {
      throw new BadRequestException('This coupon has reached its usage limit.');
    }

    const value = Number(row.value);
    if (!Number.isFinite(value) || value <= 0) {
      throw new BadRequestException('Invalid or expired coupon code.');
    }

    // Percentage discounts are capped at 100%; flat discounts at the subtotal —
    // a coupon must never produce a negative charge.
    const raw =
      row.type === 'PERCENTAGE' ? (subtotal * Math.min(value, 100)) / 100 : value;
    const discount = +Math.min(raw, subtotal).toFixed(2);

    return {
      id: row.id,
      code: row.code ?? trimmed.toUpperCase(),
      name: row.name,
      type: row.type,
      value,
      discount_amount: discount,
    };
  }

  /**
   * Increment `used_count` after a payment is verified. Best-effort: a failure
   * here must never fail an already-captured payment, so it logs and moves on.
   * Guarded so a race cannot push usage past `max_uses`.
   */
  async consume(couponId: string): Promise<void> {
    try {
      await this.prisma.$executeRaw`
        UPDATE scc.discounts
        SET used_count = used_count + 1, updated_at = now()
        WHERE id = ${couponId}::uuid
          AND (max_uses IS NULL OR used_count < max_uses)
      `;
    } catch (err) {
      this.logger.error(
        `Failed to increment coupon usage for ${couponId}: ${(err as Error).message}`,
      );
    }
  }
}
