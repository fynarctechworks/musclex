'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { AddTenantModal } from './add-tenant-modal';
import {
  useTenants,
  useTenant,
  useSuspendTenant,
  useActivateTenant,
} from '@/hooks/use-tenants';
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
} from 'lucide-react';
import type { Tenant } from '@/types';

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
  const { data: tenant, isLoading } = useTenant(tenantId ?? '');
  const suspend = useSuspendTenant();
  const activate = useActivateTenant();

  useEffect(() => {
    if (!open) setShowMore(false);
  }, [open]);

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        {isLoading ? (
          <div className="pt-6">
            <LoadingSkeleton rows={6} />
          </div>
        ) : !tenant ? null : (
          <>
            <SheetHeader className="pb-4 border-b border-border">
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

            <div className="py-4 space-y-5">
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

              {/* Plan & Limits */}
              <section>
                <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Plan Limits
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Max Members', value: tenant.max_members },
                    { label: 'Max Branches', value: tenant.max_branches },
                    { label: 'Max Staff', value: tenant.max_staff },
                  ].map((item) => (
                    <div key={item.label} className="rounded-lg border border-border bg-muted/30 p-3 text-center">
                      <p className="text-lg font-semibold text-foreground">{item.value}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{item.label}</p>
                    </div>
                  ))}
                </div>
              </section>

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

                  {/* Payment History */}
                  {(tenant as any).payments?.length > 0 && (
                    <section>
                      <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                        Payment History
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

                  {/* Feature Flags */}
                  {(tenant as any).feature_flags?.length > 0 && (
                    <section>
                      <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                        Feature Overrides
                      </h3>
                      <div className="space-y-1.5">
                        {(tenant as any).feature_flags.map((ff: any) => (
                          <div key={ff.id} className="flex items-center justify-between">
                            <span className="text-[13px] text-foreground">{ff.flag?.name ?? ff.flag_key}</span>
                            <span className={`text-[11px] font-medium ${ff.enabled ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                              {ff.enabled ? 'Enabled' : 'Disabled'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="pt-4 border-t border-border flex gap-2">
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
          <Button size="sm" className="text-[13px]" onClick={() => setShowAddModal(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add Tenant
          </Button>
        }
      />

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
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
          <SelectTrigger className="w-44">
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
          <SelectTrigger className="w-40">
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
                        Gym
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
