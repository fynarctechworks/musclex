'use client';

import { Award, Users, Star, DollarSign } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from 'recharts';
import { KPICard } from '@/components/shared';
import { LoadingSkeleton } from '@/components/shared';
import { ReportTable } from './ReportTable';
import { formatCurrency, formatNumber, formatPercent } from '../utils/format';
import type { ReportColumn } from '../utils/export';
import type { TrainerAnalyticsRecord } from '../types';

interface TrainersTabProps {
  trainers: TrainerAnalyticsRecord[] | undefined;
  leaderboard: TrainerAnalyticsRecord[] | undefined;
  isLoading: boolean;
  isError?: boolean;
}

interface TrainerRow {
  id: string;
  rank: number;
  name: string;
  sessions: number;
  members: number;
  rating: number;
  no_show: number;
  revenue: number;
}

const tooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
  color: 'hsl(var(--foreground))',
};

export function TrainersTab({ trainers, leaderboard, isLoading, isError }: TrainersTabProps) {
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

  const allTrainers = trainers ?? [];
  const board = leaderboard ?? [];

  const totalSessions = allTrainers.reduce((sum, t) => sum + t.sessions_conducted, 0);
  const totalRevenue = allTrainers.reduce((sum, t) => sum + Number(t.revenue_generated), 0);
  const totalTrained = allTrainers.reduce((sum, t) => sum + t.members_trained, 0);
  const avgRating = allTrainers.length > 0
    ? allTrainers.reduce((sum, t) => sum + Number(t.average_rating), 0) / allTrainers.length
    : 0;

  // Leaderboard bar data
  const barData = board.slice(0, 10).map((t) => ({
    name: t.trainer
      ? `${t.trainer.first_name} ${t.trainer.last_name?.charAt(0) ?? ''}.`
      : t.trainer_id.slice(0, 8),
    revenue: Number(t.revenue_generated),
    sessions: t.sessions_conducted,
    members: t.members_trained,
  }));

  // Top trainer radar
  const topTrainer = board[0];
  const radarData = topTrainer
    ? [
        { metric: 'Sessions', value: topTrainer.sessions_conducted, max: Math.max(...board.map((t) => t.sessions_conducted)) },
        { metric: 'Members', value: topTrainer.members_trained, max: Math.max(...board.map((t) => t.members_trained)) },
        { metric: 'Revenue', value: Number(topTrainer.revenue_generated), max: Math.max(...board.map((t) => Number(t.revenue_generated))) },
        { metric: 'Rating', value: Number(topTrainer.average_rating) * 20, max: 100 },
        { metric: 'Reliability', value: Math.max(0, 100 - Number(topTrainer.no_show_rate)), max: 100 },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Total Sessions" value={formatNumber(totalSessions)} icon={Award} />
        <KPICard label="Members Trained" value={formatNumber(totalTrained)} icon={Users} />
        <KPICard label="Avg Rating" value={avgRating.toFixed(1)} icon={Star} />
        <KPICard label="Total Revenue" value={formatCurrency(totalRevenue)} icon={DollarSign} />
      </div>

      {/* Leaderboard Bar Chart */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="text-sm font-medium text-foreground mb-4">Trainer Leaderboard — Revenue</h3>
        {barData.length > 0 ? (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis type="category" dataKey="name" width={100} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="revenue" name="Revenue (₹)" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-8 text-center">No trainer data</p>
        )}
      </div>

      {/* Bottom Row: Radar + Full Table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Trainer Radar */}
        {topTrainer && radarData.length > 0 && (
          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="text-sm font-medium text-foreground mb-4">
              Top Trainer: {topTrainer.trainer?.first_name} {topTrainer.trainer?.last_name}
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis dataKey="metric" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <PolarRadiusAxis stroke="hsl(var(--border))" fontSize={10} />
                  <Radar
                    name="Performance"
                    dataKey="value"
                    stroke="hsl(var(--primary))"
                    fill="hsl(var(--primary))"
                    fillOpacity={0.3}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Trainer Table */}
        {(() => {
          const trainerRows: TrainerRow[] = board.map((t, i) => ({
            id: t.id,
            rank: i + 1,
            name: t.trainer ? `${t.trainer.first_name} ${t.trainer.last_name}` : '—',
            sessions: t.sessions_conducted,
            members: t.members_trained,
            rating: Number(t.average_rating),
            no_show: Number(t.no_show_rate),
            revenue: Number(t.revenue_generated),
          }));
          const cols: ReportColumn<TrainerRow>[] = [
            { key: 'rank', label: '#', numeric: true },
            { key: 'name', label: 'Trainer' },
            { key: 'sessions', label: 'Sessions', numeric: true, format: (r) => formatNumber(r.sessions) },
            { key: 'members', label: 'Members', numeric: true, format: (r) => formatNumber(r.members) },
            { key: 'rating', label: 'Rating', numeric: true, format: (r) => r.rating.toFixed(1) },
            { key: 'no_show', label: 'No-Show', numeric: true, format: (r) => formatPercent(r.no_show, 0) },
            { key: 'revenue', label: 'Revenue', numeric: true, format: (r) => formatCurrency(r.revenue) },
          ];
          return (
            <ReportTable
              title="All Trainers"
              columns={cols}
              rows={trainerRows}
              isLoading={isLoading}
              isError={isError}
              searchable
              searchPlaceholder="Search trainers..."
              rowKey={(r) => r.id}
              emptyText="No trainer data"
              pageSize={10}
            />
          );
        })()}
      </div>
    </div>
  );
}
