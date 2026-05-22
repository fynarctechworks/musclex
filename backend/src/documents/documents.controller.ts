import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { DocumentsService } from './documents.service';
import { DocumentDeliveryService } from './document-delivery.service';
import { SendDocumentDto } from './dto/send-document.dto';
import { JwtAuthGuard, PermissionsGuard, Permissions, CurrentUser, JwtPayload } from '../common';

@Controller('api/v1')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DocumentsController {
  constructor(
    private readonly documents: DocumentsService,
    private readonly delivery: DocumentDeliveryService,
  ) {}

  /**
   * GET /api/v1/invoices/:id/pdf
   *   ?inline=true   stream the PDF directly (default)
   *   ?inline=false  return { signed_url, document_id } pointing at Supabase Storage
   */
  @Get('invoices/:id/pdf')
  @Permissions({ module: 'payments', action: 'view' })
  async invoicePdf(
    @Param('id') id: string,
    @Query('inline') inline: string | undefined,
    @CurrentUser() user: JwtPayload,
    @Res({ passthrough: false }) res: Response,
  ) {
    const wantSignedUrl = inline === 'false';
    if (wantSignedUrl) {
      const doc = await this.documents.ensureInvoiceDocument(id, { generated_by: user.user_id });
      res.json({ document_id: doc.id, signed_url: doc.signed_url, storage_path: doc.storage_path });
      return;
    }
    const { buffer, filename } = await this.documents.getInvoicePdfBuffer(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Content-Length', String(buffer.length));
    res.end(buffer);
  }

  /**
   * POST /api/v1/invoices/:id/send
   * Body: { channels: ['email' | 'whatsapp', ...], email_override?, phone_override? }
   * Renders + uploads the PDF, then sends it on each requested channel.
   */
  @Post('invoices/:id/send')
  @Permissions({ module: 'payments', action: 'edit' })
  async sendInvoice(@Param('id') id: string, @Body() dto: SendDocumentDto) {
    return this.delivery.sendInvoice(id, dto);
  }

  /**
   * GET /api/v1/pos/sales/:id/receipt
   *   ?format=a4 | thermal_80mm   (default: a4)
   *   ?inline=true | false         (default: true — stream; false returns signed URL)
   */
  @Get('pos/sales/:id/receipt')
  @Permissions({ module: 'inventory', action: 'view' })
  async posReceipt(
    @Param('id') id: string,
    @Query('format') format: string | undefined,
    @Query('inline') inline: string | undefined,
    @CurrentUser() user: JwtPayload,
    @Res({ passthrough: false }) res: Response,
  ) {
    const fmt: 'a4' | 'thermal_80mm' = format === 'thermal_80mm' ? 'thermal_80mm' : 'a4';
    if (inline === 'false') {
      const doc = await this.documents.ensurePosReceiptDocument(id, { format: fmt, generated_by: user.user_id });
      res.json({ document_id: doc.id, signed_url: doc.signed_url, storage_path: doc.storage_path, format: fmt });
      return;
    }
    const { buffer, filename } = await this.documents.getPosReceiptBuffer(id, fmt);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Content-Length', String(buffer.length));
    res.end(buffer);
  }

  /**
   * POST /api/v1/pos/sales/:id/send-receipt
   * Body: { channels: ['email' | 'whatsapp'], format?: 'a4' | 'thermal_80mm', email_override?, phone_override? }
   */
  @Post('pos/sales/:id/send-receipt')
  @Permissions({ module: 'inventory', action: 'edit' })
  async sendPosReceipt(@Param('id') id: string, @Body() dto: SendDocumentDto & { format?: 'a4' | 'thermal_80mm' }) {
    return this.delivery.sendPosReceipt(id, dto);
  }
}
