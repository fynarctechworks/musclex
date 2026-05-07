import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Headers,
  Req,
  Logger,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard, PermissionsGuard, Permissions, CurrentUser, JwtPayload, restrictedBranchIdsForUser } from '../common';
import { RecordCashDto } from './dto/record-cash.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';

@Controller('api/v1/payments')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly configService: ConfigService,
  ) {}

  @Post('cash')
  @Permissions({ module: 'payments', action: 'create' })
  recordCash(
    @CurrentUser() user: JwtPayload,
    @Body() body: RecordCashDto,
  ) {
    return this.paymentsService.recordCash(user.studio_id, body);
  }

  @Post('create-order')
  @Permissions({ module: 'payments', action: 'create' })
  createOrder(
    @CurrentUser() user: JwtPayload,
    @Body() body: CreateOrderDto,
  ) {
    return this.paymentsService.createOrder(user.studio_id, body);
  }

  @Post('verify')
  @Permissions({ module: 'payments', action: 'create' })
  verifyPayment(
    @Body() body: VerifyPaymentDto,
  ) {
    return this.paymentsService.verifyPayment(body);
  }

  @Get()
  @Permissions({ module: 'payments', action: 'view' })
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query('branch_id') branch_id?: string,
    @Query('date_from') date_from?: string,
    @Query('date_to') date_to?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.paymentsService.findAll(user.studio_id, {
      branch_id,
      date_from,
      date_to,
      status,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 50,
      user_branch_ids: restrictedBranchIdsForUser(user),
    });
  }

  @Get(':id/invoice')
  @Permissions({ module: 'payments', action: 'view' })
  getInvoice(@Param('id') id: string) {
    return this.paymentsService.getInvoice(id);
  }

  /**
   * Razorpay webhook intake — no JWT auth (called by Razorpay servers).
   * Verifies HMAC-SHA256 signature before processing.
   */
  @Post('webhooks/razorpay')
  @UseGuards() // Override class-level guards — no JWT required
  async razorpayWebhook(
    @Headers('x-razorpay-signature') signature: string,
    @Headers('x-razorpay-event-id') eventId: string,
    @Req() req: Request,
  ) {
    const webhookSecret = this.configService.get<string>('RAZORPAY_WEBHOOK_SECRET', '');
    if (!webhookSecret) {
      this.logger.error('RAZORPAY_WEBHOOK_SECRET not configured');
      throw new BadRequestException('Webhook not configured');
    }

    // Verify HMAC-SHA256 using raw body
    const rawBody = (req as any).rawBody as Buffer | undefined;
    const bodyStr = rawBody ? rawBody.toString('utf8') : JSON.stringify(req.body);
    const expected = createHmac('sha256', webhookSecret).update(bodyStr).digest('hex');

    let signatureValid = false;
    try {
      signatureValid = timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature ?? '', 'hex'));
    } catch {
      signatureValid = false;
    }

    if (!signatureValid) {
      this.logger.warn('Invalid Razorpay webhook signature');
      throw new ForbiddenException('Invalid webhook signature');
    }

    // Replay protection: validate event timestamp embedded in body (Razorpay includes created_at)
    const event = req.body as { event: string; created_at?: number; payload: Record<string, any> };
    if (event.created_at) {
      const eventAge = Math.floor(Date.now() / 1000) - event.created_at;
      if (eventAge > 300) {
        this.logger.warn(`Razorpay webhook timestamp too old (${eventAge}s) — possible replay attack`);
        throw new ForbiddenException('Webhook timestamp expired');
      }
    }

    this.logger.log(`Razorpay webhook received: ${event.event}`);

    if (event.event === 'payment.captured') {
      const payment = event.payload?.payment?.entity;
      if (payment?.id && payment?.order_id) {
        await this.paymentsService.handleRazorpayWebhook(payment.order_id, payment.id);
      }
    }

    return { received: true };
  }

  /**
   * Stripe webhook intake — no JWT auth (called by Stripe servers).
   * Verifies Stripe signature header before processing.
   */
  @Post('webhooks/stripe')
  @UseGuards() // Override class-level guards — no JWT required
  async stripeWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() req: Request,
  ) {
    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET', '');
    if (!webhookSecret) {
      this.logger.error('STRIPE_WEBHOOK_SECRET not configured');
      throw new BadRequestException('Webhook not configured');
    }

    // Stripe signature format: "t=timestamp,v1=sig1,v1=sig2"
    const rawBody = (req as any).rawBody as Buffer | undefined;
    const bodyStr = rawBody ? rawBody.toString('utf8') : JSON.stringify(req.body);

    let signatureValid = false;
    try {
      const sigParts = (signature ?? '').split(',').reduce<Record<string, string>>((acc, part) => {
        const eqIdx = part.indexOf('=');
        if (eqIdx > 0) acc[part.slice(0, eqIdx)] = part.slice(eqIdx + 1);
        return acc;
      }, {});
      const timestamp = sigParts['t'];
      const receivedSig = sigParts['v1'];

      if (timestamp && receivedSig) {
        const signedPayload = `${timestamp}.${bodyStr}`;
        const expected = createHmac('sha256', webhookSecret).update(signedPayload).digest('hex');
        signatureValid = timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(receivedSig, 'hex'));

        // Replay protection: reject events older than 5 minutes
        const eventAge = Math.floor(Date.now() / 1000) - parseInt(timestamp, 10);
        if (eventAge > 300) {
          this.logger.warn('Stripe webhook timestamp too old — possible replay attack');
          throw new ForbiddenException('Webhook timestamp expired');
        }
      }
    } catch (err) {
      if (err instanceof ForbiddenException) throw err;
      signatureValid = false;
    }

    if (!signatureValid) {
      this.logger.warn('Invalid Stripe webhook signature');
      throw new ForbiddenException('Invalid webhook signature');
    }

    const event = req.body as { type: string; data: { object: Record<string, any> } };
    this.logger.log(`Stripe webhook received: ${event.type}`);

    if (event.type === 'payment_intent.succeeded') {
      const intent = event.data?.object;
      if (intent?.id && intent?.metadata?.order_id) {
        await this.paymentsService.handleStripeWebhook(intent.metadata.order_id, intent.id);
      }
    }

    return { received: true };
  }
}
