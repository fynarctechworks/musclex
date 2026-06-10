import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
} from '@react-pdf/renderer';

/**
 * Subscription invoice PDF renderer.
 *
 * Mirrors the on-screen InvoiceFullPreview component so the downloaded PDF
 * matches what the user saw in the in-app viewer. The selected template id
 * (classic | modern | minimal | detailed | branded) drives the accent color —
 * the rest of the layout is shared.
 *
 * Kept dependency-free of NestJS so it can be unit-tested in isolation.
 */

export type InvoiceTemplateId =
  | 'classic'
  | 'modern'
  | 'minimal'
  | 'detailed'
  | 'branded';

export interface InvoiceLineItem {
  description: string;
  period_start: string; // pre-formatted, e.g. "13 May 2026"
  period_end: string;
  amount: string; // pre-formatted, e.g. "₹4,999"
}

export interface InvoicePdfData {
  template: InvoiceTemplateId;
  invoice_number: string;
  invoice_date: string; // formatted
  status_label: string; // "PAID" | "PENDING" | etc
  status_paid: boolean;
  // Issuer (MuscleX — the platform billing the tenant)
  issuer_name: string;
  issuer_address?: string;
  issuer_email?: string;
  // Billed-to (the tenant studio)
  billed_to_name: string;
  billed_to_email?: string;
  billed_to_address?: string;
  billed_to_tax_id?: string;
  // Line items
  items: InvoiceLineItem[];
  subtotal: string;
  tax_label: string; // "Tax (0%)"
  tax_amount: string;
  total: string;
  // Payment record
  payment_method?: string;
  payment_reference?: string;
  footer_note?: string;
}

const ACCENTS: Record<InvoiceTemplateId, string> = {
  classic: '#141413',
  modern: '#3B82F6',
  minimal: '#737373',
  detailed: '#0EA5E9',
  branded: '#10B981',
};

const buildStyles = (accent: string) =>
  StyleSheet.create({
    page: {
      padding: 36,
      fontSize: 10,
      color: '#141413',
      fontFamily: 'Helvetica',
      backgroundColor: '#FFFFFF',
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      paddingBottom: 18,
      borderBottomWidth: 1,
      borderBottomColor: '#E5E5E5',
      borderBottomStyle: 'solid',
    },
    issuerName: { fontSize: 14, fontWeight: 700, color: '#141413' },
    muted: { fontSize: 9, color: '#737373', marginTop: 2 },
    invoiceBadge: {
      paddingVertical: 3,
      paddingHorizontal: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderStyle: 'solid',
      borderColor: accent + '55',
      backgroundColor: accent + '15',
      color: accent,
      fontSize: 9,
      fontWeight: 700,
      alignSelf: 'flex-end',
    },
    invoiceNumber: {
      fontSize: 10,
      marginTop: 6,
      fontFamily: 'Courier',
      textAlign: 'right',
    },
    paidBadge: {
      marginTop: 6,
      paddingVertical: 2,
      paddingHorizontal: 6,
      borderRadius: 4,
      backgroundColor: '#10B98115',
      color: '#10B981',
      fontSize: 9,
      fontWeight: 700,
      alignSelf: 'flex-end',
    },
    sectionLabel: {
      fontSize: 8,
      color: '#737373',
      fontWeight: 700,
      letterSpacing: 0.5,
      marginBottom: 4,
    },
    billToBlock: {
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: '#E5E5E5',
      borderBottomStyle: 'solid',
    },
    tableHeader: {
      flexDirection: 'row',
      paddingBottom: 6,
      marginBottom: 6,
      borderBottomWidth: 1,
      borderBottomColor: '#E5E5E5',
      borderBottomStyle: 'solid',
      fontSize: 8,
      color: '#737373',
      fontWeight: 700,
    },
    tableRow: {
      flexDirection: 'row',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: '#E5E5E5',
      borderBottomStyle: 'solid',
    },
    colDesc: { flex: 2 },
    colPeriod: { flex: 2, textAlign: 'center', fontSize: 9, color: '#737373' },
    colAmount: { flex: 1, textAlign: 'right', fontWeight: 700 },
    totalsBlock: {
      marginTop: 14,
      alignSelf: 'flex-end',
      width: 220,
    },
    totalsLine: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 3,
    },
    totalsLabel: { color: '#737373' },
    grandTotal: {
      marginTop: 6,
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderWidth: 1,
      borderStyle: 'solid',
      borderColor: accent + '55',
      backgroundColor: accent + '15',
      borderRadius: 4,
    },
    grandTotalLabel: { fontWeight: 700, color: '#141413' },
    grandTotalAmount: { fontWeight: 700, color: accent },
    paymentMeta: {
      marginTop: 22,
      padding: 12,
      backgroundColor: '#FAFAFA',
      borderRadius: 4,
    },
    paymentLine: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 2,
    },
    footer: {
      marginTop: 28,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: '#E5E5E5',
      borderTopStyle: 'solid',
      fontSize: 8,
      color: '#737373',
      textAlign: 'center',
    },
  });

