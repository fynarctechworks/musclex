import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { SubscriptionService } from './subscription.service';
import {
  AllowWhenLocked,
  CurrentUser,
  JwtAuthGuard,
  JwtPayload,
  Roles,
  RolesGuard,
} from '../common';

/**
 * /api/v1/subscription/*
 *
 * Every endpoint here is @AllowWhenLocked — the whole point of these routes
 * is to let a LOCKED tenant pay and recover. SubscriptionLockGuard already
 * whitelists the prefix; the decorator is documentation-as-code.
 */
@Controller('api/v1/subscription')
@UseGuards(JwtAuthGuard, RolesGuard)
@AllowWhenLocked()
export class SubscriptionController {
  constructor(private readonly subscription: SubscriptionService) {}

  /**
   * Snapshot of the tenant's subscription — lifecycle status, plan, amount
   * due, all timestamps. Frontend uses this to render the banner/modal/
   * disabled states.
   */
  @Get('status')
  getStatus(@CurrentUser() user: JwtPayload) {
    return this.subscription.getStatus(user.studio_id);
  }

  /**
   * Immutable ledger view for the audit trail UI.
   */
  @Get('events')
  @Roles('owner', 'brand_owner')
  getEvents(
    @CurrentUser() user: JwtPayload,
    @Query('limit') limit?: string,
  ) {
    return this.subscription.getEvents(
      user.studio_id,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  /**
   * Preview what a renewal would cost — for the plan card / payment modal.
   * Accepts optional plan + billing_cycle so the UI can show the right
   * amount BEFORE the user commits. Returns continuity-strict math too.
   *
   *   GET /subscription/renewal-preview                     ← current plan
   *   GET /subscription/renewal-preview?plan=pro            ← preview switch
   *   GET /subscription/renewal-preview?plan=pro&billing_cycle=annual
   */
  @Get('renewal-preview')
  preview(
    @CurrentUser() user: JwtPayload,
    @Query('plan') plan?: string,
    @Query('billing_cycle') billing_cycle?: 'monthly' | 'annual',
  ) {
    return this.subscription.simulateRenewal(user.studio_id, {
      plan,
      billing_cycle,
    });
  }

  /**
   * Record a renewal payment.
   *
   * Self-service calls are REJECTED — renewals are gateway-only
   * (create-order + verify), so a customer cannot record an unverified
   * "manual" payment for themselves. The service accepts only
   * gateway-verified calls (verifyAndRenew) or admin/webhook actors.
   * Amounts are always computed server-side, never taken from the client.
   */
  @Post('renew')
  @Roles('owner', 'brand_owner')
  renew(
    @CurrentUser() user: JwtPayload,
    @Body()
    body: {
      plan?: string;
      billing_cycle?: 'monthly' | 'annual';
      currency?: string;
      payment_reference?: string;
      payment_method?: string;
      billing_name?: string;
      billing_email?: string;
      billing_address?: string;
      tax_id?: string;
    },
  ) {
    return this.subscription.renew({
      studio_id: user.studio_id,
      actor_id: user.user_id,
      actor_type: 'user',
      plan: body.plan,
      billing_cycle: body.billing_cycle,
      currency: body.currency,
      payment_reference: body.payment_reference,
      payment_method: body.payment_method,
      billing_info: {
        billing_name: body.billing_name,
        billing_email: body.billing_email,
        billing_address: body.billing_address,
        tax_id: body.tax_id,
      },
    });
  }

  /**
   * Preview a mid-cycle plan change. The SERVER decides how it executes:
   *
   *   mode=immediate_prorated → upgrade: pay only (new − old) × remaining/total
   *                             (+GST) now; billing date unchanged.
   *   mode=scheduled          → downgrade / cycle switch: applies at period end,
   *                             nothing to pay now.
   *   mode=renewal_due        → no active paid period: use the renew checkout.
   *
   * Returns the full credit/charge/GST breakdown for the UI.
   *
   *   GET /subscription/change-plan/preview?plan=pro
   *   GET /subscription/change-plan/preview?plan=starter&billing_cycle=annual
   */
  @Get('change-plan/preview')
  @Roles('owner', 'brand_owner')
  changePlanPreview(
    @CurrentUser() user: JwtPayload,
    @Query('plan') plan?: string,
    @Query('billing_cycle') billing_cycle?: 'monthly' | 'annual',
  ) {
    return this.subscription.getPlanChangePreview(user.studio_id, {
      plan,
      billing_cycle,
    });
  }

  /**
   * Execute a plan change:
   *   - scheduled changes (downgrade / cycle switch) need no payment fields;
   *   - zero-cost prorated changes apply directly;
   *   - PAID prorated upgrades are gateway-only — use
   *     change-plan/create-order + verify (manual references are rejected).
   * Amounts are always computed server-side.
   */
  @Post('change-plan')
  @Roles('owner', 'brand_owner')
  changePlan(
    @CurrentUser() user: JwtPayload,
    @Body()
    body: {
      plan?: string;
      billing_cycle?: 'monthly' | 'annual';
      payment_method?: string;
      payment_reference?: string;
      billing_name?: string;
      billing_email?: string;
      billing_address?: string;
      tax_id?: string;
    },
  ) {
    return this.subscription.changePlan({
      studio_id: user.studio_id,
      actor_id: user.user_id,
      plan: body.plan,
      billing_cycle: body.billing_cycle,
      payment_method: body.payment_method,
      payment_reference: body.payment_reference,
      billing_info: {
        billing_name: body.billing_name,
        billing_email: body.billing_email,
        billing_address: body.billing_address,
        tax_id: body.tax_id,
      },
    });
  }

  /**
   * Create a Razorpay order for an immediate prorated upgrade. The proration
   * breakdown is frozen into the server-set order notes; POST /verify applies
   * the change after the gateway handshake (kind='plan_change' routing).
   */
  @Post('change-plan/create-order')
  @Roles('owner', 'brand_owner')
  createChangePlanOrder(
    @CurrentUser() user: JwtPayload,
    @Body() body: { plan?: string; billing_cycle?: 'monthly' | 'annual' },
  ) {
    return this.subscription.createPlanChangeOrder(user.studio_id, {
      plan: body.plan,
      billing_cycle: body.billing_cycle,
    });
  }

  /**
   * Cancel the pending scheduled plan change (keep the current plan).
   */
  @Delete('change-plan/scheduled')
  @Roles('owner', 'brand_owner')
  cancelScheduledChange(@CurrentUser() user: JwtPayload) {
    return this.subscription.cancelScheduledChange(user.studio_id, user.user_id);
  }

  /**
   * Create a Razorpay order for an online subscription renewal / plan switch.
   * Amount is computed server-side; the order notes carry plan/cycle/studio so
   * verify can trust them. Returns { order_id, key_id, amount, ... } for Checkout.
   */
  @Post('create-order')
  @Roles('owner', 'brand_owner')
  createOrder(
    @CurrentUser() user: JwtPayload,
    @Body()
    body: {
      plan?: string;
      billing_cycle?: 'monthly' | 'annual';
      coupon_code?: string;
    },
  ) {
    return this.subscription.createRenewalOrder(user.studio_id, {
      plan: body.plan,
      billing_cycle: body.billing_cycle,
      coupon_code: body.coupon_code,
    });
  }

  /**
   * Validate a platform coupon (SCC → Discounts) against a plan and cycle, and
   * return the resulting price breakdown. Preview only — no order is created
   * and no usage is consumed. The authoritative discount is recomputed
   * server-side in create-order, so this cannot be used to fix a price.
   */
  @Post('validate-coupon')
  @Roles('owner', 'brand_owner')
  validateCoupon(
    @CurrentUser() user: JwtPayload,
    @Body()
    body: {
      code: string;
      plan?: string;
      billing_cycle?: 'monthly' | 'annual';
    },
  ) {
    return this.subscription.previewCoupon(user.studio_id, {
      code: body.code,
      plan: body.plan,
      billing_cycle: body.billing_cycle,
    });
  }

  /**
   * Redeem a coupon that covers the FULL amount — activates the subscription
   * with no gateway payment. The service re-resolves the coupon and refuses
   * unless its own pricing makes the total zero, so this cannot be used to
   * skip a partial payment.
   */
  @Post('redeem-coupon')
  @Roles('owner', 'brand_owner')
  redeemCoupon(
    @CurrentUser() user: JwtPayload,
    @Body()
    body: {
      code: string;
      plan?: string;
      billing_cycle?: 'monthly' | 'annual';
      billing_name?: string;
      billing_email?: string;
      billing_address?: string;
      tax_id?: string;
    },
  ) {
    return this.subscription.redeemFullDiscountCoupon(user.studio_id, user.user_id, {
      code: body.code,
      plan: body.plan,
      billing_cycle: body.billing_cycle,
      billing_info: {
        billing_name: body.billing_name,
        billing_email: body.billing_email,
        billing_address: body.billing_address,
        tax_id: body.tax_id,
      },
    });
  }

  /**
   * Read-only price breakdown (subtotal + GST + total) for the studio's
   * selected plan. Used by the onboarding payment page to render the summary
   * before checkout. No order is created.
   */
  @Get('order-preview')
  @Roles('owner', 'brand_owner')
  orderPreview(@CurrentUser() user: JwtPayload) {
    return this.subscription.getOrderPreview(user.studio_id);
  }

  /**
   * Verify the Razorpay Checkout handshake and record the renewal. Plan/cycle
   * are read from the order notes server-side (not the client).
   */
  @Post('verify')
  @Roles('owner', 'brand_owner')
  verify(
    @CurrentUser() user: JwtPayload,
    @Body()
    body: {
      gateway_order_id: string;
      gateway_payment_id: string;
      signature: string;
      billing_name?: string;
      billing_email?: string;
      billing_address?: string;
      tax_id?: string;
    },
  ) {
    return this.subscription.verifyAndRenew({
      studio_id: user.studio_id,
      actor_id: user.user_id,
      gateway_order_id: body.gateway_order_id,
      gateway_payment_id: body.gateway_payment_id,
      signature: body.signature,
      billing_info: {
        billing_name: body.billing_name,
        billing_email: body.billing_email,
        billing_address: body.billing_address,
        tax_id: body.tax_id,
      },
    });
  }

  /**
   * Paginated list of subscription invoices for the current tenant.
   * Powers the Invoices section on /settings/subscription.
   */
  @Get('invoices')
  @Roles('owner', 'brand_owner')
  listInvoices(
    @CurrentUser() user: JwtPayload,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.subscription.listInvoices(user.studio_id, {
      limit: limit ? parseInt(limit, 10) : 50,
      cursor,
    });
  }

  /**
   * Single invoice detail (for PDF metadata, also used by the viewer).
   */
  @Get('invoices/:id')
  @Roles('owner', 'brand_owner')
  getInvoice(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.subscription.getInvoice(user.studio_id, id);
  }

  /**
   * Stream the invoice as a PDF. Inline disposition so it renders inside an
   * <iframe> preview; the client adds ?download=1 to switch to attachment.
   * The PDF is rendered server-side via @react-pdf/renderer using the
   * studio's selected invoice template (settings → invoices).
   */
  @Get('invoices/:id/pdf')
  @Roles('owner', 'brand_owner')
  async getInvoicePdf(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Query('download') download: string | undefined,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.subscription.renderInvoicePdf(
      user.studio_id,
      id,
    );
    const disposition = download === '1' ? 'attachment' : 'inline';
    // Set Content-Type explicitly. We don't use @Header() because Nest's
    // header decorator is bypassed when @Res() is in pass-through-off mode,
    // and a missing Content-Type makes the browser render the iframe blank.
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', String(buffer.length));
    res.setHeader(
      'Content-Disposition',
      `${disposition}; filename="${filename}"`,
    );
    res.setHeader('Cache-Control', 'private, max-age=0, no-store');
    res.end(buffer);
  }

  /**
   * Cancel the current subscription. Customer keeps service through the end
   * of the paid period (no immediate revocation). Full cancellation logic
   * (final invoice, data retention timer, reactivation window) is wired but
   * intentionally lightweight — see SubscriptionService.cancelPlan.
   */
  @Post('cancel')
  @Roles('owner', 'brand_owner')
  cancel(
    @CurrentUser() user: JwtPayload,
    @Body() body: { reason?: string },
  ) {
    return this.subscription.cancelPlan({
      studio_id: user.studio_id,
      actor_id: user.user_id,
      reason: body.reason,
    });
  }

  /**
   * Platform admin: manually suspend a tenant (e.g. payment fraud,
   * compliance hold). Reactivation re-runs the policy to land at the
   * correct status (active / grace / locked).
   */
  @Post('admin/:studioId/lifecycle')
  @Roles('super_admin')
  setLifecycle(
    @CurrentUser() user: JwtPayload,
    @Param('studioId') studioId: string,
    @Body() body: { target: 'active' | 'suspended'; reason: string },
  ) {
    return this.subscription.setLifecycleStatus(
      studioId,
      body.target,
      user.user_id,
      body.reason,
    );
  }
}
