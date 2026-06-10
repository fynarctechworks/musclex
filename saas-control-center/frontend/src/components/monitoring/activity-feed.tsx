'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { SeverityBadge } from './severity-badge';
import type { LiveErrorEvent } from '@/types/monitoring';

interface Props {
  events: LiveErrorEvent[];
  connected: boolean;
}

const KIND_LABEL: Record<LiveErrorEvent['kind'], string> = {
  new: 'New error',
  updated: 'Recurred',
  alert: 'Critical alert',
};

function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export function ActivityFeed({ events, connected }: Props) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-foreground">Live Activity</h3>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
          <span
            className={cn(
              'h-2 w-2 rounded-full',
              connected ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400',
            )}
          />
          {connected ? 'Connected' : 'Offline'}
        </span>
      </div>

      {events.length === 0 ? (
        <p className="text-[13px] text-muted-foreground py-8 text-center">
          Waiting for live events…
        </p>
      ) : (
        <ul className="space-y-2 max-h-[420px] overflow-y-auto">
          {events.map((e, i) => (
            <li
              key={`${e.error_id}-${e.at}-${i}`}
              className="flex items-start gap-3 rounded-md border border-border/60 p-2.5"
            >
              <SeverityBadge value={e.severity} />
              <div className="min-w-0 flex-1">
                <Link
                  href={`/monitoring/errors/${e.error_id}`}
                  className="block truncate text-[13px] font-medium text-foreground hover:text-primary"
                >
                  {e.title || e.fingerprint.slice(0, 12)}
                </Link>
                <p className="text-[11px] text-muted-foreground">
                  {KIND_LABEL[e.kind]}
                  {e.source ? ` · ${e.source}` : ''}
                  {e.tenant_id ? ` · ${e.tenant_id}` : ''} · {timeAgo(e.at)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
