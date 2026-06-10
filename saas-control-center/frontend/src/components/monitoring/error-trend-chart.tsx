'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { ErrorStats } from '@/types/monitoring';

interface Props {
  trend: ErrorStats['trend'];
}

function formatDay(date: string) {
  return new Date(date).toLocaleDateString('en-IN', {
    month: 'short',
    day: 'numeric',
  });
}

export function ErrorTrendChart({ trend }: Props) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <h3 className="text-base font-semibold text-foreground mb-4">
        Occurrences (last 14 days)
      </h3>
      <div className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={trend}>
            <defs>
              <linearGradient id="errors" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="date"
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickFormatter={formatDay}
            />
            <YAxis
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                color: 'hsl(var(--foreground))',
              }}
              labelFormatter={(l) => formatDay(String(l))}
              formatter={(value) => [Number(value), 'Occurrences']}
            />
            <Area
              type="monotone"
              dataKey="count"
              stroke="hsl(var(--destructive))"
              fill="url(#errors)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
