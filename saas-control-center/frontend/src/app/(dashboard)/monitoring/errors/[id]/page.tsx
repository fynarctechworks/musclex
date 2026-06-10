'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { LoadingSkeleton } from '@/components/shared/loading-skeleton';
import { ErrorState } from '@/components/shared/error-state';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SeverityBadge } from '@/components/monitoring/severity-badge';
import { StatusBadge } from '@/components/shared/status-badge';
import { StackTrace } from '@/components/monitoring/stack-trace';
import { useSystemError, useUpdateError } from '@/hooks/use-system-errors';
import type {
  ErrorOccurrence,
  ErrorSeverity,
  ErrorStatus,
} from '@/types/monitoring';

const STATUSES: ErrorStatus[] = [
  'OPEN',
  'INVESTIGATING',
  'RESOLVED',
  'IGNORED',
  'REOPENED',
];
const SEVERITIES: ErrorSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];

function fmt(date?: string | null) {
  return date ? new Date(date).toLocaleString('en-IN') : '—';
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground mb-3">
        {title}
      </h3>
      {children}
    </div>
  );
}

function JsonBlock({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return <p className="text-[13px] text-muted-foreground">None</p>;
  }
  return (
    <pre className="overflow-x-auto rounded-md border border-border bg-muted/30 p-3 text-[12px] font-mono text-muted-foreground whitespace-pre-wrap">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-[13px] border-b border-border/50 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground text-right break-all">{value}</span>
    </div>
  );
}

function OccurrenceDetail({ occ }: { occ: ErrorOccurrence }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
        <MetaRow label="When" value={fmt(occ.occurred_at)} />
        <MetaRow label="Gym / tenant" value={occ.tenant_id || '—'} />
        <MetaRow label="User" value={occ.user_id || '—'} />
        <MetaRow label="Page" value={occ.page || '—'} />
        <MetaRow label="API endpoint" value={occ.api_endpoint || '—'} />
        <MetaRow label="HTTP status" value={occ.http_status ?? '—'} />
        <MetaRow label="App version" value={occ.app_version || '—'} />
        <MetaRow label="IP" value={occ.ip_address || '—'} />
        <MetaRow
          label="Browser"
          value={
            occ.browser_info
              ? `${String(occ.browser_info.name ?? '')} ${String(occ.browser_info.version ?? '')}`.trim() ||
                '—'
              : '—'
          }
        />
        <MetaRow
          label="Device"
          value={
            occ.device_info
              ? `${String(occ.device_info.os ?? '')} ${String(occ.device_info.screen ?? '')}`.trim() ||
                '—'
              : '—'
          }
        />
      </div>
      <StackTrace stack={occ.stack_trace} defaultOpen />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div>
          <p className="text-[12px] font-medium text-muted-foreground mb-1">
            Request payload
          </p>
          <JsonBlock value={occ.request_payload} />
        </div>
        <div>
          <p className="text-[12px] font-medium text-muted-foreground mb-1">
            Response payload
          </p>
          <JsonBlock value={occ.response_payload} />
        </div>
      </div>
      {occ.breadcrumbs ? (
        <div>
          <p className="text-[12px] font-medium text-muted-foreground mb-1">
            User activity (breadcrumbs)
          </p>
          <JsonBlock value={occ.breadcrumbs} />
        </div>
      ) : null}
    </div>
  );
}

export default function ErrorDetailPage() {
  const params = useParams();
  const id = String(params.id);
  const { data: error, isLoading, isError, refetch } = useSystemError(id);
  const update = useUpdateError(id);

  const [status, setStatus] = useState<ErrorStatus | ''>('');
  const [severity, setSeverity] = useState<ErrorSeverity | ''>('');
  const [note, setNote] = useState('');

  if (isLoading) return <LoadingSkeleton rows={8} />;
  if (isError || !error) {
    return (
      <ErrorState
        title="Could not load error"
        description="The request failed. Check the backend and retry."
        onRetry={() => refetch()}
      />
    );
  }

  const latest = error.occurrences[0];

  const save = async () => {
    await update.mutateAsync({
      ...(status ? { status } : {}),
      ...(severity ? { severity } : {}),
      ...(note ? { resolution_note: note } : {}),
    });
    setStatus('');
    setSeverity('');
    setNote('');
    refetch();
  };

  return (
    <div>
      <Link
        href="/monitoring/errors"
        className="inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground mb-3"
      >
        <ArrowLeft className="h-4 w-4" /> Back to errors
      </Link>

      <PageHeader
        title={error.title}
        description={`${error.source}${error.module ? ` · ${error.module}` : ''} · ${error.environment}`}
        action={
          <div className="flex items-center gap-2">
            <SeverityBadge value={error.severity} />
            <StatusBadge status={error.status} />
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Section title="Message">
            <p className="text-[13px] text-foreground break-words">{error.message}</p>
          </Section>

          <Section title="Latest occurrence">
            {latest ? (
              <OccurrenceDetail occ={latest} />
            ) : (
              <p className="text-[13px] text-muted-foreground">No occurrences recorded.</p>
            )}
          </Section>

          <Section title={`Activity timeline (${error.activities.length})`}>
            {error.activities.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">No activity yet.</p>
            ) : (
              <ul className="space-y-2">
                {error.activities.map((a) => (
                  <li key={a.id} className="text-[13px]">
                    <span className="font-medium text-foreground">{a.action}</span>
                    {a.from_value || a.to_value ? (
                      <span className="text-muted-foreground">
                        {' '}
                        {a.from_value ?? '—'} → {a.to_value ?? '—'}
                      </span>
                    ) : null}
                    {a.note ? (
                      <span className="text-muted-foreground"> · {a.note}</span>
                    ) : null}
                    <span className="text-[11px] text-muted-foreground ml-1">
                      {fmt(a.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        <div className="space-y-4">
          <Section title="Summary">
            <div className="grid grid-cols-1 gap-1">
              <MetaRow label="Occurrences" value={error.occurrence_count} />
              <MetaRow label="Affected gyms" value={error.affected_tenants} />
              <MetaRow label="Affected users" value={error.affected_users} />
              <MetaRow label="First seen" value={fmt(error.first_seen_at)} />
              <MetaRow label="Last seen" value={fmt(error.last_seen_at)} />
              <MetaRow
                label="Release"
                value={error.release ? `${error.release.app}@${error.release.version}` : '—'}
              />
              <MetaRow label="Resolved at" value={fmt(error.resolved_at)} />
            </div>
          </Section>

          <Section title="Resolution">
            <div className="space-y-3">
              <div>
                <p className="text-[12px] text-muted-foreground mb-1">Status</p>
                <Select value={status} onValueChange={(v) => setStatus(v as ErrorStatus)}>
                  <SelectTrigger>
                    <SelectValue placeholder={error.status} />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="text-[12px] text-muted-foreground mb-1">Severity</p>
                <Select
                  value={severity}
                  onValueChange={(v) => setSeverity(v as ErrorSeverity)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={error.severity} />
                  </SelectTrigger>
                  <SelectContent>
                    {SEVERITIES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="text-[12px] text-muted-foreground mb-1">Resolution note</p>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder={error.resolution_note ?? 'Add a note…'}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <Button
                onClick={save}
                disabled={update.isPending || (!status && !severity && !note)}
                className="w-full"
              >
                {update.isPending ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
