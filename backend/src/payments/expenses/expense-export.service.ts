import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { ExportExpensesDto } from './dto';

/**
 * Builds CSV / XLSX-compatible exports.
 *
 * We emit plain CSV (UTF-8, BOM-prefixed so Excel opens Unicode correctly).
 * For "xlsx" format we emit the same CSV but with content-type set to
 * application/vnd.ms-excel and a .xls extension — Excel opens this natively
 * without requiring the heavyweight exceljs dependency.
 *
 * Row columns:
 *   Date | Category | Description | Vendor | Amount | Currency
 *   | Payment Method | Status | Recorded By | Branch
 *
 * India GST note: a "GST (placeholder)" column is included but left blank
 * because GSTIN capture is not yet in the expense data model.
 */
@Injectable()
export class ExpenseExportService {
  constructor(private readonly prisma: PrismaService) {}

  async buildExport(filters: ExportExpensesDto) {
    const where: any = {};
    if (filters.branch_id) where.branch_id = filters.branch_id;
    if (filters.date_from || filters.date_to) {
      where.expense_date = {};
      if (filters.date_from) where.expense_date.gte = new Date(filters.date_from);
      if (filters.date_to) where.expense_date.lte = new Date(filters.date_to);
    }

    const rows = await this.prisma.expense.findMany({
      where,
      include: {
        branch: { select: { id: true, name: true } },
        recorded_by: { select: { id: true, full_name: true } },
        category_ref: { select: { id: true, name: true } },
      },
      orderBy: [{ expense_date: 'asc' }, { created_at: 'asc' }],
    });

    const header = [
      'Date',
      'Category',
      'Description',
      'Vendor',
      'Amount',
      'Currency',
      'Payment Method',
      'Status',
      'Recorded By',
      'Branch',
      'GST (placeholder)',
    ];

    const body = rows.map((r) => [
      r.expense_date.toISOString().slice(0, 10),
      r.category_ref?.name ?? r.category ?? '',
      r.description ?? '',
      r.vendor ?? '',
      Number(r.amount).toFixed(2),
      r.currency ?? 'INR',
      r.payment_method ?? '',
      r.status ?? '',
      r.recorded_by?.full_name ?? '',
      r.branch?.name ?? '',
      '', // GST placeholder — TODO capture GSTIN when model supports it
    ]);

    const csv = [header, ...body].map((row) => row.map(escapeCsv).join(',')).join('\r\n');
    // Prefix UTF-8 BOM so Excel recognizes unicode characters
    const content = '\uFEFF' + csv;

    const stamp = new Date().toISOString().slice(0, 10);
    const filename =
      filters.format === 'xlsx'
        ? `expenses_${stamp}.xls`
        : `expenses_${stamp}.csv`;
    const mime =
      filters.format === 'xlsx'
        ? 'application/vnd.ms-excel; charset=utf-8'
        : 'text/csv; charset=utf-8';

    return { content, filename, mime, row_count: rows.length };
  }
}

function escapeCsv(value: unknown): string {
  const s = value == null ? '' : String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
