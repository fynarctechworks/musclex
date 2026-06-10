/**
 * GST tax-invoice PDF template (A4) using @react-pdf/renderer.
 *
 * Pure-TS (no JSX) so we don't need to touch tsconfig. Uses React.createElement.
 * The result is a React element tree that DocumentRendererService converts to a
 * Buffer via @react-pdf/renderer's renderToBuffer.
 */
import * as React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';

const h = React.createElement;

export interface InvoicePdfData {
  // Seller (issuing studio + branch)
  seller_name: string;
  seller_logo_url?: string;
  seller_address?: string;
  seller_phone?: string;
  seller_email?: string;
  seller_gstin?: string;
  seller_state?: string;
  seller_state_code?: string;
  // Buyer
  buyer_name: string;
  buyer_code?: string;
  buyer_phone?: string;
  buyer_email?: string;
  buyer_address?: string;
  buyer_gstin?: string;
  buyer_state?: string;
  // Invoice meta
  invoice_number: string;
  invoice_date: string;
  due_date?: string;
  place_of_supply?: string;
  currency: string;
  status: string;
  notes?: string;
  terms?: string;
  // Lines
  items: Array<{
    description: string;
    hsn_sac?: string;
    quantity: number;
    unit_price: number;
    discount?: number;
    taxable_value: number;
    tax_rate: number;
    cgst_amount: number;
    sgst_amount: number;
    igst_amount: number;
    total: number;
  }>;
  // Totals
  subtotal: number;
  discount_amount: number;
  cgst_total: number;
  sgst_total: number;
  igst_total: number;
  tax_total: number;
  total_amount: number;
  amount_in_words?: string;
  is_interstate: boolean;
}

const styles = StyleSheet.create({
  page: {
    padding: 32,
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: '#222',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottom: '2pt solid #1A2F45',
    paddingBottom: 8,
    marginBottom: 12,
  },
  sellerName: { fontSize: 16, fontWeight: 'bold', color: '#1A2F45' },
  small: { fontSize: 8, color: '#555', marginTop: 2 },
  invoiceTitle: { fontSize: 14, fontWeight: 'bold', textAlign: 'right', color: '#1A2F45' },
  metaBlock: { fontSize: 8, textAlign: 'right', marginTop: 2, color: '#444' },
  twoCol: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, gap: 12 },
  party: {
    flex: 1,
    border: '1pt solid #e0e0e0',
    borderRadius: 4,
    padding: 8,
    minHeight: 70,
  },
  partyLabel: { fontSize: 8, color: '#888', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  partyName: { fontSize: 10, fontWeight: 'bold' },
  partyLine: { fontSize: 8, color: '#555', marginTop: 1 },
  table: { border: '1pt solid #d0d0d0', borderRadius: 4, marginBottom: 10 },
  thead: {
    flexDirection: 'row',
    backgroundColor: '#1A2F45',
    color: '#fff',
    paddingVertical: 5,
    paddingHorizontal: 4,
    fontSize: 8,
    fontWeight: 'bold',
  },
  tr: {
    flexDirection: 'row',
    paddingVertical: 4,
    paddingHorizontal: 4,
    fontSize: 8,
    borderTop: '0.5pt solid #eee',
  },
  cellDesc: { flex: 3 },
  cellHsn: { flex: 1, textAlign: 'center' },
  cellQty: { flex: 0.6, textAlign: 'right' },
  cellPrice: { flex: 1, textAlign: 'right' },
  cellRate: { flex: 0.6, textAlign: 'right' },
  cellTax: { flex: 1, textAlign: 'right' },
  cellTotal: { flex: 1.2, textAlign: 'right', fontWeight: 'bold' },
  totalsRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4 },
  totalsBlock: { width: 220 },
  totalLine: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2, fontSize: 9 },
  totalLineKey: { color: '#555' },
  grandTotalLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 6,
    paddingBottom: 4,
    borderTop: '1pt solid #1A2F45',
    marginTop: 4,
    fontSize: 11,
    fontWeight: 'bold',
  },
  amountInWords: { fontSize: 8, fontStyle: 'italic', color: '#444', marginTop: 8 },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 32,
    right: 32,
    fontSize: 7,
    color: '#888',
    textAlign: 'center',
    borderTop: '0.5pt solid #ddd',
    paddingTop: 6,
  },
  termsBlock: {
    marginTop: 12,
    padding: 8,
    backgroundColor: '#fafafa',
    border: '0.5pt solid #eee',
    borderRadius: 4,
    fontSize: 7.5,
    color: '#555',
  },
  termsTitle: { fontSize: 8, fontWeight: 'bold', marginBottom: 2 },
});

