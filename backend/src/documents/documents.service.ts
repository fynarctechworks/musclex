import {
  Injectable,
  Logger,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { DocumentRendererService } from './document-renderer.service';
import { getTenantGymId } from '../common/tenant-context';
import { InvoicePdfData } from './templates/invoice-pdf';
import { PosReceiptData } from './templates/pos-receipt-pdf';

const BUCKET = 'documents';
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);
  private supabase: SupabaseClient;

  constructor(
    private prisma: PrismaService,
    private renderer: DocumentRendererService,
    private config: ConfigService,
  ) {
    this.supabase = createClient(
      this.config.get<string>('SUPABASE_URL', ''),
      this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY', ''),
    );
  }

  /**
   * Idempotent: returns existing ready document for the (source, version) tuple,
   * otherwise renders + uploads a fresh PDF and persists a Document row.
   */
  async ensureInvoiceDocument(invoiceId: string, opts?: { force?: boolean; generated_by?: string }): Promise<{
    id: string;
    storage_path: string;
    signed_url: string;
  }> {
    const invoice = await this.loadInvoiceForPdf(invoiceId);
    if (!invoice) throw new NotFoundException('Invoice not found');

    const version = this.invoiceVersion(invoice);

    if (!opts?.force) {
      const existing = await this.prisma.document.findFirst({
        where: {
          source_type: 'invoice',
          source_id: invoiceId,
          version,
          status: 'ready',
        },
        orderBy: { generated_at: 'desc' },
      });
      if (existing) {
        const url = await this.getSignedUrl(existing.storage_bucket, existing.storage_path);
        return { id: existing.id, storage_path: existing.storage_path, signed_url: url };
      }
    }

    const pdfData = this.invoiceToPdfData(invoice);
    const buffer = await this.renderer.renderInvoice(pdfData);
    const checksum = createHash('sha256').update(buffer).digest('hex');
    const gymId = getTenantGymId() || invoice.gym_id;
    const storagePath = `${gymId}/invoice/${invoiceId}/v${version}-${checksum.slice(0, 8)}.pdf`;

    await this.ensureBucket();
    const { error: uploadError } = await this.supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        contentType: 'application/pdf',
        upsert: true,
      });
    if (uploadError) {
      this.logger.error(`PDF upload failed for invoice ${invoiceId}: ${uploadError.message}`);
      throw new InternalServerErrorException('Failed to upload invoice PDF');
    }

    const doc = await this.prisma.document.create({
      data: {
        gym_id: gymId,
        branch_id: invoice.branch_id,
        source_type: 'invoice',
        source_id: invoiceId,
        doc_type: invoice.seller_gstin ? 'tax_invoice' : 'invoice',
        format: 'a4',
        storage_bucket: BUCKET,
        storage_path: storagePath,
        size_bytes: buffer.length,
        checksum_sha256: checksum,
        status: 'ready',
        payload: pdfData as any,
        invoice_number: invoice.invoice_number,
        version,
        generated_by: opts?.generated_by ?? null,
      },
    });

    const signedUrl = await this.getSignedUrl(BUCKET, storagePath);
    return { id: doc.id, storage_path: storagePath, signed_url: signedUrl };
  }

  /** Pure download buffer (e.g. for inline streaming). */
  async getInvoicePdfBuffer(invoiceId: string): Promise<{ buffer: Buffer; filename: string }> {
    const invoice = await this.loadInvoiceForPdf(invoiceId);
    if (!invoice) throw new NotFoundException('Invoice not found');
    const buffer = await this.renderer.renderInvoice(this.invoiceToPdfData(invoice));
    return { buffer, filename: `${invoice.invoice_number}.pdf` };
  }

  // ── POS receipts ──────────────────────────────────────────────────────────

  async ensurePosReceiptDocument(
    saleId: string,
    opts?: { format?: 'a4' | 'thermal_80mm'; force?: boolean; generated_by?: string },
  ): Promise<{ id: string; storage_path: string; signed_url: string }> {
    const format = opts?.format ?? 'a4';
    const sale = await this.loadSaleForReceipt(saleId);
    if (!sale) throw new NotFoundException('Sale not found');

    const version = this.saleVersion(sale);
    if (!opts?.force) {
      const existing = await this.prisma.document.findFirst({
        where: {
          source_type: 'pos_sale',
          source_id: saleId,
          format,
          version,
          status: 'ready',
        },
        orderBy: { generated_at: 'desc' },
      });
      if (existing) {
        const url = await this.getSignedUrl(existing.storage_bucket, existing.storage_path);
        return { id: existing.id, storage_path: existing.storage_path, signed_url: url };
      }
    }

    const data = this.saleToReceiptData(sale, format);
    const buffer = await this.renderer.renderPosReceipt(data);
    const checksum = createHash('sha256').update(buffer).digest('hex');
    const gymId = getTenantGymId() || sale.gym_id;
    const storagePath = `${gymId}/pos_sale/${saleId}/${format}-v${version}-${checksum.slice(0, 8)}.pdf`;

    await this.ensureBucket();
    const { error } = await this.supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, { contentType: 'application/pdf', upsert: true });
    if (error) {
      this.logger.error(`POS PDF upload failed for sale ${saleId}: ${error.message}`);
      throw new InternalServerErrorException('Failed to upload receipt PDF');
    }

    const doc = await this.prisma.document.create({
      data: {
        gym_id: gymId,
        branch_id: sale.branch_id,
        source_type: 'pos_sale',
        source_id: saleId,
        doc_type: sale.seller_gstin ? 'tax_invoice' : 'receipt',
        format,
        storage_bucket: BUCKET,
        storage_path: storagePath,
        size_bytes: buffer.length,
        checksum_sha256: checksum,
        status: 'ready',
        payload: data as any,
        invoice_number: sale.invoice_number,
        version,
        generated_by: opts?.generated_by ?? null,
      },
    });

    const signedUrl = await this.getSignedUrl(BUCKET, storagePath);
    return { id: doc.id, storage_path: storagePath, signed_url: signedUrl };
  }

  async getPosReceiptBuffer(saleId: string, format: 'a4' | 'thermal_80mm' = 'a4'): Promise<{ buffer: Buffer; filename: string }> {
    const sale = await this.loadSaleForReceipt(saleId);
    if (!sale) throw new NotFoundException('Sale not found');
    const buffer = await this.renderer.renderPosReceipt(this.saleToReceiptData(sale, format));
    const suffix = format === 'thermal_80mm' ? '-thermal' : '';
    return { buffer, filename: `${sale.invoice_number}${suffix}.pdf` };
  }

  private saleVersion(sale: { status: string; total_amount: any }): number {
    const seed = `${sale.status}:${sale.total_amount}`;
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
    return Math.abs(h);
  }

  private async loadSaleForReceipt(saleId: string): Promise<any> {
    const sale: any = await this.prisma.posSale.findUnique({
      where: { id: saleId },
      include: {
        items: { include: { product: { select: { product_name: true, sku: true } } } },
        member: { select: { full_name: true, email: true, phone: true } },
        staff: { select: { full_name: true } },
        branch: {
          select: {
            name: true,
            address: true,
            city: true,
            state: true,
            country: true,
            postal_code: true,
            phone: true,
            gstin: true,
            gst_state_code: true,
          },
        },
      },
    });
    if (!sale) return null;
    const studio = await this.prisma.studio.findUnique({
      where: { id: sale.gym_id },
      select: {
        name: true,
        logo_url: true,
        phone: true,
        address: true,
        city: true,
        state: true,
        postal_code: true,
        gstin: true,
        gst_state_code: true,
        default_hsn: true,
        currency: true,
      },
    });
    sale.studio = studio;
    sale.seller_gstin = sale.branch?.gstin || studio?.gstin || null;
    return sale;
  }

  private saleToReceiptData(sale: any, format: 'a4' | 'thermal_80mm'): PosReceiptData {
    const studio = sale.studio;
    const branch = sale.branch;
    const sellerStateCode = branch?.gst_state_code || studio?.gst_state_code || null;
    const buyerStateCode = sale.place_of_supply || null;
    const isInterstate = !!(sellerStateCode && buyerStateCode && sellerStateCode !== buyerStateCode);
    const created: Date = sale.created_at;

    const sellerAddressParts = [
      branch?.address || studio?.address,
      branch?.city || studio?.city,
      branch?.state || studio?.state,
      branch?.postal_code || studio?.postal_code,
    ].filter(Boolean);

    return {
      format,
      seller_name: studio?.name || 'Studio',
      seller_branch: branch?.name || undefined,
      seller_logo_url: studio?.logo_url || undefined,
      seller_address: sellerAddressParts.join(', ') || undefined,
      seller_phone: branch?.phone || studio?.phone || undefined,
      seller_gstin: sale.seller_gstin || undefined,
      seller_state_code: sellerStateCode || undefined,
      cashier_name: sale.staff?.full_name || undefined,
      buyer_name: sale.member?.full_name || undefined,
      buyer_phone: sale.member?.phone || undefined,
      invoice_number: sale.invoice_number,
      invoice_date: created.toISOString().slice(0, 10),
      invoice_time: created.toISOString().slice(11, 19),
      place_of_supply: sale.place_of_supply || undefined,
      payment_method: sale.payment_method,
      currency: studio?.currency || 'INR',
      is_interstate: isInterstate,
      items: sale.items.map((it: any) => {
        const lineTotal = Number(it.total_price);
        return {
          name: it.product?.product_name || 'Item',
          hsn_sac: it.hsn_sac || studio?.default_hsn || undefined,
          quantity: it.quantity,
          unit_price: Number(it.unit_price),
          tax_rate: Number(it.tax_rate ?? 0),
          cgst_amount: Number(it.cgst_amount ?? 0),
          sgst_amount: Number(it.sgst_amount ?? 0),
          igst_amount: Number(it.igst_amount ?? 0),
          total: lineTotal,
        };
      }),
      subtotal: Number(sale.subtotal),
      tax_total: Number(sale.tax_amount),
      cgst_total: Number(sale.cgst_amount ?? 0),
      sgst_total: Number(sale.sgst_amount ?? 0),
      igst_total: Number(sale.igst_amount ?? 0),
      discount_amount: Number(sale.discount_amount),
      wallet_amount: Number(sale.wallet_amount ?? 0),
      total_amount: Number(sale.total_amount),
      points_earned: sale.points_earned,
      points_redeemed: sale.points_redeemed,
    };
  }

  async getSignedUrl(bucket: string, path: string): Promise<string> {
    const { data, error } = await this.supabase.storage.from(bucket).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
    if (error || !data?.signedUrl) {
      this.logger.error(`Signed URL failed: ${error?.message ?? 'unknown'}`);
      throw new InternalServerErrorException('Failed to create signed URL');
    }
    return data.signedUrl;
  }

  private async ensureBucket(): Promise<void> {
    const { data: buckets } = await this.supabase.storage.listBuckets();
    if (!buckets?.find((b) => b.name === BUCKET)) {
      const { error } = await this.supabase.storage.createBucket(BUCKET, {
        public: false,
        fileSizeLimit: 10 * 1024 * 1024,
        allowedMimeTypes: ['application/pdf'],
      });
      if (error && !error.message.includes('already exists')) {
        this.logger.warn(`Bucket create warning: ${error.message}`);
      }
    }
  }

  /**
   * Version increments whenever invoice mutates in a way that should produce a new PDF.
   * We hash status + total_amount + paid_at to cover the typical changes.
   */
  private invoiceVersion(invoice: LoadedInvoice): number {
    const seed = `${invoice.status}:${invoice.total_amount}:${invoice.paid_at?.toISOString() ?? 'unpaid'}`;
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
    return Math.abs(h);
  }

  private async loadInvoiceForPdf(invoiceId: string): Promise<LoadedInvoice | null> {
    const invoice: any = await this.prisma.memberInvoice.findUnique({
      where: { id: invoiceId },
      include: {
        items: true,
        member: {
          select: {
            full_name: true,
            member_code: true,
            email: true,
            phone: true,
          },
        },
        branch: {
          select: {
            name: true,
            address: true,
            city: true,
            state: true,
            country: true,
            postal_code: true,
            phone: true,
            email: true,
            gstin: true,
            gst_state_code: true,
          },
        },
      },
    });
    if (!invoice) return null;

    const studio = await this.prisma.studio.findUnique({
      where: { id: invoice.gym_id },
      select: {
        name: true,
        logo_url: true,
        phone: true,
        email: true,
        address: true,
        city: true,
        state: true,
        country: true,
        postal_code: true,
        gstin: true,
        gst_state_code: true,
        default_hsn: true,
        invoice_terms: true,
        currency: true,
      },
    });

    return {
      ...invoice,
      member: invoice.member,
      branch: invoice.branch,
      studio: studio!,
      seller_gstin: invoice.branch?.gstin || studio?.gstin || null,
    };
  }

  private invoiceToPdfData(invoice: LoadedInvoice): InvoicePdfData {
    const studio = invoice.studio;
    const branch = invoice.branch;
    const sellerStateCode = branch?.gst_state_code || studio?.gst_state_code || null;
    const buyerStateCode = invoice.place_of_supply || null;
    const isInterstate = !!(sellerStateCode && buyerStateCode && sellerStateCode !== buyerStateCode);

    const sellerAddressParts = [
      branch?.address || studio?.address,
      branch?.city || studio?.city,
      branch?.state || studio?.state,
      branch?.postal_code || studio?.postal_code,
    ].filter(Boolean);

    return {
      seller_name: branch?.name ? `${studio.name} — ${branch.name}` : studio.name,
      seller_logo_url: studio.logo_url || undefined,
      seller_address: sellerAddressParts.join(', ') || undefined,
      seller_phone: branch?.phone || studio.phone || undefined,
      seller_email: branch?.email || studio.email || undefined,
      seller_gstin: invoice.seller_gstin || undefined,
      seller_state: branch?.state || studio.state || undefined,
      seller_state_code: sellerStateCode || undefined,
      buyer_name: invoice.member.full_name,
      buyer_code: invoice.member.member_code || undefined,
      buyer_phone: invoice.member.phone || undefined,
      buyer_email: invoice.member.email || undefined,
      buyer_address: undefined,
      buyer_state: undefined,
      invoice_number: invoice.invoice_number,
      invoice_date: invoice.issued_at.toISOString().slice(0, 10),
      due_date: invoice.due_date ? invoice.due_date.toISOString().slice(0, 10) : undefined,
      place_of_supply: invoice.place_of_supply || undefined,
      currency: invoice.currency,
      status: invoice.status,
      notes: invoice.notes || undefined,
      terms: studio.invoice_terms || undefined,
      items: invoice.items.map((it: any) => {
        const lineTotal = Number(it.total_price);
        const tax = Number(it.cgst_amount) + Number(it.sgst_amount) + Number(it.igst_amount);
        return {
          description: it.description,
          hsn_sac: it.hsn_sac || studio.default_hsn || undefined,
          quantity: it.quantity,
          unit_price: Number(it.unit_price),
          taxable_value: lineTotal,
          tax_rate: Number(it.tax_rate),
          cgst_amount: Number(it.cgst_amount),
          sgst_amount: Number(it.sgst_amount),
          igst_amount: Number(it.igst_amount),
          total: lineTotal + tax,
        };
      }),
      subtotal: Number(invoice.subtotal),
      discount_amount: Number(invoice.discount_amount),
      cgst_total: Number(invoice.cgst_amount),
      sgst_total: Number(invoice.sgst_amount),
      igst_total: Number(invoice.igst_amount),
      tax_total: Number(invoice.tax_amount),
      total_amount: Number(invoice.total_amount),
      is_interstate: isInterstate,
    };
  }
}

// Loose shape; Prisma generates strict types after migration but we use `any` because
// the loaded invoice includes runtime-only fields (studio, seller_gstin).
interface LoadedInvoice {
  id: string;
  gym_id: string;
  branch_id: string;
  invoice_number: string;
  status: string;
  currency: string;
  subtotal: any;
  total_amount: any;
  tax_amount: any;
  cgst_amount: any;
  sgst_amount: any;
  igst_amount: any;
  discount_amount: any;
  place_of_supply: string | null;
  notes: string | null;
  issued_at: Date;
  due_date: Date | null;
  paid_at: Date | null;
  items: any[];
  member: { full_name: string; member_code: string | null; email: string | null; phone: string };
  branch: any;
  studio: any;
  seller_gstin: string | null;
}
