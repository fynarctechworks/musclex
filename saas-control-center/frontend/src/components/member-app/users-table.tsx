'use client';

import { useState } from 'react';
import { Search, Download } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/shared/error-state';
import { useMemberAppUsers } from '@/hooks/use-member-app';
import { API_URL } from '@/lib/constants';

const STATUS_TONE: Record<string, string> = {
  member: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  expired: 'bg-red-50 text-red-700 border-red-200',
  lead: 'bg-blue-50 text-blue-700 border-blue-200',
};
const USAGE_TONE: Record<string, string> = {
  high: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  recent: 'bg-amber-50 text-amber-700 border-amber-200',
  dormant: 'bg-muted text-muted-foreground border-border',
};

function fmtDate(d: string | null) {
  return d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
}

export function UsersTable({
  type,
  showExport,
}: {
  type: 'leads' | 'crm';
  showExport?: boolean;
}) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, refetch } = useMemberAppUsers(type, {
    search: search || undefined,
    page,
  });

  const exportCsv = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('scc_access_token') : null;
    const qs = search ? `?search=${encodeURIComponent(search)}` : '';
    // Authenticated download via fetch → blob (Authorization header required).
    fetch(`${API_URL}/member-app/leads/export${qs}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'leads.csv';
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch(() => {});
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search name, phone, city…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-8"
          />
        </div>
        {showExport && (
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="mr-1.5 h-4 w-4" />
            Export CSV
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-10 rounded" />
          ))}
        </div>
      ) : isError ? (
        <div className="p-6">
          <ErrorState title="Could not load users" onRetry={() => refetch()} />
        </div>
      ) : !data || data.items.length === 0 ? (
        <div className="p-10 text-center text-[13px] text-muted-foreground">
          No {type === 'leads' ? 'leads' : 'users'} found.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead>Onboarding</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Registered</TableHead>
                  <TableHead>Last Active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium text-foreground">{u.name}</TableCell>
                    <TableCell className="font-mono text-[12px]">{u.phone}</TableCell>
                    <TableCell>{u.city}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_TONE[u.membershipStatus]}>
                        {u.membershipStatus}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={USAGE_TONE[u.usage] ?? ''}>
                        {u.usage}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-[12px] text-muted-foreground">
                      {u.onboardingStatus}
                    </TableCell>
                    <TableCell className="text-[12px] text-muted-foreground">
                      {u.referralSource}
                    </TableCell>
                    <TableCell className="text-[12px] text-muted-foreground">
                      {fmtDate(u.registeredAt)}
                    </TableCell>
                    <TableCell className="text-[12px] text-muted-foreground">
                      {fmtDate(u.lastActiveAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between border-t border-border p-3 text-[13px] text-muted-foreground">
            <span>
              {data.total} total · page {data.page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