const statusBadge = (status: string) => ({
  fontSize: 8,
  fontWeight: 'bold' as const,
  color: status === 'paid' ? '#1d7a3a' : status === 'cancelled' ? '#9a1d1d' : '#7a5b1d',
});

const fmt = (n: number, cur: string) =>
  `${cur} ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function buildInvoicePdf(data: InvoicePdfData) {
  const header = h(
    View,
    { style: styles.headerRow },
    h(
      View,
      { style: { flex: 1 } },
      data.seller_logo_url
        ? h(Image, {
            src: data.seller_logo_url,
            style: { maxWidth: 80, maxHeight: 36, marginBottom: 6 },
          })
        : null,
      h(Text, { style: styles.sellerName }, data.seller_name),
      data.seller_address ? h(Text, { style: styles.small }, data.seller_address) : null,
      data.seller_phone || data.seller_email
        ? h(
            Text,
            { style: styles.small },
            [data.seller_phone, data.seller_email].filter(Boolean).join('  |  '),
          )
        : null,
      data.seller_gstin
        ? h(Text, { style: [styles.small, { fontWeight: 'bold', color: '#1A2F45' }] }, `GSTIN: ${data.seller_gstin}`)
        : null,
    ),
    h(
      View,
      { style: { flex: 1 } },
      h(Text, { style: styles.invoiceTitle }, data.seller_gstin ? 'TAX INVOICE' : 'INVOICE'),
      h(Text, { style: styles.metaBlock }, `#${data.invoice_number}`),
      h(Text, { style: styles.metaBlock }, `Date: ${data.invoice_date}`),
      data.due_date ? h(Text, { style: styles.metaBlock }, `Due: ${data.due_date}`) : null,
      h(
        Text,
        { style: [styles.metaBlock, statusBadge(data.status)] },
        `Status: ${data.status.toUpperCase()}`,
      ),
    ),
  );

  const parties = h(
    View,
    { style: styles.twoCol },
    h(
      View,
      { style: styles.party },
      h(Text, { style: styles.partyLabel }, 'Billed To'),
      h(Text, { style: styles.partyName }, data.buyer_name),
      data.buyer_code ? h(Text, { style: styles.partyLine }, `Member: ${data.buyer_code}`) : null,
      data.buyer_phone ? h(Text, { style: styles.partyLine }, data.buyer_phone) : null,
      data.buyer_email ? h(Text, { style: styles.partyLine }, data.buyer_email) : null,
      data.buyer_address ? h(Text, { style: styles.partyLine }, data.buyer_address) : null,
      data.buyer_gstin ? h(Text, { style: [styles.partyLine, { fontWeight: 'bold' }] }, `GSTIN: ${data.buyer_gstin}`) : null,
    ),
    h(
      View,
      { style: styles.party },
      h(Text, { style: styles.partyLabel }, 'Place of Supply'),
      h(Text, { style: styles.partyName }, data.place_of_supply || data.buyer_state || '—'),
      h(
        Text,
        { style: styles.partyLine },
        data.is_interstate ? 'Inter-state supply (IGST)' : 'Intra-state supply (CGST + SGST)',
      ),
      data.seller_state ? h(Text, { style: styles.partyLine }, `Seller state: ${data.seller_state}`) : null,
    ),
  );

  const headerCells = [
    ['Description', styles.cellDesc],
    ['HSN/SAC', styles.cellHsn],
    ['Qty', styles.cellQty],
    ['Rate', styles.cellPrice],
    ['GST %', styles.cellRate],
    [data.is_interstate ? 'IGST' : 'CGST+SGST', styles.cellTax],
    ['Amount', styles.cellTotal],
  ];

  const thead = h(
    View,
    { style: styles.thead },
    ...headerCells.map(([label, style]) => h(Text, { style: style as any, key: label as string }, label as string)),
  );

  const rows = data.items.map((item, i) =>
    h(
      View,
      { style: styles.tr, key: String(i) },
      h(Text, { style: styles.cellDesc }, item.description),
      h(Text, { style: styles.cellHsn }, item.hsn_sac || '—'),
      h(Text, { style: styles.cellQty }, String(item.quantity)),
      h(Text, { style: styles.cellPrice }, fmt(item.unit_price, data.currency)),
      h(Text, { style: styles.cellRate }, `${item.tax_rate.toFixed(2)}%`),
      h(
        Text,
        { style: styles.cellTax },
        data.is_interstate
          ? fmt(item.igst_amount, data.currency)
          : fmt(item.cgst_amount + item.sgst_amount, data.currency),
      ),
      h(Text, { style: styles.cellTotal }, fmt(item.total, data.currency)),
    ),
  );

  const table = h(View, { style: styles.table }, thead, ...rows);

  const totals = h(
    View,
    { style: styles.totalsRow },
    h(
      View,
      { style: styles.totalsBlock },
      h(
        View,
        { style: styles.totalLine },
        h(Text, { style: styles.totalLineKey }, 'Subtotal'),
        h(Text, null, fmt(data.subtotal, data.currency)),
      ),
      data.discount_amount > 0
        ? h(
            View,
            { style: styles.totalLine },
            h(Text, { style: styles.totalLineKey }, 'Discount'),
            h(Text, null, `- ${fmt(data.discount_amount, data.currency)}`),
          )
        : null,
      data.is_interstate
        ? h(
            View,
            { style: styles.totalLine },
            h(Text, { style: styles.totalLineKey }, 'IGST'),
            h(Text, null, fmt(data.igst_total, data.currency)),
          )
        : [
            h(
              View,
              { style: styles.totalLine, key: 'cgst' },
              h(Text, { style: styles.totalLineKey }, 'CGST'),
              h(Text, null, fmt(data.cgst_total, data.currency)),
            ),
            h(
              View,
              { style: styles.totalLine, key: 'sgst' },
              h(Text, { style: styles.totalLineKey }, 'SGST'),
              h(Text, null, fmt(data.sgst_total, data.currency)),
            ),
          ],
      h(
        View,
        { style: styles.grandTotalLine },
        h(Text, null, 'Grand Total'),
        h(Text, null, fmt(data.total_amount, data.currency)),
      ),
    ),
  );

  const amountInWords = data.amount_in_words
    ? h(Text, { style: styles.amountInWords }, `Amount in words: ${data.amount_in_words}`)
    : null;

  const terms = data.terms || data.notes
    ? h(
        View,
        { style: styles.termsBlock },
        h(Text, { style: styles.termsTitle }, 'Notes & Terms'),
        data.notes ? h(Text, null, data.notes) : null,
        data.terms ? h(Text, null, data.terms) : null,
      )
    : null;

  const footer = h(
    Text,
    { style: styles.footer, fixed: true },
    `${data.seller_name} · This is a computer-generated invoice and does not require a signature.`,
  );

  return h(
    Document,
    null,
    h(Page, { size: 'A4', style: styles.page }, header, parties, table, totals, amountInWords, terms, footer),
  );
}
