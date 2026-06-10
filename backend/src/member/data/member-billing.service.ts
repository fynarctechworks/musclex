import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentsService } from '../../payments/payments.service';
import { AuditService } from '../../audit/audit.service';
import { CurrentMemberContext } from '../decorators/current-member.decorator';

/** Contract `RazorpayOrder` (amount in paise). */
export interface RazorpayOrderResult {
  orderId: string;
  amount: number;
  currency: string;
  razorpayKeyId: string;
  receipt: string;
}

/**
 * Member-facing membership renewal. Deliberately a THIN wrapper over the
 * existing admin `PaymentsService.createOrder` so renewal payments flow through
 * the SAME pending-Payment + Razorpay-order + verify/webhook path that already
 * credits a membership — we do not fork the billing logic.
 *
 * Tenant safety: the plan is re-validated against the member's own gym BEFORE
 * delegating, because `PaymentsService` resolves the plan with `findUnique`
 * (which is NOT covered by the gym_id $use auto-injection — the known
 * "findUnique fails-open" class). Identity is taken only from the verified token.
 */
@Injectable()
export class MemberBillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
    private readonly audit: AuditService,
  ) {}

  async renew(
    member: CurrentMemberContext,
    planId: string,
  ): Promise<RazorpayOrderResult> {
    // 1) The plan must belong to THIS member's gym (explicit gym_id filter —
    //    defends against a cross-gym planId reaching PaymentsService.findUnique).
    const plan = await this.prisma.membershipPlan.findFirst({
      where: { id: planId, gym_id: member.tenantId },
      select: { id: true },
    });
    if (!plan) {
      throw new BadRequestException('Invalid plan for this gym');
    }

    // 2) PaymentsService.createOrder needs the member's branch.
    const m = await this.prisma.member.findFirst({
      where: { id: member.memberId },
      select: { branch_id: true },
    });
    if (!m?.branch_id) {
      throw new NotFoundException('Member branch not found');
    }

    // 3) Reuse the existing order flow (pending Payment + Razorpay order with
    //    notes the verify/webhook path consumes → payment actually renews).
    const order = await this.payments.createOrder(member.tenantId, {
      member_id: member.memberId,
      plan_id: planId,
      branch_id: m.branch_id,
    });

    // 4) Audit (non-fatal — a logging failure must never block checkout).
    void this.audit
      .log({
        user_id: member.memberId,
        action: 'membership.renew.initiated',
        module: 'member-bff',
        entity_id: order.payment_id,
        entity_type: 'payment',
        details: { plan_id: planId, order_id: order.order_id },
      })
      .catch(() => undefined);

    // 5) Map to the contract shape. The contract's `amount` is in paise; the
    //    payment flow returns the major-unit amount, so convert here.
    return {
      orderId: order.order_id,
      amount: Math.round(Number(order.amount) * 100),
      currency: order.currency,
      razorpayKeyId: order.key_id,
      receipt: order.receipt_number,
    };
  }
}
