import { Injectable, Logger } from '@nestjs/common';
import { buildInvoicePdf, InvoicePdfData } from './templates/invoice-pdf';
import { buildPosReceiptPdf, PosReceiptData } from './templates/pos-receipt-pdf';
import { numberToIndianWords } from './lib/amount-words';

@Injectable()
export class DocumentRendererService {
  private readonly logger = new Logger(DocumentRendererService.name);

  async renderInvoice(data: InvoicePdfData): Promise<Buffer> {
    const { renderToBuffer } = await import('@react-pdf/renderer');
    const element = buildInvoicePdf({
      ...data,
      amount_in_words: data.amount_in_words || numberToIndianWords(data.total_amount, data.currency),
    });
    return renderToBuffer(element as any);
  }

  async renderPosReceipt(data: PosReceiptData): Promise<Buffer> {
    const { renderToBuffer } = await import('@react-pdf/renderer');
    return renderToBuffer(buildPosReceiptPdf(data) as any);
  }
}
