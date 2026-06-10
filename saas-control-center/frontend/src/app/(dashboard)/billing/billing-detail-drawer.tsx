'use client';

import { useTenantBillingDetail, type BillingIssue } from '@/hooks/use-billing';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { StatusBadge } from '@/components/shared/status-badge';
import { LoadingSkeleton } from '@/components/shared/loading-skeleton';
import {
  AlertTriangle,
  AlertCircle,
  Info,
  Package,
  ExternalLink,
  FileText,
  CreditCard,
} from 'lucide-react';

function formatCurrency(amount: number, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

function formatDate(date?: string | null) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

const ISSUE_STYLES: Record<
  BillingIssue['severity'],
  { wrap: string; icon: typeof Info }
> = {
  error: { wrap: 'border-red-200 bg-red-50 text-red-800', icon: AlertCircle },
  warning: { wrap: 'border-amber-200 bg-amber-50 text-amber-800', icon: AlertTriangle },
  info: { wrap: 'border-blue-200 bg-blue-50 text-blue-800', icon: Info },
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
      {children}
    </h3>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-start justify-between gap-4 text-[13px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground text-right font-medium break-words">
        {value || '—'}
      </span>
    </div>
  );
}

export function BillingDetailDrawer({
  tenantId,
  open,
  onClose,
}: {
  tenantId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const { data, isLoading } = useTenantBillingDetail(open ? tenantId : null);

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto gap-0 px-7 py-6">
        {isLoading || !data ? (
          <LoadingSkeleton rows={6} />
        ) : (
          <>
            <SheetHeader className="p-0 pb-5 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                  {data.tenant.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <SheetTitle className="text-[16px]">{data.tenant.name}</SheetTitle>
                  <p className="text-[12px] text-muted-foreground mt-0.5">
                    {data.tenant.slug}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <StatusBadge status={data.tenant.status} />
                {data.tenant.plan && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    <Package className="h-3 w-3" />
                    {data.tenant.plan.name}
                  </span>
                )}
              </div>
            </SheetHeader>

            <div className="py-5 space-y-7">
              {/* Pending & missing things */}
              <section>
                <SectionTitle>Pending &amp; Missing</SectionTitle>
                {data.issues.length === 0 ? (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[13px] text-emerald-800">
                    All clear — nothing pending or missing for this tenant.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {data.issues.map((issue, i) => {
                      const s = ISSUE_STYLES[issue.severity];
                      const Icon = s.icon;
                      return (
                        <div
                          key={`${issue.code}-${i}`}
                          className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 ${s.wrap}`}
                        >
                          <Icon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-[13px] font-medium">{issue.title}</p>
                            {issue.detail && (
                              <p className="text-[12px] opacity-80 mt-0.5">{issue.detail}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Summary */}
              <section>
                <SectionTitle>Summary</SectionTitle>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Total Paid', value: formatCurrency(data.summary.total_paid, data.summary.currency) },
                    { label: 'Invoices', value: String(data.summary.invoice_count) },
                    { label: 'Pending', value: String(data.summary.pending_count) },
                    { label: 'Failed', value: String(data.summary.failed_count) },
                  ].map((c) => (
                    <div key={c.label} className="rounded-lg border border-border bg-card p-3">
                      <p className="text-[11px] text-muted-foreground">{c.label}</p>
                      <p className="text-[15px] font-semibold text-foreground mt-1">{c.value}</p>
                    </div>
                  ))}
                </div>
              </section>

              {/* Billing information */}
              <section>
                <SectionTitle>Billing Information</SectionTitle>
                {data.billing_info ? (
                  <div className="space-y-2.5 rounded-lg border border-border bg-card p-4">
                    <Field label="Billing name" value={data.billing_info.billing_name} />
                    <Field label="Billing email" value={data.billing_info.billing_email} />
                    <Field label="Business name" value={data.billing_info.business_name} />
                    <Field label="Address" value={data.billing_info.billing_address} />
                    <Field label="GST / Tax ID" value={data.billing_info.gstin || data.billing_info.tax_id} />
                    <Field label="Currency" value={data.billing_info.currency} />
                    <Field label="Billing cycle" value={data.billing_info.billing_cycle} />
                  </div>
                ) : (
                  <p className="text-[13px] text-muted-foreground">
                    No billing profile — tenant not linked to a live gym.
                  </p>
                )}
              </section>

              {/* Subscription / lifecycle */}
              {data.lifecycle && (
                <section>
                  <SectionTitle>Subscription</SectionTitle>
                  <div className="space-y-2.5 rounded-lg border border-border bg-card p-4">
                    <Field label="Plan" value={data.lifecycle.plan} />
                    <Field label="Lifecycle status" value={data.lifecycle.status} />
                    <Field label="Subscription status" value={data.lifecycle.subscription_status} />
                    <Field label="Started" value={formatDate(data.lifecycle.subscription_start)} />
                    <Field label="Next billing date" value={formatDate(data.lifecycle.next_billing_date)} />
                    <Field label="Expires" value={formatDate(data.lifecycle.subscription_expires_at)} />
                    {data.lifecycle.trial_ends_at && (
                      <Field label="Trial ends" value={formatDate(data.lifecycle.trial_ends_at)} />
                    )}
                    {data.lifecycle.grace_until && (
                      <Field label="Grace until" value={formatDate(data.lifecycle.grace_until)} />
                    )}
                    {data.lifecycle.locked_at && (
                      <Field label="Locked at" value={formatDate(data.lifecycle.locked_at)} />
                    )}
                  </div>
                </section>
              )}

              {/* Invoices */}
              <section>
                <SectionTitle>
                  <span className="inline-flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5" /> Invoices ({data.invoices.length})
                  </span>
                </SectionTitle>
                {data.invoices.length === 0 ? (
                  <p className="text-[13px] text-muted-foreground">No invoices yet.</p>
                ) : (
                  <div className="rounded-lg border border-border bg-card divide-y divide-border">
                    {data.invoices.map((inv) => (
                      <div key={inv.id} className="flex items-center justify-between gap-3 px-4 py-3">
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium text-foreground font-mono truncate">
                            {inv.invoice_number}
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {formatDate(inv.billing_period_start)} &ndash; {formatDate(inv.billing_period_end)}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <span className="text-[13px] font-mono text-foreground">
                            {formatCurrency(inv.amount, inv.currency)}
                          </span>
                          <StatusBadge status={inv.status.toUpperCase()} />
                          {inv.invoice_url && (
                            <a
                              href={inv.invoice_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-muted-foreground hover:text-foreground"
                              title="Open invoice"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Payments */}
              <section>
                <SectionTitle>
                  <span className="inline-flex items-center gap-1.5">
                    <CreditCard className="h-3.5 w-3.5" /> Payments ({data.payments.length})
                  </span>
                </SectionTitle>
                {data.payments.length === 0 ? (
                  <p className="text-[13px] text-muted-foreground">No payments recorded.</p>
                ) : (
                  <div className="rounded-lg border border-border bg-card divide-y divide-border">
                    {data.payments.map((p) => (
                      <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
                        <div className="min-w-0">
                          <p className="text-[13px] font-mono text-foreground">
                            {formatCurrency(p.amount, p.currency)}
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {p.gateway || '—'} &middot; {formatDate(p.created_at)}
                          </p>
                        </div>
                        <StatusBadge status={p.status} />
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
