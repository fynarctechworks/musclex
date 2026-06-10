/**
 * POS receipt PDF template — supports A4 and 80mm thermal format.
 *
 * Thermal printers (Epson/Bixolon/Star) accept 80mm-wide PDFs ~ 226 pt.
 * Page height is set generous (1000pt) and auto-trimmed by react-pdf via dynamic content.
 */
import * as React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';

const h = React.createElement;

export interface PosReceiptData {
  format: 'a4' | 'thermal_80mm';
  seller_name: string;
  seller_branch?: string;
  seller_logo_url?: string;
  seller_address?: string;
  seller_phone?: string;
  seller_gstin?: string;
  seller_state_code?: string;
  cashier_name?: string;
  buyer_name?: string;
  buyer_phone?: string;
  invoice_number: string;
  invoice_date: string;
  invoice_time: string;
  place_of_supply?: string;
  payment_method: string;
  currency: string;
  is_interstate: boolean;
  items: Array<{
    name: string;
    hsn_sac?: string;
    quantity: number;
    unit_price: number;
    tax_rate: number;
    cgst_amount: number;
    sgst_amount: number;
    igst_amount: number;
    total: number;
  }>;
  subtotal: number;
  tax_total: number;
  cgst_total: number;
  sgst_total: number;
  igst_total: number;
  discount_amount: number;
  wallet_amount: number;
  total_amount: number;
  points_earned?: number;
  points_redeemed?: number;
  footer_note?: string;
}

