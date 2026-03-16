'use client';

import { Mail, MousePointerClick, Target, DollarSign } from 'lucide-react';
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { KPICard } from '@/components/shared';
import { LoadingSkeleton } from '@/components/shared';
import type { CampaignAnalyticsResponse } from '../types';

interface MarketingTabProps {
  campaigns: CampaignAnalyticsResponse | undefined;
  isLoading: boolean;
}

const tooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
  color: 'hsl(var(--foreground))',
};

export function MarketingTab({ campaigns, isLoading }: MarketingTabProps) {
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

  const summary = campaigns?.summary;
  const records = campaigns?.records ?? [];

  // Funnel data
  const funnelData = [
    { stage: 'Sent', value: summary?.sent ?? 0, color: 'hsl(var(--primary))' },
    { stage: 'Opened', value: summary?.opened ?? 0, color: '#6BBFE8' },
    { stage: 'Clicked', value: summary?.clicked ?? 0, color: '#34C77A' },
    { stage: 'Converted', value: summary?.converted ?? 0, color: '#F59E0B' },
  ];

  // Per-campaign bar data
  const campaignBars = records.slice(0, 10).map((r) => ({
    name: r.campaign?.name ?? r.campaign_id.slice(0, 8),
    sent: r.sent,
    opened: r.opened,
    clicked: r.clicked,
    converted: r.converted,
  }));

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Open Rate"
          value={`${(summary?.open_rate ?? 0).toFixed(1)}%`}
          icon={Mail}
        />
        <KPICard
          label="Click Rate"
          value={`${(summary?.click_rate ?? 0).toFixed(1)}%`}
          icon={MousePointerClick}
        />
        <KPICard
          label="Conversion Rate"
          value={`${(summary?.conversion_rate ?? 0).toFixed(1)}%`}
          icon={Target}
        />
        <KPICard
          label="Revenue Generated"
          value={`₹${(summary?.revenue_generated ?? 0).toLocaleString()}`}
          icon={DollarSign}
        />
      </div>

      {/* Campaign Funnel */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="text-sm font-medium text-foreground mb-4">Campaign Funnel</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={funnelData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="stage" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="value" name="Count" fill="hsl(var(--primary))">
                {funnelData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Campaign Comparison */}
      {campaignBars.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-5">
          <h3 className="text-sm font-medium text-foreground mb-4">Campaign Performance</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={campaignBars}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
                <Bar dataKey="sent" name="Sent" fill="hsl(var(--primary))" />
                <Bar dataKey="opened" name="Opened" fill="#6BBFE8" />
                <Bar dataKey="clicked" name="Clicked" fill="#34C77A" />
                <Bar dataKey="converted" name="Converted" fill="#F59E0B" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Campaign Stats Table */}
      {records.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-5">
          <h3 className="text-sm font-medium text-foreground mb-4">All Campaigns</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left py-2 font-medium">Campaign</th>
                  <th className="text-right py-2 font-medium">Sent</th>
                  <th className="text-right py-2 font-medium">Opened</th>
                  <th className="text-right py-2 font-medium">Clicked</th>
                  <th className="text-right py-2 font-medium">Converted</th>
                  <th className="text-right py-2 font-medium">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id} className="border-b border-border/50">
                    <td className="py-2 text-foreground truncate max-w-[180px]">
                      {r.campaign?.name ?? '—'}
                    </td>
                    <td className="py-2 text-right text-foreground">{r.sent}</td>
                    <td className="py-2 text-right text-muted-foreground">{r.opened}</td>
                    <td className="py-2 text-right text-muted-foreground">{r.clicked}</td>
                    <td className="py-2 text-right text-muted-foreground">{r.converted}</td>
                    <td className="py-2 text-right text-muted-foreground">
                      ₹{Number(r.revenue_generated).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
