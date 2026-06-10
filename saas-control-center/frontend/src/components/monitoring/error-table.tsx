'use client';

import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { StatusBadge } from '@/components/shared/status-badge';
import { SeverityBadge } from './severity-badge';
import type { SystemError } from '@/types/monitoring';

interface Props {
  data: SystemError[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
}

function formatDateTime(date: string) {
  return new Date(date).toLocaleString('en-IN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ErrorTable({ data, selected, onToggle, onToggleAll }: Props) {
  const allSelected = data.length > 0 && data.every((e) => selected.has(e.id));

  return (
    <div className="rounded-lg border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={onToggleAll}
                aria-label="Select all"
                className="h-3.5 w-3.5 cursor-pointer"
              />
            </TableHead>
            <TableHead className="text-[13px]">Severity</TableHead>
            <TableHead className="text-[13px]">Status</TableHead>
            <TableHead className="text-[13px]">Error</TableHead>
            <TableHead className="text-[13px]">Source</TableHead>
            <TableHead className="text-[13px] text-right">Events</TableHead>
            <TableHead className="text-[13px] text-right">Gyms</TableHead>
            <TableHead className="text-[13px]">Last seen</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((e) => (
            <TableRow key={e.id}>
              <TableCell>
                <input
                  type="checkbox"
                  checked={selected.has(e.id)}
                  onChange={() => onToggle(e.id)}
                  aria-label={`Select ${e.title}`}
                  className="h-3.5 w-3.5 cursor-pointer"
                />
              </TableCell>
              <TableCell>
                <SeverityBadge value={e.severity} />
              </TableCell>
              <TableCell>
                <StatusBadge status={e.status} />
              </TableCell>
              <TableCell className="max-w-md">
                <Link
                  href={`/monitoring/errors/${e.id}`}
                  className="block truncate text-[13px] font-medium text-foreground hover:text-primary"
                >
                  {e.title}
                </Link>
                {e.module && (
                  <span className="text-[11px] text-muted-foreground">{e.module}</span>
                )}
              </TableCell>
              <TableCell className="text-[12px] text-muted-foreground">
                {e.source}
              </TableCell>
              <TableCell className="text-[13px] text-foreground text-right tabular-nums">
                {e.occurrence_count}
              </TableCell>
              <TableCell className="text-[13px] text-muted-foreground text-right tabular-nums">
                {e.affected_tenants}
              </TableCell>
              <TableCell className="text-[12px] text-muted-foreground">
                {formatDateTime(e.last_seen_at)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
