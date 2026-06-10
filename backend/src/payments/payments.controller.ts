import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Res,
  UseGuards,
  Headers,
  Req,
  Logger,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard, PermissionsGuard, Permissions, CurrentUser, JwtPayload, restrictedBranchIdsForUser } from '../common';
import { Idempotent } from '../common/idempotency/idempotent.decorator';
import { StaffIdempotencyInterceptor } from '../common/idempotency/staff-idempotency.interceptor';
import { UseInterceptors } from '@nestjs/common';
import { RecordCashDto } from './dto/record-cash.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';

@Controller('api/v1/payments')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@UseInterceptors(StaffIdempotencyInterceptor)
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly configService: ConfigService,
  ) {}

  @Post('cash')
  @Idempotent()
  @Permissions({ module: 'payments', action: 'create' })
  recordCash(
    @CurrentUser() user: JwtPayload,
    @Body() body: RecordCashDto,
  ) {
    return this.paymentsService.recordCash(user.studio_id, body);
  }

  @Post('create-order')
  @Idempotent()
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
   * Stream the member-payment receipt as a PDF. Inline by default so it
   * renders inside an <iframe> preview; client adds ?download=1 to switch
   * to attachment for download. Uses the same renderer as subscription
   * invoices so receipts look identical across the product.
   */
  @Get(':id/pdf')
  @Permissions({ module: 'payments', action: 'view' })
  async getInvoicePdf(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Query('download') download: string | undefined,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.paymentsService.renderReceiptPdf(
      user.studio_id,
      id,
    );
    const disposition = download === '1' ? 'attachment' : 'inline';
    // Set Content-Type explicitly — @Header() decorator is bypassed when
    // @Res() is used directly, and without it the iframe renders blank.
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

}
