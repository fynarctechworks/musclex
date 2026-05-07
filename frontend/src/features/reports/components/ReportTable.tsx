'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  Search,
  AlertCircle,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LoadingSkeleton } from '@/components/shared';
import type { ReportColumn } from '../utils/export';

export interface ReportTableProps<T> {
  title?: string;
  description?: string;
  columns: ReportColumn<T>[];
  rows: T[];
  /** Optional totals row appended at the bottom. Keys must match column.key. */
  totals?: Record<string, string | number>;
  /** Show client-side search input. Searches across all string-cell values. */
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Enable pagination. Defaults to true; auto-hidden when rows ≤ pageSize. */
  paginated?: boolean;
  pageSize?: number;
  isLoading?: boolean;
  /** Render an error banner inside the table area when present. */
  isError?: boolean;
  errorText?: string;
  emptyText?: string;
  rowKey?: (row: T, idx: number) => string | number;
  headerActions?: React.ReactNode;
}

const cellRender = <T,>(row: T, col: ReportColumn<T>): React.ReactNode => {
  if (col.format) return col.format(row);
  const v = (row as Record<string, unknown>)[col.key as string];
  if (v === null || v === undefined) return '—';
  if (typeof v === 'number') return v.toLocaleString();
  return String(v);
};

const cellSortValue = <T,>(row: T, col: ReportColumn<T>): string | number => {
  if (col.format) {
    const v = col.format(row);
    return typeof v === 'number' ? v : String(v);
  }
  const v = (row as Record<string, unknown>)[col.key as string];
  if (typeof v === 'number') return v;
  if (v === null || v === undefined) return '';
  return String(v);
};

export function ReportTable<T>({
  title,
  description,
  columns,
  rows,
  totals,
  searchable = false,
  searchPlaceholder = 'Search...',
  paginated = true,
  pageSize = 25,
  isLoading = false,
  isError = false,
  errorText = 'Failed to load report data',
  emptyText = 'No data available',
  rowKey,
  headerActions,
}: ReportTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  // Filter + sort
  const filteredSorted = useMemo(() => {
    let out = rows;

    if (searchable && query.trim()) {
      const q = query.trim().toLowerCase();
      out = out.filter((row) =>
        columns.some((c) => String(cellSortValue(row, c)).toLowerCase().includes(q)),
      );
    }

    if (sortKey) {
      const col = columns.find((c) => String(c.key) === sortKey);
      if (col) {
        out = [...out].sort((a, b) => {
          const va = cellSortValue(a, col);
          const vb = cellSortValue(b, col);
          if (typeof va === 'number' && typeof vb === 'number') {
            return sortDir === 'asc' ? va - vb : vb - va;
          }
          return sortDir === 'asc'
            ? String(va).localeCompare(String(vb))
            : String(vb).localeCompare(String(va));
        });
      }
    }

    return out;
  }, [rows, columns, query, sortKey, sortDir, searchable]);

  const totalRows = filteredSorted.length;
  const totalPages = paginated ? Math.max(1, Math.ceil(totalRows / pageSize)) : 1;
  const showPagination = paginated && totalRows > pageSize;

  // Reset to page 1 when filter/sort/data changes
  useEffect(() => {
    setPage(1);
  }, [query, sortKey, sortDir, rows]);

  const pageRows = useMemo(() => {
    if (!paginated) return filteredSorted;
    const start = (page - 1) * pageSize;
    return filteredSorted.slice(start, start + pageSize);
  }, [filteredSorted, page, pageSize, paginated]);

  const toggleSort = (key: string) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir('desc');
    } else if (sortDir === 'desc') {
      setSortDir('asc');
    } else {
      setSortKey(null);
      setSortDir('desc');
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card">
      {(title || searchable || headerActions) && (
        <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            {title && <h3 className="text-sm font-medium text-foreground">{title}</h3>}
            {description && (
              <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {searchable && (
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="h-8 w-full pl-8 text-xs sm:w-56"
                />
              </div>
            )}
            {headerActions}
          </div>
        </div>
      )}

      <div className="max-h-[520px] overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-card">
            <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
              {columns.map((c) => {
                const k = String(c.key);
                const active = sortKey === k;
                return (
                  <th
                    key={k}
                    onClick={() => toggleSort(k)}
                    className={`select-none cursor-pointer px-5 py-3 font-semibold ${
                      c.numeric ? 'text-right' : 'text-left'
                    } hover:text-foreground transition-colors`}
                  >
                    <span
                      className={`inline-flex items-center gap-1 ${
                        c.numeric ? 'flex-row-reverse' : ''
                      }`}
                    >
                      {c.label}
                      {active ? (
                        sortDir === 'asc' ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        )
                      ) : (
                        <ChevronsUpDown className="h-3 w-3 opacity-40" />
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={columns.length} className="p-5">
                  <LoadingSkeleton className="h-32" />
                </td>
              </tr>
            ) : isError ? (
              <tr>
                <td colSpan={columns.length} className="px-5 py-12">
                  <div className="flex flex-col items-center justify-center gap-2 text-center">
                    <AlertCircle className="h-6 w-6 text-destructive" />
                    <p className="text-sm font-medium text-foreground">{errorText}</p>
                    <p className="text-xs text-muted-foreground">
                      Please refresh the page or adjust filters.
                    </p>
                  </div>
                </td>
              </tr>
            ) : pageRows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-5 py-12 text-center text-sm text-muted-foreground"
                >
                  {emptyText}
                </td>
              </tr>
            ) : (
              pageRows.map((row, i) => (
                <tr
                  key={rowKey ? rowKey(row, i) : i}
                  className="border-b border-border/40 transition-colors hover:bg-muted/30"
                >
                  {columns.map((c) => (
                    <td
                      key={String(c.key)}
                      className={`px-5 py-3 ${
                        c.numeric ? 'text-right tabular-nums' : 'text-left'
                      } text-foreground`}
                    >
                      {cellRender(row, c)}
                    </td>
                  ))}
                </tr>
              ))
            )}
            {!isLoading && !isError && totals && pageRows.length > 0 && page === totalPages && (
              <tr className="bg-muted/20 font-semibold">
                {columns.map((c) => {
                  const v = totals[c.key as string];
                  return (
                    <td
                      key={String(c.key)}
                      className={`px-5 py-3 ${
                        c.numeric ? 'text-right tabular-nums' : 'text-left'
                      } text-foreground border-t-2 border-border`}
                    >
                      {v ?? ''}
                    </td>
                  );
                })}
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showPagination && (
        <div className="flex items-center justify-between border-t border-border px-5 py-3 text-xs text-muted-foreground">
          <span>
            Showing{' '}
            <span className="font-medium text-foreground">
              {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalRows)}
            </span>{' '}
            of <span className="font-medium text-foreground">{totalRows}</span>
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="tabular-nums">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
