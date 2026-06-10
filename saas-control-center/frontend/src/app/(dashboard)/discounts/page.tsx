'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { LoadingSkeleton } from '@/components/shared/loading-skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { Plus, Tag } from 'lucide-react';
import {
  useDiscounts,
  useCreateDiscount,
  useUpdateDiscount,
  type Discount,
} from '@/hooks/use-discounts';
import { useAssignablePlans } from '@/hooks/use-plans';

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function discountLabel(d: Discount) {
  return d.type === 'PERCENTAGE' ? `${Number(d.value)}% off` : `₹${Number(d.value)} off`;
}

function isExpired(d: Discount) {
  return new Date(d.valid_to) < new Date();
}

function CreateDiscountDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useCreateDiscount();
  const { data: plans } = useAssignablePlans();
  const todayISO = new Date().toISOString().slice(0, 10);

  const [form, setForm] = useState({
    name: '',
    type: 'PERCENTAGE',
    value: '',
    code: '',
    plan_id: '',
    valid_from: todayISO,
    valid_to: '',
    max_uses: '',
  });
  const [error, setError] = useState('');

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = () => {
    setError('');
    if (!form.name.trim()) return setError('Name is required');
    if (!form.value || Number(form.value) <= 0) return setError('Value must be greater than 0');
    if (!form.valid_to) return setError('Valid-to date is required');
    if (new Date(form.valid_from) >= new Date(form.valid_to))
      return setError('Valid-from must be before valid-to');

    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      type: form.type,
      value: Number(form.value),
      valid_from: new Date(form.valid_from).toISOString(),
      valid_to: new Date(form.valid_to).toISOString(),
    };
    if (form.code.trim()) payload.code = form.code.trim().toUpperCase();
    if (form.plan_id) payload.plan_id = form.plan_id;
    if (form.max_uses) payload.max_uses = Number(form.max_uses);

    create.mutate(payload, {
      onSuccess: () => {
        setForm({ name: '', type: 'PERCENTAGE', value: '', code: '', plan_id: '', valid_from: todayISO, valid_to: '', max_uses: '' });
        onClose();
      },
      onError: (e: Error) => setError(e.message || 'Failed to create discount'),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Discount</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {error && (
            <p className="text-[13px] text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</p>
          )}
          <div className="space-y-1.5">
            <Label className="text-[13px]">Name <span className="text-destructive">*</span></Label>
            <Input placeholder="e.g. Diwali Sale 2026" value={form.name} onChange={(e) => set('name', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[13px]">Type</Label>
              <Select value={form.type} onValueChange={(v) => set('type', v || 'PERCENTAGE')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PERCENTAGE">Percentage (%)</SelectItem>
                  <SelectItem value="FLAT">Flat (₹)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px]">Value <span className="text-destructive">*</span></Label>
              <Input type="number" min="0" placeholder={form.type === 'PERCENTAGE' ? '20' : '500'} value={form.value} onChange={(e) => set('value', e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[13px]">Code <span className="text-muted-foreground">(optional)</span></Label>
            <Input placeholder="DIWALI2026" value={form.code} onChange={(e) => set('code', e.target.value.toUpperCase())} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[13px]">Plan <span className="text-muted-foreground">(optional — applies to all if empty)</span></Label>
            <Select value={form.plan_id || 'all'} onValueChange={(v) => set('plan_id', !v || v === 'all' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="All plans" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All plans</SelectItem>
                {plans?.map((p) => (
                  <SelectItem key={p.id} value={p.id}><span className="capitalize">{p.name}</span></SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[13px]">Valid From <span className="text-destructive">*</span></Label>
              <Input type="date" value={form.valid_from} onChange={(e) => set('valid_from', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px]">Valid To <span className="text-destructive">*</span></Label>
              <Input type="date" value={form.valid_to} onChange={(e) => set('valid_to', e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[13px]">Max Uses <span className="text-muted-foreground">(optional)</span></Label>
            <Input type="number" min="1" placeholder="Unlimited" value={form.max_uses} onChange={(e) => set('max_uses', e.target.value)} />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={create.isPending}>Cancel</Button>
          <Button size="sm" onClick={handleSubmit} disabled={create.isPending}>
            {create.isPending ? 'Creating...' : 'Create Discount'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function DiscountsPage() {
  const [includeExpired, setIncludeExpired] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const { data, isLoading, isError, refetch } = useDiscounts(includeExpired);
  const update = useUpdateDiscount();

  return (
    <div>
      <PageHeader
        title="Discounts"
        description="Promotional discounts and coupon codes applied to plans"
        action={
          <Button size="sm" className="text-[13px]" onClick={() => setShowCreate(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Create Discount
          </Button>
        }
      />

      <div className="flex items-center gap-2 mb-4">
        <Button
          variant={includeExpired ? 'default' : 'outline'}
          size="sm"
          className="text-[12px]"
          onClick={() => setIncludeExpired((v) => !v)}
        >
          {includeExpired ? 'Showing all' : 'Show expired / inactive'}
        </Button>
      </div>

      {isLoading ? (
        <LoadingSkeleton rows={6} />
      ) : isError ? (
        <ErrorState title="Could not load discounts" onRetry={() => refetch()} />
      ) : !data?.length ? (
        <EmptyState
          title="No discounts"
          description="Create a discount to offer promotional pricing on plans."
          icon={<Tag className="h-10 w-10 text-muted-foreground/40 mb-3" />}
        />
      ) : (
        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[13px]">Name</TableHead>
                <TableHead className="text-[13px]">Code</TableHead>
                <TableHead className="text-[13px]">Discount</TableHead>
                <TableHead className="text-[13px]">Plan</TableHead>
                <TableHead className="text-[13px]">Validity</TableHead>
                <TableHead className="text-[13px]">Uses</TableHead>
                <TableHead className="text-[13px]">Status</TableHead>
                <TableHead className="text-[13px] text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((d) => {
                const expired = isExpired(d);
                const status = !d.is_active ? 'Inactive' : expired ? 'Expired' : 'Active';
                const statusClass =
                  status === 'Active'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : status === 'Expired'
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-gray-50 text-gray-600 border-gray-200';
                return (
                  <TableRow key={d.id}>
                    <TableCell className="text-[13px] font-medium text-foreground">{d.name}</TableCell>
                    <TableCell className="text-[12px] font-mono text-muted-foreground">{d.code || '—'}</TableCell>
                    <TableCell className="text-[13px] text-foreground">{discountLabel(d)}</TableCell>
                    <TableCell className="text-[13px] capitalize">{d.plan?.name || 'All plans'}</TableCell>
                    <TableCell className="text-[12px] text-muted-foreground">
                      {fmtDate(d.valid_from)} → {fmtDate(d.valid_to)}
                    </TableCell>
                    <TableCell className="text-[13px] text-muted-foreground tabular-nums">
                      {d.used_count}{d.max_uses ? ` / ${d.max_uses}` : ''}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium ${statusClass}`}>
                        {status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-[12px]"
                        disabled={update.isPending}
                        onClick={() => update.mutate({ id: d.id, is_active: !d.is_active })}
                      >
                        {d.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <CreateDiscountDialog open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
}
