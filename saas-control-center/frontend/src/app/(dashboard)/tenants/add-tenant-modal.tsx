'use client';

import { useState } from 'react';
import { useCreateTenant } from '@/hooks/use-tenants';
import { useAssignablePlans } from '@/hooks/use-plans';
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

interface AddTenantModalProps {
  open: boolean;
  onClose: () => void;
}

function toSlug(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function AddTenantModal({ open, onClose }: AddTenantModalProps) {
  const create = useCreateTenant();
  const { data: plans } = useAssignablePlans();

  const [form, setForm] = useState({
    name: '',
    slug: '',
    owner_name: '',
    owner_email: '',
    phone: '',
    plan_id: '',
  });
  const [slugManual, setSlugManual] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (field: string, value: string) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      // Auto-generate slug from name unless user edited it manually
      if (field === 'name' && !slugManual) {
        next.slug = toSlug(value);
      }
      return next;
    });
    if (errors[field]) setErrors((e) => { const n = { ...e }; delete n[field]; return n; });
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Gym name is required';
    if (!form.slug.trim()) e.slug = 'Slug is required';
    else if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(form.slug)) e.slug = 'Lowercase alphanumeric with hyphens only';
    if (!form.owner_name.trim()) e.owner_name = 'Owner name is required';
    if (!form.owner_email.trim()) e.owner_email = 'Owner email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.owner_email)) e.owner_email = 'Invalid email address';
    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }

    const payload: Record<string, string> = {
      name: form.name.trim(),
      slug: form.slug.trim(),
      owner_name: form.owner_name.trim(),
      owner_email: form.owner_email.trim(),
    };
    if (form.phone.trim()) payload.phone = form.phone.trim();
    if (form.plan_id) payload.plan_id = form.plan_id;

    create.mutate(payload, {
      onSuccess: () => {
        handleClose();
      },
      onError: (err: Error) => {
        // Show field-level error if it's a slug conflict
        if (err.message?.toLowerCase().includes('slug')) {
          setErrors({ slug: 'This slug is already taken' });
        } else {
          setErrors({ _global: err.message });
        }
      },
    });
  };

  const handleClose = () => {
    setForm({ name: '', slug: '', owner_name: '', owner_email: '', phone: '', plan_id: '' });
    setErrors({});
    setSlugManual(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Tenant</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {errors._global && (
            <p className="text-[13px] text-destructive bg-destructive/10 rounded-md px-3 py-2">
              {errors._global}
            </p>
          )}

          {/* Gym Name */}
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-[13px]">Gym Name <span className="text-destructive">*</span></Label>
            <Input
              id="name"
              placeholder="e.g. Iron Paradise Gym"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              className={errors.name ? 'border-destructive' : ''}
            />
            {errors.name && <p className="text-[11px] text-destructive">{errors.name}</p>}
          </div>

          {/* Slug */}
          <div className="space-y-1.5">
            <Label htmlFor="slug" className="text-[13px]">
              Slug <span className="text-destructive">*</span>
              <span className="text-muted-foreground ml-1">(URL-friendly identifier)</span>
            </Label>
            <Input
              id="slug"
              placeholder="e.g. iron-paradise"
              value={form.slug}
              onChange={(e) => {
                setSlugManual(true);
                set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
              }}
              className={errors.slug ? 'border-destructive' : ''}
            />
            {errors.slug && <p className="text-[11px] text-destructive">{errors.slug}</p>}
          </div>

          {/* Owner Name */}
          <div className="space-y-1.5">
            <Label htmlFor="owner_name" className="text-[13px]">Owner Name <span className="text-destructive">*</span></Label>
            <Input
              id="owner_name"
              placeholder="e.g. Rajesh Kumar"
              value={form.owner_name}
              onChange={(e) => set('owner_name', e.target.value)}
              className={errors.owner_name ? 'border-destructive' : ''}
            />
            {errors.owner_name && <p className="text-[11px] text-destructive">{errors.owner_name}</p>}
          </div>

          {/* Owner Email */}
          <div className="space-y-1.5">
            <Label htmlFor="owner_email" className="text-[13px]">Owner Email <span className="text-destructive">*</span></Label>
            <Input
              id="owner_email"
              type="email"
              placeholder="owner@gymname.com"
              value={form.owner_email}
              onChange={(e) => set('owner_email', e.target.value)}
              className={errors.owner_email ? 'border-destructive' : ''}
            />
            {errors.owner_email && <p className="text-[11px] text-destructive">{errors.owner_email}</p>}
          </div>

          {/* Phone */}
          <div className="space-y-1.5">
            <Label htmlFor="phone" className="text-[13px]">Phone <span className="text-muted-foreground">(optional)</span></Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+91 98765 43210"
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
            />
          </div>

          {/* Plan */}
          <div className="space-y-1.5">
            <Label className="text-[13px]">Subscription Plan <span className="text-muted-foreground">(optional)</span></Label>
            <Select
              value={form.plan_id || 'none'}
              onValueChange={(v) => set('plan_id', (!v || v === 'none') ? '' : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a plan..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No plan (trial only)</SelectItem>
                {plans?.map((plan) => (
                  <SelectItem key={plan.id} value={plan.id}>
                    <span className="capitalize">{plan.name}</span>
                    {plan.price_monthly > 0 ? ` — ₹${plan.price_monthly}/mo` : ' — Free'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Tenant starts on a 14-day trial regardless of plan selected.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={handleClose} disabled={create.isPending}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={create.isPending}>
            {create.isPending ? 'Creating...' : 'Create Tenant'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
