/**
 * 5 built-in invoice templates.
 * Each template is an HTML string with {{ variable }} placeholders.
 * The studio's default template is stored in studio.settings or branch_settings.
 */

export interface InvoiceTemplate {
  id: string;
  name: string;
  description: string;
  previewColor: string;
}

export const INVOICE_TEMPLATES: InvoiceTemplate[] = [
  {
    id: 'classic',
    name: 'Classic',
    description: 'Clean, professional layout with bordered tables',
    previewColor: '#1A2F45',
  },
  {
    id: 'modern',
    name: 'Modern',
    description: 'Sleek design with accent colors and card-style sections',
    previewColor: '#4A9FD4',
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Simple and clean with lots of whitespace',
    previewColor: '#F5F5F5',
  },
  {
    id: 'detailed',
    name: 'Detailed',
    description: 'Comprehensive layout with full plan breakdown and terms',
    previewColor: '#2A4A6A',
  },
  {
    id: 'branded',
    name: 'Branded',
    description: 'Emphasizes gym logo and brand colors prominently',
    previewColor: '#34C77A',
  },
];

export const DEFAULT_TEMPLATE_ID = 'classic';

interface InvoiceData {
  gym_name: string;
  gym_logo_url?: string;
  gym_address?: string;
  gym_phone?: string;
  gym_email?: string;
  member_name: string;
  member_code: string;
  member_email?: string;
  member_phone: string;
  plan_name: string;
  plan_price: string;
  currency: string;
  start_date: string;
  end_date?: string;
  invoice_number: string;
  invoice_date: string;
  payment_status: string;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderInvoiceHtml(templateId: string, data: InvoiceData): string {
  const d = Object.fromEntries(
    Object.entries(data).map(([k, v]) => [k, escapeHtml(v || '')]),
  );

  const header = `
    <div style="text-align:center;margin-bottom:24px;">
      ${d.gym_logo_url ? `<img src="${d.gym_logo_url}" alt="${d.gym_name}" style="max-height:60px;margin-bottom:8px;" />` : ''}
      <h1 style="margin:0;font-size:22px;color:#1a1a1a;">${d.gym_name}</h1>
      ${d.gym_address ? `<p style="margin:4px 0;font-size:12px;color:#666;">${d.gym_address}</p>` : ''}
      ${d.gym_phone || d.gym_email ? `<p style="margin:4px 0;font-size:12px;color:#666;">${[d.gym_phone, d.gym_email].filter(Boolean).join(' | ')}</p>` : ''}
    </div>
  `;

  const invoiceMeta = `
    <table style="width:100%;margin-bottom:20px;font-size:13px;">
      <tr>
        <td><strong>Invoice #:</strong> ${d.invoice_number}</td>
        <td style="text-align:right;"><strong>Date:</strong> ${d.invoice_date}</td>
      </tr>
      <tr>
        <td><strong>Status:</strong> ${d.payment_status}</td>
        <td style="text-align:right;"><strong>Member:</strong> ${d.member_code}</td>
      </tr>
    </table>
  `;

  const memberInfo = `
    <div style="margin-bottom:20px;padding:12px;background:#f9f9f9;border-radius:8px;">
      <p style="margin:0;font-size:14px;font-weight:600;">${d.member_name}</p>
      <p style="margin:4px 0 0;font-size:12px;color:#666;">${[d.member_phone, d.member_email].filter(Boolean).join(' | ')}</p>
    </div>
  `;

  const itemsTable = `
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
      <thead>
        <tr style="border-bottom:2px solid #eee;">
          <th style="text-align:left;padding:8px;font-size:12px;color:#666;">Description</th>
          <th style="text-align:left;padding:8px;font-size:12px;color:#666;">Period</th>
          <th style="text-align:right;padding:8px;font-size:12px;color:#666;">Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr style="border-bottom:1px solid #eee;">
          <td style="padding:10px 8px;font-size:13px;">${d.plan_name}</td>
          <td style="padding:10px 8px;font-size:13px;">${d.start_date}${d.end_date ? ` — ${d.end_date}` : ''}</td>
          <td style="padding:10px 8px;text-align:right;font-size:13px;font-weight:600;">${d.currency} ${d.plan_price}</td>
        </tr>
      </tbody>
      <tfoot>
        <tr>
          <td colspan="2" style="padding:10px 8px;text-align:right;font-weight:600;font-size:14px;">Total</td>
          <td style="padding:10px 8px;text-align:right;font-weight:700;font-size:16px;color:#4A9FD4;">${d.currency} ${d.plan_price}</td>
        </tr>
      </tfoot>
    </table>
  `;

  const footer = `
    <div style="text-align:center;margin-top:24px;padding-top:16px;border-top:1px solid #eee;">
      <p style="font-size:11px;color:#999;">Thank you for being a member of ${d.gym_name}!</p>
      <p style="font-size:10px;color:#bbb;">This is a computer-generated invoice.</p>
    </div>
  `;

  // Template-specific wrappers
  const templates: Record<string, string> = {
    classic: `
      <div style="max-width:600px;margin:0 auto;font-family:'Inter',Arial,sans-serif;padding:32px;border:1px solid #e0e0e0;border-radius:8px;">
        ${header}${invoiceMeta}${memberInfo}${itemsTable}${footer}
      </div>
    `,
    modern: `
      <div style="max-width:600px;margin:0 auto;font-family:'Inter',Arial,sans-serif;padding:0;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
        <div style="background:#4A9FD4;padding:24px;color:#fff;text-align:center;">
          ${d.gym_logo_url ? `<img src="${d.gym_logo_url}" alt="${d.gym_name}" style="max-height:48px;margin-bottom:8px;filter:brightness(10);" />` : ''}
          <h1 style="margin:0;font-size:20px;">${d.gym_name}</h1>
          <p style="margin:4px 0 0;font-size:12px;opacity:0.8;">Membership Invoice</p>
        </div>
        <div style="padding:24px;">
          ${invoiceMeta}${memberInfo}${itemsTable}${footer}
        </div>
      </div>
    `,
    minimal: `
      <div style="max-width:560px;margin:0 auto;font-family:'Inter',Arial,sans-serif;padding:40px 24px;">
        <h2 style="font-size:18px;color:#333;margin:0 0 24px;">Invoice</h2>
        ${invoiceMeta}
        <hr style="border:none;border-top:1px solid #eee;margin:16px 0;" />
        ${memberInfo}${itemsTable}${footer}
      </div>
    `,
    detailed: `
      <div style="max-width:640px;margin:0 auto;font-family:'Inter',Arial,sans-serif;padding:32px;background:#fafafa;border-radius:12px;">
        ${header}
        <div style="background:#fff;border:1px solid #e8e8e8;border-radius:8px;padding:20px;margin-bottom:16px;">
          ${invoiceMeta}
        </div>
        <div style="background:#fff;border:1px solid #e8e8e8;border-radius:8px;padding:20px;margin-bottom:16px;">
          <h3 style="margin:0 0 12px;font-size:14px;color:#333;">Member Details</h3>
          ${memberInfo}
        </div>
        <div style="background:#fff;border:1px solid #e8e8e8;border-radius:8px;padding:20px;">
          <h3 style="margin:0 0 12px;font-size:14px;color:#333;">Plan Details</h3>
          ${itemsTable}
        </div>
        ${footer}
      </div>
    `,
    branded: `
      <div style="max-width:600px;margin:0 auto;font-family:'Inter',Arial,sans-serif;padding:0;border-radius:12px;overflow:hidden;border:2px solid #34C77A;">
        <div style="background:linear-gradient(135deg,#34C77A,#2AAE6A);padding:28px;color:#fff;text-align:center;">
          ${d.gym_logo_url ? `<img src="${d.gym_logo_url}" alt="${d.gym_name}" style="max-height:56px;margin-bottom:8px;" />` : ''}
          <h1 style="margin:0;font-size:22px;letter-spacing:1px;">${d.gym_name}</h1>
        </div>
        <div style="padding:24px;">
          ${invoiceMeta}${memberInfo}${itemsTable}${footer}
        </div>
      </div>
    `,
  };

  return templates[templateId] || templates.classic;
}
