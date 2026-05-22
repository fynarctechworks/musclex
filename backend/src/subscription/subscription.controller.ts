import {
  Body,
  Controller,
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
   * Record a renewal payment. Optionally switches plan / billing cycle in
   * the same atomic transaction.
   *
   * Body:
   *   payment_method       (required) — 'upi'|'card'|'netbanking'|...
   *   payment_reference    (required) — UTR / transaction ID
   *   plan                 (optional) — target plan name; defaults to current
   *   billing_cycle        (optional) — 'monthly'|'annual'; defaults to current
   *   currency             (optional) — defaults to 'INR'
   *
   * Amount is computed server-side from the (target) plan + cycle — clients
   * cannot pass amounts, preventing price tampering.
   *
   * For production this is also called by the Razorpay/Stripe webhook handler
   * after verifying the gateway signature server-side.
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