function InvoiceDoc({ data }: { data: InvoicePdfData }) {
  const accent = ACCENTS[data.template] ?? ACCENTS.classic;
  const s = buildStyles(accent);
  const h = React.createElement;

  const billedToBlock = h(
    View,
    { style: s.billToBlock },
    h(Text, { style: s.sectionLabel }, 'BILL TO'),
    h(Text, { style: { fontSize: 11, fontWeight: 700 } }, data.billed_to_name),
    data.billed_to_email ? h(Text, { style: s.muted }, data.billed_to_email) : null,
    data.billed_to_address ? h(Text, { style: s.muted }, data.billed_to_address) : null,
    data.billed_to_tax_id
      ? h(Text, { style: { ...s.muted, color: accent, marginTop: 3 } }, `Tax ID: ${data.billed_to_tax_id}`)
      : null,
  );

  const headerRow = h(
    View,
    { style: s.headerRow },
    h(
      View,
      null,
      h(Text, { style: s.issuerName }, data.issuer_name),
      data.issuer_address ? h(Text, { style: s.muted }, data.issuer_address) : null,
      data.issuer_email ? h(Text, { style: s.muted }, data.issuer_email) : null,
    ),
    h(
      View,
      null,
      h(Text, { style: s.invoiceBadge }, 'INVOICE'),
      h(Text, { style: s.invoiceNumber }, data.invoice_number),
      h(Text, { style: { ...s.muted, textAlign: 'right' } }, `Date: ${data.invoice_date}`),
      data.status_paid
        ? h(Text, { style: s.paidBadge }, `✓ ${data.status_label}`)
        : h(
            Text,
            { style: { ...s.paidBadge, backgroundColor: '#F59E0B15', color: '#F59E0B' } },
            data.status_label,
          ),
    ),
  );

  const itemRows = data.items.map((item, i) =>
    h(
      View,
      { key: i, style: s.tableRow },
      h(Text, { style: s.colDesc }, item.description),
      h(Text, { style: s.colPeriod }, `${item.period_start} – ${item.period_end}`),
      h(Text, { style: s.colAmount }, item.amount),
    ),
  );

  const tableBlock = h(
    View,
    { style: { paddingVertical: 16 } },
    h(
      View,
      { style: s.tableHeader },
      h(Text, { style: s.colDesc }, 'Description'),
      h(Text, { style: s.colPeriod }, 'Period'),
      h(Text, { style: s.colAmount }, 'Amount'),
    ),
    ...itemRows,
    h(
      View,
      { style: s.totalsBlock },
      h(
        View,
        { style: s.totalsLine },
        h(Text, { style: s.totalsLabel }, 'Subtotal'),
        h(Text, null, data.subtotal),
      ),
      h(
        View,
        { style: s.totalsLine },
        h(Text, { style: s.totalsLabel }, data.tax_label),
        h(Text, null, data.tax_amount),
      ),
      h(
        View,
        { style: s.grandTotal },
        h(Text, { style: s.grandTotalLabel }, 'Total'),
        h(Text, { style: s.grandTotalAmount }, data.total),
      ),
    ),
  );

  const paymentBlock =
    data.payment_method || data.payment_reference
      ? h(
          View,
          { style: s.paymentMeta },
          h(Text, { style: { ...s.sectionLabel, marginBottom: 6 } }, 'PAYMENT'),
          data.payment_method
            ? h(
                View,
                { style: s.paymentLine },
                h(Text, { style: s.totalsLabel }, 'Method'),
                h(Text, null, data.payment_method),
              )
            : null,
          data.payment_reference
            ? h(
                View,
                { style: s.paymentLine },
                h(Text, { style: s.totalsLabel }, 'Reference'),
                h(Text, { style: { fontFamily: 'Courier' } }, data.payment_reference),
              )
            : null,
        )
      : null;

  const footer = data.footer_note
    ? h(Text, { style: s.footer }, data.footer_note)
    : null;

  return h(
    Document,
    null,
    h(
      Page,
      { size: 'A4', style: s.page },
      headerRow,
      billedToBlock,
      tableBlock,
      paymentBlock,
      footer,
    ),
  );
}

export async function renderInvoicePdfBuffer(data: InvoicePdfData): Promise<Buffer> {
  const doc = React.createElement(InvoiceDoc, { data });
  // pdf().toBuffer() returns NodeJS.ReadableStream in @react-pdf/renderer.
  const stream = await pdf(doc as any).toBuffer();
  return await streamToBuffer(stream);
}

function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk) =>
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)),
    );
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}
