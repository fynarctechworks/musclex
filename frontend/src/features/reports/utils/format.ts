// Single source of truth for value formatting in the Reports module.
// Keeps tables, KPIs, charts, and exports visually consistent.

import { format, parseISO } from 'date-fns';

const numberFmt = new Intl.NumberFormat('en-IN');
const compactFmt = new Intl.NumberFormat('en-IN', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

export const formatNumber = (v: number | null | undefined): string => {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return '0';
  return numberFmt.format(Number(v));
};

export const formatCompact = (v: number | null | undefined): string => {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return '0';
  return compactFmt.format(Number(v));
};

/** Indian Rupee formatting consistent with PRD (₹ prefix, grouped). */
export const formatCurrency = (v: number | null | undefined): string => {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return '₹0';
  return `₹${numberFmt.format(Math.round(Number(v)))}`;
};

export const formatPercent = (
  v: number | null | undefined,
  digits = 1,
): string => {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return '0%';
  return `${Number(v).toFixed(digits)}%`;
};

/** Safe ISO date formatting; falls back to original string or em-dash. */
export const formatDate = (
  iso: string | null | undefined,
  pattern = 'MMM d, yyyy',
): string => {
  if (!iso) return '—';
  try {
    return format(parseISO(iso), pattern);
  } catch {
    return iso;
  }
};

export const formatShortDate = (iso: string | null | undefined): string =>
  formatDate(iso, 'MMM d');

/** Title-case a snake_case enum-ish label. */
export const formatLabel = (s: string | null | undefined): string => {
  if (!s) return '—';
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};
