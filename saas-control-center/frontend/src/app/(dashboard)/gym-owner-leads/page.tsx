'use client';

import { useState } from 'react';
import {
  Building2,
  Mail,
  Phone,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  LEAD_STATUSES,
  useDeleteGymOwnerLead,
  useGymOwnerLeads,
  useUpdateGymOwnerLead,
  type GymOwnerLead,
  type LeadStatus,
} from '@/hooks/use-gym-owner-leads';

/**
 * Gym Owner Leads — enquiries from the public marketing website's contact form.
 *
 * Deliberately separate from Member App › Leads, which lists registered
 * consumer app users who have not joined a gym yet. These are prospective
 * TENANTS: gym owners evaluating MuscleX before they have an account.
 */

const STATUS_STYLES: Record<LeadStatus, string> = {
  NEW: 'bg-primary/10 text-primary',
  CONTACTED: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  QUALIFIED: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  CONVERTED: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  LOST: 'bg-muted text-muted-foreground',
};

const BRANCH_LABELS: Record<string, string> = {
  '1': '1 branch',
  '2-5': '2–5 branches',
  '6-20': '6–20 branches',
  '20+': '20+ branches',
};

export default function GymOwnerLeadsPage() {
  const [status, setStatus] = useState<LeadStatus | 'ALL'>('ALL');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<GymOwnerLead | null>(null);

  const { data, isLoading } = useGymOwnerLeads({ status, search, page });
  const update = useUpdateGymOwnerLead();
  const remove = useDeleteGymOwnerLead();

  const counts = data?.meta.statusCounts ?? {};
  const totalAll = Object.values(counts).reduce((a, b) => a + b, 0);

  const applySearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  return (
    <div>
      <PageHeader
        title="Gym Owner Leads"
        description="Enquiries from gym owners submitted on the marketing website"
      />

      {/* Status filter chips */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(['ALL', ...LEAD_STATUSES] as const).map((value) => {
          const count = value === 'ALL' ? totalAll : (counts[value] ?? 0);
          const isActive = status === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => {
                setStatus(value);
                setPage(1);
              }}
              className={cn(
                'rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground',
              )}
            >
              {value === 'ALL' ? 'All' : value.charAt(0) + value.slice(1).toLowerCase()}
              <span className="ml-1.5 tabular-nums opacity-70">{count}</span>
            </button>
          );
        })}

        <form
          className="ml-auto flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            applySearch(searchInput.trim());
          }}
        >
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Name, studio, email or phone"
              className="h-9 w-[240px] pl-8 text-[13px]"
            />
          </div>
          {search ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchInput('');
                applySearch('');
              }}
            >
              Clear
            </Button>
          ) : null}
        </form>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Studio</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Topic</TableHead>
              <TableHead>Received</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : !data?.data.length ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center">
                  <Building2 className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
                  <p className="text-[13px] font-medium">No enquiries yet</p>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">
                    Submissions from the marketing site&apos;s contact form land here.
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              data.data.map((lead) => (
                <TableRow
                  key={lead.id}
                  className="cursor-pointer"
                  onClick={() => setSelected(lead)}
                >
                  <TableCell>
                    <div className="font-medium text-foreground">{lead.studio_name}</div>
                    <div className="text-[12px] text-muted-foreground">{lead.name}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-[12px]">{lead.email}</div>
                    <div className="text-[12px] text-muted-foreground">{lead.phone}</div>
                  </TableCell>
                  <TableCell className="text-[12px] text-muted-foreground">
                    {lead.branches ? (BRANCH_LABELS[lead.branches] ?? lead.branches) : '—'}
                  </TableCell>
                  <TableCell className="text-[12px] text-muted-foreground">
                    {lead.topic ?? '—'}
                  </TableCell>
                  <TableCell className="text-[12px] text-muted-foreground">
                    {new Date(lead.created_at).toLocaleDateString(undefined, {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </TableCell>
                  <TableCell>
                    <Badge className={cn('font-medium', STATUS_STYLES[lead.status])}>
                      {lead.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {data && data.meta.totalPages > 1 ? (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-[12px] text-muted-foreground">
            Page {data.meta.page} of {data.meta.totalPages} · {data.meta.total} total
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= data.meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}

      {/* Detail drawer */}
      {selected ? (
        <LeadDetail
          lead={selected}
          onClose={() => setSelected(null)}
          onStatusChange={(next) =>
            update.mutate(
              { id: selected.id, status: next },
              { onSuccess: (updated) => setSelected(updated) },
            )
          }
          onNotesSave={(notes) =>
            update.mutate(
              { id: selected.id, notes },
              { onSuccess: (updated) => setSelected(updated) },
            )
          }
          onDelete={() => {
            remove.mutate(selected.id);
            setSelected(null);
          }}
          saving={update.isPending}
        />
      ) : null}
    </div>
  );
}

function LeadDetail({
  lead,
  onClose,
  onStatusChange,
  onNotesSave,
  onDelete,
  saving,
}: {
  lead: GymOwnerLead;
  onClose: () => void;
  onStatusChange: (status: LeadStatus) => void;
  onNotesSave: (notes: string) => void;
  onDelete: () => void;
  saving: boolean;
}) {
  const [notes, setNotes] = useState(lead.notes ?? '');

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <aside
        className="h-full w-full max-w-[520px] overflow-y-auto border-l border-border bg-card p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">{lead.studio_name}</h2>
            <p className="text-[13px] text-muted-foreground">{lead.name}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            <a
              href={`mailto:${lead.email}`}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[12px] hover:bg-muted"
            >
              <Mail className="h-3.5 w-3.5" />
              {lead.email}
            </a>
            <a
              href={`tel:${lead.phone}`}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[12px] hover:bg-muted"
            >
              <Phone className="h-3.5 w-3.5" />
              {lead.phone}
            </a>
          </div>

          <dl className="grid grid-cols-2 gap-4 rounded-lg bg-muted/50 p-4 text-[12px]">
            <div>
              <dt className="text-muted-foreground">Size</dt>
              <dd className="mt-0.5 font-medium">
                {lead.branches ? (BRANCH_LABELS[lead.branches] ?? lead.branches) : 'Not given'}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Topic</dt>
              <dd className="mt-0.5 font-medium">{lead.topic ?? 'Not given'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Received</dt>
              <dd className="mt-0.5 font-medium">
                {new Date(lead.created_at).toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Source</dt>
              <dd className="mt-0.5 font-medium">{lead.source}</dd>
            </div>
          </dl>

          <div>
            <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
              Message
            </h3>
            <p className="whitespace-pre-wrap rounded-lg border border-border p-3 text-[13px] leading-relaxed">
              {lead.message}
            </p>
          </div>

          <div>
            <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
              Status
            </h3>
            <Select value={lead.status} onValueChange={(v) => onStatusChange(v as LeadStatus)}>
              <SelectTrigger className="h-9 text-[13px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEAD_STATUSES.map((s) => (
                  <SelectItem key={s} value={s} className="text-[13px]">
                    {s.charAt(0) + s.slice(1).toLowerCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
              Internal notes
            </h3>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={5}
              placeholder="Call outcome, next step, who owns this…"
              className="w-full rounded-md border border-border bg-background p-3 text-[13px] focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="mt-2 flex justify-end">
              <Button
                size="sm"
                onClick={() => onNotesSave(notes)}
                disabled={saving || notes === (lead.notes ?? '')}
              >
                {saving ? 'Saving…' : 'Save notes'}
              </Button>
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => {
                if (confirm('Delete this enquiry? This cannot be undone.')) onDelete();
              }}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Delete enquiry
            </Button>
          </div>
        </div>
      </aside>
    </div>
  );
}
