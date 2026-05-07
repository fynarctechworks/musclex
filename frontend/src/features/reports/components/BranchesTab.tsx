'use client';

import { useMemo } from 'react';
import { Building2, DollarSign, Users, CalendarCheck } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { KPICard, LoadingSkeleton } from '@/components/shared';
import { ReportTable } from './ReportTable';
import { formatCurrency, formatNumber, formatPercent } from '../utils/format';
import type { ReportColumn } from '../utils/export';
import type { BranchComparisonEntry } from '../types';

interface BranchesTabProps {
  branches: BranchComparisonEntry[] | undefined;
  /** Map of branch_id → display name. */
  branchNames?: Record<string, string>;
  isLoading: boolean;
  isError?: boolean;
}

const tooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
  color: 'hsl(var(--foreground))',
};

interface BranchRow {
  branch_id: string;
  branch: string;
  total_revenue: number;
  active_members: number;
  new_members: number;
  total_visits: number;
  revenue_share: number;
}

export function BranchesTab({ branches, branchNames = {}, isLoading, isError }: BranchesTabProps) {
  const rows: BranchRow[] = useMemo(() => {
    const list = branches ?? [];
    const totalRev = list.reduce((s, b) => s + Number(b._sum?.total_revenue ?? 0), 0);
    return list
      .map((b) => {
        const rev = Number(b._sum?.total_revenue ?? 0);
        const id = b.branch_id ?? 'unassigned';
        return {
          branch_id: id,
          branch:
            b.branch_name ??
            (b.branch_id ? branchNames[b.branch_id] ?? b.branch_id.slice(0, 8) : 'Unassigned'),
          total_revenue: rev,
          active_members: Math.round(Number(b._avg?.active_members ?? 0)),
          new_members: Number(b._sum?.new_members ?? 0),
          total_visits: Number(b._sum?.total_visits ?? 0),
          revenue_share: totalRev > 0 ? (rev / totalRev) * 100 : 0,
        };
      })
      .sort((a, b) => b.total_revenue - a.total_revenue);
  }, [branches, branchNames]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <LoadingSkeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
        <LoadingSkeleton className="h-80 rounded-lg" />
      </div>
    );
  }

  const totalRevenue = rows.reduce((s, r) => s + r.total_revenue, 0);
  const totalActive = rows.reduce((s, r) => s + r.active_members, 0);
  const totalNew = rows.reduce((s, r) => s + r.new_members, 0);
  const totalVisits = rows.reduce((s, r) => s + r.total_visits, 0);
  const topBranch = rows[0];

  const columns: ReportColumn<BranchRow>[] = [
    { key: 'branch', label: 'Branch' },
    { key: 'total_revenue', label: 'Revenue', numeric: true, format: (r) => formatCurrency(r.total_revenue) },
    { key: 'revenue_share', label: 'Share', numeric: true, format: (r) => formatPercent(r.revenue_share) },
    { key: 'active_members', label: 'Active', numeric: true, format: (r) => formatNumber(r.active_members) },
    { key: 'new_members', label: 'New', numeric: true, format: (r) => formatNumber(r.new_members) },
    { key: 'total_visits', label: 'Visits', numeric: true, format: (r) => formatNumber(r.total_visits) },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Branches"
          value={rows.length}
          icon={Building2}
        />
        <KPICard
          label="Total Revenue"
          value={formatCurrency(totalRevenue)}
          icon={DollarSign}
        />
        <KPICard
          label="Total Active Members"
          value={formatNumber(totalActive)}
          icon={Users}
        />
        <KPICard
          label="Top Branch"
          value={topBranch?.branch ?? '—'}
          icon={CalendarCheck}
        />
      </div>

      {/* Branch Comparison Bar */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="text-sm font-medium text-foreground mb-4">Branch Comparison</h3>
        {rows.length > 0 ? (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} margin={{ top: 10, right: 12, bottom: 40, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="branch"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  angle={-20}
                  textAnchor="end"
                  height={60}
                />
                <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
                <Bar yAxisId="left" dataKey="total_revenue" name="Revenue (₹)" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" dataKey="active_members" name="Active Members" fill="#34C77A" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" dataKey="total_visits" name="Visits" fill="#F59E0B" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No branch data available. This view is best for multi-branch operations.
          </p>
        )}
      </div>

      {/* Detailed Table */}
      <ReportTable
        title="Branch Performance"
        description="Sortable comparison across all branches"
        columns={columns}
        rows={rows}
        isError={isError}
        searchable
        searchPlaceholder="Search branch..."
        rowKey={(r) => r.branch_id}
        emptyText="No branch comparison data for this date range"
        totals={{
          branch: 'Total',
          total_revenue: formatCurrency(totalRevenue),
          revenue_share: '100.0%',
          active_members: formatNumber(totalActive),
          new_members: formatNumber(totalNew),
          total_visits: formatNumber(totalVisits),
        }}
      />
    </div>
  );
}

export type { BranchRow };
