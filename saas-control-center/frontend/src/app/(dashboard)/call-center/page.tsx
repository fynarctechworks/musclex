'use client';

import { useState } from 'react';
import { Search, Phone, Building2, Users, CreditCard, Calendar, CheckCircle2, AlertCircle, Loader2, Copy } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import api from '@/lib/api';
import { toast } from 'sonner';

interface TenantDetail {
  id: string;
  name: string;
  slug: string;
  owner_name: string;
  owner_email: string;
  phone?: string;
  status: string;
  is_active: boolean;
  trial_ends_at?: string;
  last_active_at?: string;
  created_at: string;
  // Effective limits live on the tenant record (scc.tenants), not on the plan.
  max_branches: number;
  max_members: number;
  max_staff: number;
  plan?: { id: string; name: string; price_monthly: number };
  subscriptions: Array<{ id: string; status: string; start_date: string; end_date: string; plan?: { name: string } }>;
  payments: Array<{ id: string; amount: number; currency: string; status: string; created_at: string; gateway?: string }>;
}

function fmtDate(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtMoney(amount: number, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
}

function fmtLimit(value: number | undefined | null, unlimitedAt: number) {
  if (value === undefined || value === null) return '—';
  if (value >= unlimitedAt) return 'Unlimited';
  return value.toLocaleString();
}

function CopyBtn({ value }: { value: string }) {
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(value); toast.success('Copied'); }}
      className="ml-1.5 text-muted-foreground hover:text-foreground transition-colors"
    >
      <Copy className="h-3 w-3" />
    </button>
  );
}

function InfoRow({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between py-2 border-b border-border last:border-0">
      <span className="text-[12px] text-muted-foreground w-36 shrink-0">{label}</span>
      <span className={`text-[13px] text-foreground text-right ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}

export default function CallCenterPage() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TenantDetail | null>(null);
  const [error, setError] = useState('');

  const handleSearch = async () => {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const { data } = await api.get(`/tenants/search?q=${encodeURIComponent(q)}`);
      setResult(data.data ?? data);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Gym not found');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Call Center"
        description="Search any gym by ID or slug to view full details"
      />

      {/* Search bar */}
      <div className="flex gap-3 mb-8 max-w-xl">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Enter Gym ID (UUID) or slug e.g. powerfit-gym"
            className="pl-9 h-10 text-[13px] font-mono"
          />
        </div>
        <Button onClick={handleSearch} disabled={loading} className="h-10 px-5 text-[13px]">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-destructive text-[13px] mb-4">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-5">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-[20px] font-bold text-foreground">{result.name}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[12px] font-mono text-muted-foreground">{result.id}</span>
                <CopyBtn value={result.id} />
                <span className="text-muted-foreground">·</span>
                <span className="text-[12px] text-muted-foreground">/{result.slug}</span>
                <CopyBtn value={result.slug} />
              </div>
            </div>
            <StatusBadge status={result.status} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Owner Info */}
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <Building2 className="h-4 w-4 text-primary" />
                <h3 className="text-[13px] font-semibold text-foreground">Owner Info</h3>
              </div>
              <InfoRow label="Name" value={result.owner_name} />
              <InfoRow label="Email" value={<span className="flex items-center">{result.owner_email}<CopyBtn value={result.owner_email} /></span>} />
              <InfoRow label="Phone" value={result.phone || '—'} />
              <InfoRow label="Joined" value={fmtDate(result.created_at)} />
              <InfoRow label="Last Active" value={fmtDate(result.last_active_at)} />
              <InfoRow label="Active" value={result.is_active ? <CheckCircle2 className="h-4 w-4 text-success" /> : <AlertCircle className="h-4 w-4 text-destructive" />} />
            </div>

            {/* Plan Info */}
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <CreditCard className="h-4 w-4 text-primary" />
                <h3 className="text-[13px] font-semibold text-foreground">Plan & Limits</h3>
              </div>
              {result.plan ? (
                <>
                  <InfoRow label="Plan" value={<span className="font-semibold capitalize">{result.plan.name}</span>} />
                  <InfoRow label="Price" value={fmtMoney(Number(result.plan.price_monthly))} />
                  <InfoRow label="Max Branches" value={fmtLimit(result.max_branches, 999)} />
                  <InfoRow label="Max Members" value={fmtLimit(result.max_members, 99999)} />
                  <InfoRow label="Max Staff" value={fmtLimit(result.max_staff, 999)} />
                  <InfoRow label="Trial Ends" value={fmtDate(result.trial_ends_at)} />
                </>
              ) : (
                <p className="text-[12px] text-muted-foreground mt-2">No plan assigned</p>
              )}
            </div>

            {/* Subscription Status */}
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="h-4 w-4 text-primary" />
                <h3 className="text-[13px] font-semibold text-foreground">Subscriptions</h3>
              </div>
              {result.subscriptions.length > 0 ? result.subscriptions.map((sub) => (
                <div key={sub.id} className="mb-2 pb-2 border-b border-border last:border-0">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-mono text-muted-foreground">{sub.status}</span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                      sub.status === 'ACTIVE' ? 'bg-success/10 text-success' :
                      sub.status === 'TRIALING' ? 'bg-amber-500/10 text-amber-600' :
                      'bg-muted text-muted-foreground'
                    }`}>{sub.status}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {fmtDate(sub.start_date)} → {fmtDate(sub.end_date)}
                  </p>
                </div>
              )) : (
                <p className="text-[12px] text-muted-foreground mt-2">No subscriptions yet</p>
              )}
            </div>
          </div>

          {/* Payment History */}
          {result.payments.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <Users className="h-4 w-4 text-primary" />
                <h3 className="text-[13px] font-semibold text-foreground">Recent Payments</h3>
              </div>
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left pb-2 text-muted-foreground font-medium">Amount</th>
                    <th className="text-left pb-2 text-muted-foreground font-medium">Gateway</th>
                    <th className="text-left pb-2 text-muted-foreground font-medium">Status</th>
                    <th className="text-left pb-2 text-muted-foreground font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {result.payments.map((p) => (
                    <tr key={p.id} className="border-b border-border last:border-0">
                      <td className="py-2 font-semibold">{fmtMoney(p.amount, p.currency)}</td>
                      <td className="py-2 text-muted-foreground">{p.gateway || '—'}</td>
                      <td className="py-2">
                        <span className={`px-2 py-0.5 rounded-full font-medium ${
                          p.status === 'PAID' ? 'bg-success/10 text-success' :
                          p.status === 'FAILED' ? 'bg-destructive/10 text-destructive' :
                          'bg-muted text-muted-foreground'
                        }`}>{p.status}</span>
                      </td>
                      <td className="py-2 text-muted-foreground">{fmtDate(p.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!result && !error && !loading && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-4">
            <Phone className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-[14px] font-medium text-foreground">Search for a gym</p>
          <p className="text-[12px] text-muted-foreground mt-1">
            Enter a Gym ID (UUID) or slug to load all information about that studio
          </p>
        </div>
      )}
    </div>
  );
}
