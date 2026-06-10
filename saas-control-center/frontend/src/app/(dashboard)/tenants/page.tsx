'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { AddTenantModal } from './add-tenant-modal';
import {
  useTenants,
  useTenant,
  useTenantOperational,
  useSuspendTenant,
  useActivateTenant,
  useChangeTenantPlan,
  useImpersonateTenant,
  useSyncTenants,
} from '@/hooks/use-tenants';
import { useAssignablePlans } from '@/hooks/use-plans';
import { useFeatureFlags, useSetTenantFlag } from '@/hooks/use-feature-flags';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { LoadingSkeleton } from '@/components/shared/loading-skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import {
  Search,
  MoreHorizontal,
  Plus,
  Ban,
  CheckCircle,
  Eye,
  Phone,
  Mail,
  Building2,
  Calendar,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Users,
  Package,
  RefreshCw,
  MapPin,
  TrendingUp,
  Wallet,
  UserCog,
  AlertTriangle,
  type LucideIcon,
} from 'lucide-react';
import type { Tenant, TenantOperationalDetail } from '@/types';

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatCurrency(amount: number, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatAccountType(type?: string) {
  if (!type) return '—';
  if (type === 'gym') return 'Gym / Studio';
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function OpKpi({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[10px] font-medium uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-xl font-semibold text-foreground mt-1.5 leading-none">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

function UsageBar({
  label,
  used,
  max,
}: {
  label: string;
  used?: number;
  max?: number;
}) {
  const ratio = max && max > 0 && used != null ? Math.min(used / max, 1) : 0;
  const danger = ratio >= 0.9 && ratio > 0;
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-foreground font-medium">
          {used != null ? used.toLocaleString('en-IN') : '—'}
          <span className="text-muted-foreground">
            {' '}
            / {max != null ? max.toLocaleString('en-IN') : '∞'}
          </span>
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full ${danger ? 'bg-red-500' : 'bg-primary'}`}
          style={{ width: `${Math.round(ratio * 100)}%` }}
        />
      </div>
    </div>
  );
}

function OperationalSection({
  op,
  isLoading,
}: {
  op?: TenantOperationalDetail;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-[88px] rounded-xl border border-border bg-muted/30 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!op || !op.available) {
    const msg =
      op?.reason === 'not_linked'
        ? 'This tenant isn’t linked to a live gym yet. Use “Sync from app” on the Tenants list to connect it.'
        : op?.reason === 'unreachable'
          ? 'The gym’s live data could not be reached right now.'
          : 'Live gym data is unavailable for this tenant.';
    return (
      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800">
        <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
        <p className="text-[12px]">{msg}</p>
      </div>
    );
  }

  const cur = op.revenue?.currency ?? 'INR';
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <OpKpi
        icon={Users}
        label="Members"
        value={(op.members?.total ?? 0).toLocaleString('en-IN')}
        sub={`${op.members?.active ?? 0} active`}
      />
      <OpKpi
        icon={Building2}
        label="Branches"
        value={(op.branches?.length ?? 0).toLocaleString('en-IN')}
      />
      <OpKpi
        icon={UserCog}
        label="Staff"
        value={(op.staff?.total ?? 0).toLocaleString('en-IN')}
        sub={`${op.staff?.active ?? 0} active`}
      />
      <OpKpi
        icon={Wallet}
        label="Revenue"
        value={formatCurrency(op.revenue?.total ?? 0, cur)}
        sub={`${op.revenue?.paidCount ?? 0} payments`}
      />
      <OpKpi
        icon={TrendingUp}
        label="Last 30d"
        value={formatCurrency(op.revenue?.last30Days ?? 0, cur)}
      />
    </div>
  );
}

function TenantDetailDrawer({
  tenantId,
  open,
  onClose,
}: {
  tenantId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const [showMore, setShowMore] = useState(false);
  const [planChoice, setPlanChoice] = useState('');
  const { data: tenant, isLoading } = useTenant(tenantId ?? '');
  const { data: op, isLoading: opLoading } = useTenantOperational(tenantId);
  const suspend = useSuspendTenant();
  const activate = useActivateTenant();
  const changePlan = useChangeTenantPlan();
  const impersonate = useImpersonateTenant();
  const { data: assignablePlans } = useAssignablePlans();
  const { data: allFlags } = useFeatureFlags();
  const setTenantFlag = useSetTenantFlag();

  useEffect(() => {
    if (!open) {
      setShowMore(false);
      setPlanChoice('');
    }
  }, [open]);

  const overrides: Array<{ flag_id: string; enabled: boolean }> =
    (tenant as any)?.feature_flags ?? [];
  const overrideFor = (flagId: string, fallback: boolean) =>
    overrides.find((o) => o.flag_id === flagId)?.enabled ?? fallback;

  const handleImpersonate = (id: string) => {
    impersonate.mutate(id, {
      onSuccess: (d) => {
        if (d?.token) {
          navigator.clipboard.writeText(d.token);
          toast.success('Impersonation token copied to clipboard');
        } else {
          toast.success('Impersonation token generated');
        }
      },
      onError: (e: Error) => toast.error(e.message || 'Could not generate token'),
    });
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto gap-0 px-7 py-6">
        {isLoading ? (
          <div>
            <LoadingSkeleton rows={6} />
          </div>
        ) : !tenant ? null : (
          <>
            <SheetHeader className="p-0 pb-5 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                  {tenant.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <SheetTitle className="text-[16px]">{tenant.name}</SheetTitle>
                  <p className="text-[12px] text-muted-foreground mt-0.5">{tenant.slug}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <StatusBadge status={tenant.status} />
                {tenant.plan && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    <Package className="h-3 w-3" />
                    {tenant.plan.name}
                  </span>
                )}
              </div>
            </SheetHeader>

            <div className="py-5 space-y-7">
              {/* Live operational snapshot */}
              <section>
                <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Live Snapshot
                </h3>
                <OperationalSection op={op} isLoading={opLoading} />
              </section>

              {/* Contact Information */}
              <section>
                <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Contact Information
                </h3>
                <div className="space-y-2.5">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                      <Users className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-[13px] font-medium text-foreground">{tenant.owner_name}</p>
                      <p className="text-[11px] text-muted-foreground">Owner</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <a
                        href={`mailto:${tenant.owner_email}`}
                        className="text-[13px] font-medium text-primary hover:underline"
                      >
                        {tenant.owner_email}
                      </a>
                      <p className="text-[11px] text-muted-foreground">Email address</p>
                    </div>
                  </div>
                  {tenant.phone ? (
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <a
                          href={`tel:${tenant.phone}`}
                          className="text-[13px] font-medium text-primary hover:underline"
                        >
                          {tenant.phone}
                        </a>
                        <p className="text-[11px] text-muted-foreground">Phone number</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 opacity-50">
                      <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <p className="text-[13px] text-muted-foreground italic">No phone number on file</p>
                    </div>
                  )}
                </div>
              </section>

              {/* Plan & Limits — actual usage vs plan ceiling */}
              <section>
                <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Usage vs Plan Limits
                </h3>
                <div className="space-y-3">
                  <UsageBar
                    label="Members"
                    used={op?.available ? op.members?.total : undefined}
                    max={tenant.max_members}
                  />
                  <UsageBar
                    label="Branches"
                    used={op?.available ? op.branches?.length : undefined}
                    max={tenant.max_branches}
                  />
                  <UsageBar
                    label="Staff"
                    used={op?.available ? op.staff?.total : undefined}
                    max={tenant.max_staff}
                  />
                </div>

                {/* Change plan */}
                <div className="mt-4 flex items-end gap-2">
                  <div className="flex-1 space-y-1">
                    <p className="text-[11px] text-muted-foreground">Change plan</p>
                    <Select value={planChoice} onValueChange={(v) => setPlanChoice(v || '')}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Select a plan…" />
                      </SelectTrigger>
                      <SelectContent>
                        {assignablePlans?.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            <span className="capitalize">{p.name}</span>
                            {p.price_monthly > 0 ? ` — ₹${p.price_monthly}/mo` : ' — Free'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    size="sm"
                    disabled={!planChoice || planChoice === tenant.plan_id || changePlan.isPending}
                    onClick={() =>
                      changePlan.mutate(
                        { id: tenant.id, plan_id: planChoice },
                        {
                          onSuccess: () => { toast.success('Plan changed'); setPlanChoice(''); },
                          onError: (e: Error) => toast.error(e.message || 'Failed to change plan'),
                        },
                      )
                    }
                  >
                    Apply
                  </Button>
                </div>
              </section>

              {/* Branches — per-branch operational detail */}
              {op?.available && op.branches && op.branches.length > 0 && (
                <section>
                  <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    Branches ({op.branches.length})
                  </h3>
                  <div className="space-y-2">
                    {op.branches.map((b) => (
                      <div key={b.id} className="rounded-lg border border-border p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <Building2 className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                              <p className="text-[13px] font-medium text-foreground truncate">
                                {b.name}
                              </p>
                              {b.status && b.status !== 'active' && (
                                <span className="text-[10px] text-amber-600 capitalize">
                                  {b.status.replace(/_/g, ' ')}
                                </span>
                              )}
                            </div>
                            {b.address && (
                              <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                                <MapPin className="h-3 w-3 flex-shrink-0" />
                                <span className="truncate">{b.address}</span>
                              </p>
                            )}
                            {b.phone && (
                              <a
                                href={`tel:${b.phone}`}
                                className="text-[11px] text-primary hover:underline flex items-center gap-1 mt-0.5"
                              >
                                <Phone className="h-3 w-3" />
                                {b.phone}
                              </a>
                            )}
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-[13px] font-semibold text-foreground">
                              {formatCurrency(b.revenue, op.revenue?.currency ?? 'INR')}
                            </p>
                            <p className="text-[10px] text-muted-foreground">revenue</p>
                          </div>
                        </div>
                        <div className="flex gap-4 mt-2 text-[11px] text-muted-foreground">
                          <span>
                            <span className="text-foreground font-medium">{b.memberCount}</span> members
                            {b.activeMemberCount != null && ` (${b.activeMemberCount} active)`}
                          </span>
                          <span>
                            <span className="text-foreground font-medium">{b.staffCount}</span> staff
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Timeline */}
              <section>
                <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Timeline
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      Joined
                    </div>
                    <span className="text-[13px] font-medium text-foreground">{formatDate(tenant.created_at)}</span>
                  </div>
                  {tenant.trial_ends_at && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        Trial Ends
                      </div>
                      <span className="text-[13px] font-medium text-foreground">{formatDate(tenant.trial_ends_at)}</span>
                    </div>
                  )}
                </div>
              </section>

              {/* More Information Toggle */}
              <button
                className="w-full flex items-center justify-between py-2 px-3 rounded-lg border border-border hover:bg-muted/30 transition-colors text-left"
                onClick={() => setShowMore(!showMore)}
              >
                <span className="text-[13px] font-medium text-foreground">More Information</span>
                {showMore ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>

              {showMore && (
                <div className="space-y-5">
                  {/* Subscriptions */}
                  {(tenant as any).subscriptions?.length > 0 && (
                    <section>
                      <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                        Subscription History
                      </h3>
                      <div className="space-y-2">
                        {(tenant as any).subscriptions.slice(0, 5).map((sub: any) => (
                          <div key={sub.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                            <div>
                              <p className="text-[13px] font-medium text-foreground">{sub.plan?.name ?? 'Unknown Plan'}</p>
                              <p className="text-[11px] text-muted-foreground">
                                {formatDate(sub.start_date)} → {sub.end_date ? formatDate(sub.end_date) : 'Ongoing'}
                              </p>
                            </div>
                            <StatusBadge status={sub.status} />
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Platform billing (SCC subscription payments to us) */}
                  {(tenant as any).payments?.length > 0 && (
                    <section>
                      <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                        Platform Billing
                      </h3>
                      <div className="space-y-2">
                        {(tenant as any).payments.slice(0, 10).map((payment: any) => (
                          <div key={payment.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                            <div className="flex items-center gap-2">
                              <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                              <div>
                                <p className="text-[13px] font-medium text-foreground">
                                  {formatCurrency(payment.amount, payment.currency)}
                                </p>
                                <p className="text-[11px] text-muted-foreground">{formatDate(payment.created_at)}</p>
                              </div>
                            </div>
                            <StatusBadge status={payment.status} />
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Recent gym payments (member payments inside the gym) */}
                  {op?.available && op.recentPayments && op.recentPayments.length > 0 && (
                    <section>
                      <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                        Recent Gym Payments
                      </h3>
                      <div className="space-y-2">
                        {op.recentPayments.map((p) => (
                          <div
                            key={p.id}
                            className="flex items-center justify-between py-2 border-b border-border last:border-0"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <CreditCard className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                              <div className="min-w-0">
                                <p className="text-[13px] font-medium text-foreground">
                                  {formatCurrency(p.amount, p.currency)}
                                </p>
                                <p className="text-[11px] text-muted-foreground truncate">
                                  {p.memberName ?? 'Unknown member'}
                                  {p.method ? ` · ${p.method}` : ''} ·{' '}
                                  {formatDate(p.paidAt ?? p.createdAt)}
                                </p>
                              </div>
                            </div>
                            <span className="text-[11px] capitalize text-muted-foreground flex-shrink-0">
                              {p.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Recent members */}
                  {op?.available && op.recentMembers && op.recentMembers.length > 0 && (
                    <section>
                      <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                        Recent Members
                      </h3>
                      <div className="space-y-2">
                        {op.recentMembers.map((m) => (
                          <div
                            key={m.id}
                            className="flex items-center justify-between py-2 border-b border-border last:border-0 gap-3"
                          >
                            <div className="min-w-0">
                              <p className="text-[13px] font-medium text-foreground truncate">
                                {m.name}
                              </p>
                              <p className="text-[11px] text-muted-foreground truncate">
                                {m.phone ?? m.email ?? '—'}
                                {m.branchName ? ` · ${m.branchName}` : ''}
                              </p>
                            </div>
                            <span className="text-[11px] capitalize text-muted-foreground flex-shrink-0">
                              {m.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Feature Overrides (editable, per-tenant) */}
                  {allFlags && allFlags.length > 0 && (
                    <section>
                      <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                        Feature Overrides
                      </h3>
                      <div className="space-y-2">
                        {allFlags.map((flag) => (
                          <div key={flag.id} className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[13px] text-foreground">{flag.name}</span>
                              {flag.is_global && (
                                <span className="text-[10px] text-muted-foreground">(global)</span>
                              )}
                            </div>
                            <Switch
                              checked={overrideFor(flag.id, flag.is_global)}
                              disabled={setTenantFlag.isPending}
                              onCheckedChange={(v) =>
                                setTenantFlag.mutate(
                                  { tenant_id: tenant.id, flag_id: flag.id, enabled: v },
                                  { onError: (e: Error) => toast.error(e.message || 'Failed to update flag') },
                                )
                              }
                            />
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="mt-2 pb-2 pt-5 border-t border-border flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleImpersonate(tenant.id)}
                disabled={impersonate.isPending}
              >
                <Eye className="h-3.5 w-3.5 mr-1.5" />
                Impersonate
              </Button>
              {tenant.status !== 'SUSPENDED' ? (
                <Button
                  variant="destructive"
                  size="sm"
                  className="flex-1"
                  onClick={() => { suspend.mutate(tenant.id); onClose(); }}
                  disabled={suspend.isPending}
                >
                  <Ban className="h-3.5 w-3.5 mr-1.5" />
                  Suspend Tenant
                </Button>
              ) : (
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={() => { activate.mutate(tenant.id); onClose(); }}
                  disabled={activate.isPending}
                >
                  <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                  Activate Tenant
                </Button>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function TenantsPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>(searchParams.get('status') ?? '');
  const [accountType, setAccountType] = useState<string>('');
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // Sync status filter from URL param on mount
  useEffect(() => {
    const s = searchParams.get('status');
    if (s) setStatus(s);
  }, [searchParams]);

  const { data, isLoading } = useTenants({
    page,
    search,
    status: status || undefined,
  });
  const syncTenants = useSyncTenants();

  // Client-side account_type filter (no extra API call needed)
  const filteredData = accountType
    ? data?.data.filter((t) => t.account_type === accountType)
    : data?.data;
  const suspend = useSuspendTenant();
  const activate = useActivateTenant();

  return (
    <div>
      <PageHeader
        title="Tenants"
        description="Manage all gym tenants on the platform"
        action={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="text-[13px]"
              disabled={syncTenants.isPending}
              onClick={() =>
                syncTenants.mutate(undefined, {
                  onSuccess: (r) =>
                    toast.success(
                      `Synced from app: ${r.imported} imported, ${r.updated} updated (${r.total} studios)`,
                    ),
                  onError: (e: Error) => toast.error(e.message || 'Sync failed'),
                })
              }
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${syncTenants.isPending ? 'animate-spin' : ''}`} />
              Sync from app
            </Button>
            <Button size="sm" className="text-[13px]" onClick={() => setShowAddModal(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add Tenant
            </Button>
          </div>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center mb-4">
        <div className="relative w-full sm:max-w-sm sm:flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tenants..."
            className="pl-9"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <Select
          value={accountType || 'ALL'}
          onValueChange={(v: string | null) => { setAccountType(v === 'ALL' || !v ? '' : v); setPage(1); }}
        >
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Types</SelectItem>
            <SelectItem value="gym">Gym / Studio</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={status || 'ALL'}
          onValueChange={(v: string | null) => {
            const newStatus = (!v || v === 'ALL') ? '' : v;
            setStatus(newStatus);
            setPage(1);
            if (newStatus) {
              router.replace(`/tenants?status=${newStatus}`);
            } else {
              router.replace('/tenants');
            }
          }}
        >
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Status</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="TRIAL">Trial</SelectItem>
            <SelectItem value="EXPIRED">Expired</SelectItem>
            <SelectItem value="SUSPENDED">Suspended</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <LoadingSkeleton rows={8} />
      ) : !filteredData?.length ? (
        <EmptyState
          title="No tenants found"
          description={status || accountType ? 'No tenants match the selected filters' : 'No tenants have signed up yet'}
        />
      ) : (
        <>
          <div className="rounded-lg border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[13px]">Tenant</TableHead>
                  <TableHead className="text-[13px]">Owner</TableHead>
                  <TableHead className="text-[13px]">Phone</TableHead>
                  <TableHead className="text-[13px]">Type</TableHead>
                  <TableHead className="text-[13px]">Plan</TableHead>
                  <TableHead className="text-[13px]">Status</TableHead>
                  <TableHead className="text-[13px]">Created</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData!.map((tenant) => (
                  <TableRow
                    key={tenant.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedTenantId(tenant.id)}
                  >
                    <TableCell>
                      <div>
                        <p className="text-[13px] font-semibold text-foreground">{tenant.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {tenant.slug}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-[13px] text-foreground">{tenant.owner_name}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Mail className="h-3 w-3 text-muted-foreground" />
                          <p className="text-[11px] text-muted-foreground">
                            {tenant.owner_email}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {tenant.phone ? (
                        <div className="flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                          <a
                            href={`tel:${tenant.phone}`}
                            className="text-[13px] text-primary hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {tenant.phone}
                          </a>
                        </div>
                      ) : (
                        <span className="text-[12px] text-muted-foreground/50 italic">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium bg-primary/10 text-primary">
                        {formatAccountType(tenant.account_type)}
                      </span>
                    </TableCell>
                    <TableCell className="text-[13px]">{tenant.plan?.name || '—'}</TableCell>
                    <TableCell>
                      <StatusBadge status={tenant.status} />
                    </TableCell>
                    <TableCell className="text-[13px] text-muted-foreground">
                      {formatDate(tenant.created_at)}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted transition-colors outline-none">
                          <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setSelectedTenantId(tenant.id)}>
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </DropdownMenuItem>
                          {tenant.status !== 'SUSPENDED' ? (
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => suspend.mutate(tenant.id)}
                            >
                              <Ban className="mr-2 h-4 w-4" />
                              Suspend
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => activate.mutate(tenant.id)}
                            >
                              <CheckCircle className="mr-2 h-4 w-4" />
                              Activate
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between mt-4">
            <p className="text-[13px] text-muted-foreground">
              Showing {filteredData!.length} of {data!.meta.total} tenants
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!data || page >= data.meta.total_pages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}

      <AddTenantModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
      />

      <TenantDetailDrawer
        tenantId={selectedTenantId}
        open={!!selectedTenantId}
        onClose={() => setSelectedTenantId(null)}
      />
    </div>
  );
}

export default function TenantsPage() {
  return (
    <Suspense fallback={<LoadingSkeleton rows={8} />}>
      <TenantsPageContent />
    </Suspense>
  );
}
