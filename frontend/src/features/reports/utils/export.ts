// Zero-dependency export helpers for the Reports module.
// Supports CSV, Excel-friendly XLS (HTML-based, opens natively in Excel),
// and Print (HTML window print) — no new packages required.

export interface ReportColumn<T> {
  key: keyof T | string;
  label: string;
  /** Optional formatter for the cell value. Returned value is used as-is for CSV/XLS/print. */
  format?: (row: T) => string | number;
  /** Right-align in print/xls (numeric columns). */
  numeric?: boolean;
}

export interface ExportOptions<T> {
  filename: string;
  title: string;
  subtitle?: string;
  columns: ReportColumn<T>[];
  rows: T[];
  /** Optional totals row appended at the bottom. */
  totals?: Record<string, string | number>;
}

const cellValue = <T,>(row: T, col: ReportColumn<T>): string | number => {
  if (col.format) return col.format(row);
  const v = (row as Record<string, unknown>)[col.key as string];
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return v;
  return String(v);
};

const escapeCsv = (v: string | number): string => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const escapeHtml = (v: string | number): string =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const triggerDownload = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

const sanitizeFilename = (name: string) =>
  name.replace(/[^a-z0-9-_]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();

// ── CSV ───────────────────────────────────────────────────

export function exportCsv<T>(opts: ExportOptions<T>): void {
  const headers = opts.columns.map((c) => escapeCsv(c.label)).join(',');
  const dataRows = opts.rows.map((row) =>
    opts.columns.map((c) => escapeCsv(cellValue(row, c))).join(','),
  );

  const lines = [headers, ...dataRows];

  if (opts.totals) {
    const totalsRow = opts.columns.map((c) =>
      escapeCsv(opts.totals?.[c.key as string] ?? ''),
    ).join(',');
    lines.push(totalsRow);
  }

  // BOM keeps Excel happy with UTF-8
  const blob = new Blob(['﻿', lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, `${sanitizeFilename(opts.filename)}.csv`);
}

// ── Excel (HTML-based .xls — opens in Excel/Numbers/Sheets) ──

export function exportExcel<T>(opts: ExportOptions<T>): void {
  const rowsHtml = opts.rows
    .map(
      (row) =>
        `<tr>${opts.columns
          .map((c) => {
            const v = cellValue(row, c);
            const align = c.numeric ? ' style="mso-number-format:\'General\';text-align:right;"' : '';
            return `<td${align}>${escapeHtml(v)}</td>`;
          })
          .join('')}</tr>`,
    )
    .join('');

  const totalsHtml = opts.totals
    ? `<tr style="font-weight:bold;background:#f1f5f9;">${opts.columns
        .map((c) => {
          const v = opts.totals?.[c.key as string] ?? '';
          const align = c.numeric ? ' style="text-align:right;"' : '';
          return `<td${align}>${escapeHtml(v)}</td>`;
        })
        .join('')}</tr>`
    : '';

  const html = `<!DOCTYPE html>
<html xmlns:x="urn:schemas-microsoft-com:office:excel">
<head>
  <meta charset="UTF-8">
  <!--[if gte mso 9]><xml>
    <x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
      <x:Name>${escapeHtml(opts.title)}</x:Name>
      <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
    </x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook>
  </xml><![endif]-->
</head>
<body>
  <h2>${escapeHtml(opts.title)}</h2>
  ${opts.subtitle ? `<p>${escapeHtml(opts.subtitle)}</p>` : ''}
  <table border="1" cellspacing="0" cellpadding="6">
    <thead>
      <tr style="background:#0d1b2a;color:#ffffff;font-weight:bold;">
        ${opts.columns.map((c) => `<th>${escapeHtml(c.label)}</th>`).join('')}
      </tr>
    </thead>
    <tbody>${rowsHtml}${totalsHtml}</tbody>
  </table>
</body>
</html>`;

  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  triggerDownload(blob, `${sanitizeFilename(opts.filename)}.xls`);
}

// ── Print ─────────────────────────────────────────────────

export function printReport<T>(opts: ExportOptions<T>): void {
  const w = window.open('', '_blank', 'width=1024,height=768');
  if (!w) return;

  const rowsHtml = opts.rows
    .map(
      (row, i) =>
        `<tr style="background:${i % 2 === 0 ? '#ffffff' : '#f8fafc'};">${opts.columns
          .map((c) => {
            const v = cellValue(row, c);
            const align = c.numeric ? 'right' : 'left';
            return `<td style="padding:8px 12px;text-align:${align};border-bottom:1px solid #e5e7eb;">${escapeHtml(v)}</td>`;
          })
          .join('')}</tr>`,
    )
    .join('');

  const totalsHtml = opts.totals
    ? `<tr style="font-weight:600;background:#f1f5f9;">${opts.columns
        .map((c) => {
          const v = opts.totals?.[c.key as string] ?? '';
          const align = c.numeric ? 'right' : 'left';
          return `<td style="padding:10px 12px;text-align:${align};border-top:2px solid #94a3b8;">${escapeHtml(v)}</td>`;
        })
        .join('')}</tr>`
    : '';

  w.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(opts.title)}</title>
  <style>
    body { font-family: -apple-system, system-ui, "Segoe UI", Roboto, sans-serif; color:#111827; padding:32px; }
    h1 { font-size:20px; margin:0 0 4px; }
    p.subtitle { color:#6b7280; margin:0 0 24px; font-size:13px; }
    table { width:100%; border-collapse:collapse; font-size:13px; }
    thead th { padding:10px 12px; text-align:left; background:#0d1b2a; color:#ffffff; font-weight:600; }
    @media print {
      body { padding:0; }
      thead { display: table-header-group; }
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(opts.title)}</h1>
  ${opts.subtitle ? `<p class="subtitle">${escapeHtml(opts.subtitle)}</p>` : ''}
  <table>
    <thead>
      <tr>${opts.columns
        .map((c) => `<th style="text-align:${c.numeric ? 'right' : 'left'};">${escapeHtml(c.label)}</th>`)
        .join('')}</tr>
    </thead>
    <tbody>${rowsHtml}${totalsHtml}</tbody>
  </table>
  <script>window.onload = () => { window.print(); };</script>
</body>
</html>`);
  w.document.close();
}

// ── Convenience: dispatch by format ───────────────────────

export type ExportFormat = 'csv' | 'xls' | 'print';

export function exportReport<T>(format: ExportFormat, opts: ExportOptions<T>): void {
  if (format === 'csv') return exportCsv(opts);
  if (format === 'xls') return exportExcel(opts);
  if (format === 'print') return printReport(opts);
}