const fmt = (n: number, cur: string) =>
  `${cur} ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ── Thermal 80mm template (compact, monospace look) ─────────────────────────
const thermalStyles = StyleSheet.create({
  page: { padding: 10, fontSize: 8, fontFamily: 'Courier' },
  center: { textAlign: 'center' },
  hr: { borderTop: '1pt dashed #000', marginVertical: 4 },
  bold: { fontWeight: 'bold' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  small: { fontSize: 7 },
  itemDesc: { flex: 1 },
  itemQty: { width: 30, textAlign: 'right' },
  itemTotal: { width: 50, textAlign: 'right' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  grand: { fontSize: 11, fontWeight: 'bold' },
});

function thermalTemplate(d: PosReceiptData) {
  const hr = h(View, { style: thermalStyles.hr });

  const header = h(
    View,
    { style: thermalStyles.center },
    d.seller_logo_url
      ? h(Image, { src: d.seller_logo_url, style: { maxWidth: 60, maxHeight: 28, alignSelf: 'center', marginBottom: 4 } })
      : null,
    h(Text, { style: [thermalStyles.bold, { fontSize: 10 }] }, d.seller_name.toUpperCase()),
    d.seller_branch ? h(Text, null, d.seller_branch) : null,
    d.seller_address ? h(Text, { style: thermalStyles.small }, d.seller_address) : null,
    d.seller_phone ? h(Text, { style: thermalStyles.small }, `Tel: ${d.seller_phone}`) : null,
    d.seller_gstin ? h(Text, { style: thermalStyles.small }, `GSTIN: ${d.seller_gstin}`) : null,
  );

  const meta = h(
    View,
    null,
    h(Text, null, `Receipt: ${d.invoice_number}`),
    h(Text, null, `Date:    ${d.invoice_date} ${d.invoice_time}`),
    d.cashier_name ? h(Text, null, `Cashier: ${d.cashier_name}`) : null,
    d.buyer_name ? h(Text, null, `Member:  ${d.buyer_name}`) : null,
  );

  const itemHeader = h(
    View,
    { style: thermalStyles.row },
    h(Text, { style: [thermalStyles.itemDesc, thermalStyles.bold] }, 'Item'),
    h(Text, { style: [thermalStyles.itemQty, thermalStyles.bold] }, 'Qty'),
    h(Text, { style: [thermalStyles.itemTotal, thermalStyles.bold] }, 'Amount'),
  );

  const itemRows = d.items.flatMap((it, i) => {
    const nodes: React.ReactNode[] = [
      h(
        View,
        { style: thermalStyles.row, key: `r-${i}` },
        h(Text, { style: thermalStyles.itemDesc }, it.name),
        h(Text, { style: thermalStyles.itemQty }, String(it.quantity)),
        h(Text, { style: thermalStyles.itemTotal }, fmt(it.total, d.currency)),
      ),
    ];
    if (it.hsn_sac || it.tax_rate > 0) {
      nodes.push(
        h(
          Text,
          { style: thermalStyles.small, key: `m-${i}` },
          `  ${it.hsn_sac ? `HSN ${it.hsn_sac}` : ''}${it.tax_rate > 0 ? `  @${it.tax_rate.toFixed(1)}%` : ''}  unit ${fmt(it.unit_price, d.currency)}`,
        ),
      );
    }
    return nodes;
  });

  const taxLines = d.is_interstate
    ? [h(View, { style: thermalStyles.totalRow, key: 'igst' }, h(Text, null, 'IGST'), h(Text, null, fmt(d.igst_total, d.currency)))]
    : [
        h(View, { style: thermalStyles.totalRow, key: 'cgst' }, h(Text, null, 'CGST'), h(Text, null, fmt(d.cgst_total, d.currency))),
        h(View, { style: thermalStyles.totalRow, key: 'sgst' }, h(Text, null, 'SGST'), h(Text, null, fmt(d.sgst_total, d.currency))),
      ];

  const totals = h(
    View,
    null,
    h(View, { style: thermalStyles.totalRow }, h(Text, null, 'Subtotal'), h(Text, null, fmt(d.subtotal, d.currency))),
    d.discount_amount > 0
      ? h(View, { style: thermalStyles.totalRow }, h(Text, null, 'Discount'), h(Text, null, `- ${fmt(d.discount_amount, d.currency)}`))
      : null,
    ...taxLines,
    d.wallet_amount > 0
      ? h(View, { style: thermalStyles.totalRow }, h(Text, null, 'Wallet'), h(Text, null, `- ${fmt(d.wallet_amount, d.currency)}`))
      : null,
    hr,
    h(View, { style: thermalStyles.totalRow }, h(Text, { style: thermalStyles.grand }, 'TOTAL'), h(Text, { style: thermalStyles.grand }, fmt(d.total_amount, d.currency))),
    h(Text, { style: [thermalStyles.center, { marginTop: 2 }] }, `Paid via ${d.payment_method.toUpperCase()}`),
  );

  const loyalty = (d.points_earned ?? 0) > 0 || (d.points_redeemed ?? 0) > 0
    ? h(
        View,
        { style: thermalStyles.center },
        d.points_redeemed && d.points_redeemed > 0 ? h(Text, { style: thermalStyles.small }, `Points redeemed: ${d.points_redeemed}`) : null,
        d.points_earned && d.points_earned > 0 ? h(Text, { style: thermalStyles.small }, `Points earned: ${d.points_earned}`) : null,
      )
    : null;

  const footer = h(
    View,
    { style: [thermalStyles.center, { marginTop: 6 }] },
    h(Text, { style: thermalStyles.small }, d.footer_note || 'Thank you. Visit again!'),
    h(Text, { style: thermalStyles.small }, 'Goods once sold are non-returnable.'),
  );

  return h(
    Page,
    { size: { width: 226, height: 800 }, style: thermalStyles.page },
    header,
    hr,
    meta,
    hr,
    itemHeader,
    hr,
    ...itemRows,
    hr,
    totals,
    loyalty,
    footer,
  );
}

// ── A4 receipt (richer layout) ──────────────────────────────────────────────
const a4Styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, fontFamily: 'Helvetica', color: '#222' },
  header: { borderBottom: '2pt solid #1A2F45', paddingBottom: 8, marginBottom: 12 },
  sellerName: { fontSize: 16, fontWeight: 'bold', color: '#1A2F45' },
  small: { fontSize: 8, color: '#555' },
  meta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  table: { border: '1pt solid #d0d0d0', borderRadius: 4 },
  thead: { flexDirection: 'row', backgroundColor: '#1A2F45', color: '#fff', padding: 6, fontSize: 9, fontWeight: 'bold' },
  tr: { flexDirection: 'row', padding: 5, borderTop: '0.5pt solid #eee', fontSize: 9 },
  cName: { flex: 3 },
  cHsn: { flex: 1, textAlign: 'center' },
  cQty: { flex: 0.7, textAlign: 'right' },
  cRate: { flex: 1, textAlign: 'right' },
  cTax: { flex: 0.8, textAlign: 'right' },
  cTotal: { flex: 1.2, textAlign: 'right', fontWeight: 'bold' },
  totalsBlock: { width: 220, alignSelf: 'flex-end', marginTop: 8 },
  totLine: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  grand: { flexDirection: 'row', justifyContent: 'space-between', borderTop: '1pt solid #1A2F45', marginTop: 4, paddingTop: 6, fontSize: 12, fontWeight: 'bold' },
  footer: { position: 'absolute', bottom: 24, left: 36, right: 36, textAlign: 'center', fontSize: 8, color: '#888', borderTop: '0.5pt solid #ddd', paddingTop: 6 },
});

function a4Template(d: PosReceiptData) {
  const header = h(
    View,
    { style: a4Styles.header },
    h(
      View,
      { style: { flexDirection: 'row', justifyContent: 'space-between' } },
      h(
        View,
        null,
        d.seller_logo_url
          ? h(Image, { src: d.seller_logo_url, style: { maxWidth: 80, maxHeight: 36, marginBottom: 4 } })
          : null,
        h(Text, { style: a4Styles.sellerName }, d.seller_name),
        d.seller_branch ? h(Text, { style: a4Styles.small }, d.seller_branch) : null,
        d.seller_address ? h(Text, { style: a4Styles.small }, d.seller_address) : null,
        d.seller_phone ? h(Text, { style: a4Styles.small }, `Tel: ${d.seller_phone}`) : null,
        d.seller_gstin ? h(Text, { style: [a4Styles.small, { fontWeight: 'bold', color: '#1A2F45' }] }, `GSTIN: ${d.seller_gstin}`) : null,
      ),
      h(
        View,
        { style: { alignItems: 'flex-end' } },
        h(Text, { style: { fontSize: 14, fontWeight: 'bold', color: '#1A2F45' } }, d.seller_gstin ? 'TAX INVOICE' : 'RECEIPT'),
        h(Text, { style: a4Styles.small }, `#${d.invoice_number}`),
        h(Text, { style: a4Styles.small }, `${d.invoice_date} ${d.invoice_time}`),
      ),
    ),
  );

  const meta = h(
    View,
    { style: a4Styles.meta },
    h(
      View,
      null,
      d.buyer_name ? h(Text, null, `Customer: ${d.buyer_name}`) : h(Text, { style: a4Styles.small }, 'Walk-in customer'),
      d.buyer_phone ? h(Text, { style: a4Styles.small }, d.buyer_phone) : null,
      d.cashier_name ? h(Text, { style: a4Styles.small }, `Cashier: ${d.cashier_name}`) : null,
    ),
    h(
      View,
      null,
      h(Text, { style: a4Styles.small }, `Payment: ${d.payment_method.toUpperCase()}`),
      d.place_of_supply ? h(Text, { style: a4Styles.small }, `Place of supply: ${d.place_of_supply}`) : null,
      h(Text, { style: a4Styles.small }, d.is_interstate ? 'Inter-state (IGST)' : 'Intra-state (CGST+SGST)'),
    ),
  );

  const thead = h(
    View,
    { style: a4Styles.thead },
    h(Text, { style: a4Styles.cName }, 'Item'),
    h(Text, { style: a4Styles.cHsn }, 'HSN'),
    h(Text, { style: a4Styles.cQty }, 'Qty'),
    h(Text, { style: a4Styles.cRate }, 'Rate'),
    h(Text, { style: a4Styles.cTax }, d.is_interstate ? 'IGST' : 'CGST+SGST'),
    h(Text, { style: a4Styles.cTotal }, 'Total'),
  );

  const rows = d.items.map((it, i) =>
    h(
      View,
      { style: a4Styles.tr, key: String(i) },
      h(Text, { style: a4Styles.cName }, it.name),
      h(Text, { style: a4Styles.cHsn }, it.hsn_sac || '—'),
      h(Text, { style: a4Styles.cQty }, String(it.quantity)),
      h(Text, { style: a4Styles.cRate }, fmt(it.unit_price, d.currency)),
      h(Text, { style: a4Styles.cTax }, fmt(d.is_interstate ? it.igst_amount : it.cgst_amount + it.sgst_amount, d.currency)),
      h(Text, { style: a4Styles.cTotal }, fmt(it.total, d.currency)),
    ),
  );

  const taxLines = d.is_interstate
    ? [h(View, { style: a4Styles.totLine, key: 'igst' }, h(Text, null, 'IGST'), h(Text, null, fmt(d.igst_total, d.currency)))]
    : [
        h(View, { style: a4Styles.totLine, key: 'cgst' }, h(Text, null, 'CGST'), h(Text, null, fmt(d.cgst_total, d.currency))),
        h(View, { style: a4Styles.totLine, key: 'sgst' }, h(Text, null, 'SGST'), h(Text, null, fmt(d.sgst_total, d.currency))),
      ];

  const totals = h(
    View,
    { style: a4Styles.totalsBlock },
    h(View, { style: a4Styles.totLine }, h(Text, null, 'Subtotal'), h(Text, null, fmt(d.subtotal, d.currency))),
    d.discount_amount > 0
      ? h(View, { style: a4Styles.totLine }, h(Text, null, 'Discount'), h(Text, null, `- ${fmt(d.discount_amount, d.currency)}`))
      : null,
    ...taxLines,
    d.wallet_amount > 0
      ? h(View, { style: a4Styles.totLine }, h(Text, null, 'Wallet'), h(Text, null, `- ${fmt(d.wallet_amount, d.currency)}`))
      : null,
    h(View, { style: a4Styles.grand }, h(Text, null, 'Total'), h(Text, null, fmt(d.total_amount, d.currency))),
  );

  const footer = h(
    Text,
    { style: a4Styles.footer, fixed: true },
    `${d.seller_name}${d.footer_note ? ` · ${d.footer_note}` : ''} · This is a computer-generated receipt.`,
  );

  return h(Page, { size: 'A4', style: a4Styles.page }, header, meta, h(View, { style: a4Styles.table }, thead, ...rows), totals, footer);
}

export function buildPosReceiptPdf(data: PosReceiptData) {
  const page = data.format === 'thermal_80mm' ? thermalTemplate(data) : a4Template(data);
  return h(Document, null, page);
}
