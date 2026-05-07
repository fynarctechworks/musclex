'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useCreatePlan, useUpdatePlan } from '@/hooks/use-plans';
import type { SubscriptionPlan } from '@/types';
import {
  Users,
  QrCode,
  CreditCard,
  BarChart2,
  UserCog,
  Calendar,
  Building2,
  Megaphone,
  Brain,
  Code2,
  ChevronDown,
  ChevronRight,
  Briefcase,
} from 'lucide-react';

interface PlanFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingPlan: SubscriptionPlan | null;
}

// Feature hierarchy: main features and their sub-features
const FEATURE_GROUPS = [
  {
    key: 'member_management',
    label: 'Member Management',
    icon: Users,
    description: 'Core member CRUD, profiles, memberships',
    sub: [],
  },
  {
    key: 'check_in',
    label: 'Check-In System',
    icon: QrCode,
    description: 'QR code, manual, facial recognition check-in',
    sub: [],
  },
  {
    key: 'manual_payments',
    label: 'Payments',
    icon: CreditCard,
    description: 'Record and track payments',
    sub: [
      { key: 'payment_gateway', label: 'Online Payment Gateway (Razorpay/Stripe)' },
    ],
  },
  {
    key: 'basic_reports',
    label: 'Reports & Analytics',
    icon: BarChart2,
    description: 'Revenue, attendance, and member reports',
    sub: [],
  },
  {
    key: 'staff_management',
    label: 'Staff Management',
    icon: UserCog,
    description: 'Staff directory, shifts, leave requests',
    sub: [
      { key: 'trainer_management', label: 'Trainer Management & Assignments' },
      { key: 'custom_roles', label: 'Custom Roles & Permissions' },
      { key: 'audit_logs', label: 'Audit Logs' },
    ],
  },
  {
    key: 'class_scheduling',
    label: 'Class Scheduling',
    icon: Calendar,
    description: 'Classes, calendar, roster, waitlist',
    sub: [],
  },
  {
    key: 'multi_branch',
    label: 'Multi-Branch',
    icon: Building2,
    description: 'Manage multiple gym locations',
    sub: [],
  },
  {
    key: 'marketing_campaigns',
    label: 'Marketing',
    icon: Megaphone,
    description: 'Campaigns, automation, referral programs',
    sub: [
      { key: 'whatsapp_notifications', label: 'WhatsApp Notifications' },
      { key: 'email_campaigns', label: 'Email Campaigns' },
    ],
  },
  {
    key: 'ai_advisor',
    label: 'AI Advisor',
    icon: Brain,
    description: 'Claude AI daily briefing and proactive alerts',
    sub: [],
  },
  {
    key: 'api_access',
    label: 'API Access',
    icon: Code2,
    description: 'REST API access for integrations',
    sub: [],
  },
] as const;

// All feature keys
const ALL_FEATURE_KEYS = FEATURE_GROUPS.flatMap((g) => [
  g.key,
  ...g.sub.map((s) => s.key),
]);

const DEFAULT_FEATURES: Record<string, boolean> = {
  member_management: true,
  check_in: true,
  basic_reports: true,
  manual_payments: true,
  payment_gateway: false,
  staff_management: false,
  trainer_management: false,
  custom_roles: false,
  audit_logs: false,
  class_scheduling: false,
  multi_branch: false,
  marketing_campaigns: false,
  whatsapp_notifications: false,
  email_campaigns: false,
  ai_advisor: false,
  api_access: false,
};

export function PlanFormModal({
  open,
  onOpenChange,
  editingPlan,
}: PlanFormModalProps) {
  const createPlan = useCreatePlan();
  const updatePlan = useUpdatePlan();
  const isEditing = !!editingPlan;

  const planType = 'regular' as const;

  // Form state
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [monthlyPrice, setMonthlyPrice] = useState('');
  const [annualPrice, setAnnualPrice] = useState('');
  const [maxBranches, setMaxBranches] = useState('1');
  const [maxMembers, setMaxMembers] = useState('100');
  const [maxStaff, setMaxStaff] = useState('10');
  const [storageLimitGb, setStorageLimitGb] = useState('1');
  const [apiAccess, setApiAccess] = useState(false);
  const [features, setFeatures] = useState<Record<string, boolean>>({ ...DEFAULT_FEATURES });
  const [isActive, setIsActive] = useState(true);
  const [isFeatured, setIsFeatured] = useState(false);
  const [sortOrder, setSortOrder] = useState('0');
  const [discountPercent, setDiscountPercent] = useState('');
  const [discountLabel, setDiscountLabel] = useState('');
  const [discountExpiresAt, setDiscountExpiresAt] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');

  useEffect(() => {
    if (open && editingPlan) {
      setName(editingPlan.name);
      setDisplayName(editingPlan.display_name);
      setDescription(editingPlan.description || '');
      setMonthlyPrice(String(editingPlan.monthly_price));
      setAnnualPrice(String(editingPlan.annual_price));
      setMaxBranches(String(editingPlan.max_branches));
      setMaxMembers(String(editingPlan.max_members));
      setMaxStaff(String(editingPlan.max_staff));
      setStorageLimitGb(String(editingPlan.storage_limit_gb));
      setApiAccess(editingPlan.api_access);
      // Build features map from plan, filling in any missing keys with false
      const f: Record<string, boolean> = { ...DEFAULT_FEATURES };
      Object.entries(editingPlan.features || {}).forEach(([k, v]) => { f[k] = !!v; });
      setFeatures(f);
      setIsActive(editingPlan.is_active);
      setIsFeatured(editingPlan.is_featured);
      setSortOrder(String(editingPlan.sort_order));
      setDiscountPercent(editingPlan.discount_percent != null ? String(editingPlan.discount_percent) : '');
      setDiscountLabel(editingPlan.discount_label || '');
      setDiscountExpiresAt(editingPlan.discount_expires_at ? editingPlan.discount_expires_at.slice(0, 10) : '');
    } else if (open && !editingPlan) {
      setName('');
      setDisplayName('');
      setDescription('');
      setMonthlyPrice('');
      setAnnualPrice('');
      setMaxBranches('1');
      setMaxMembers('100');
      setMaxStaff('10');
      setStorageLimitGb('1');
      setApiAccess(false);
      setFeatures({ ...DEFAULT_FEATURES });
      setIsActive(true);
      setIsFeatured(false);
      setSortOrder('0');
      setDiscountPercent('');
      setDiscountLabel('');
      setDiscountExpiresAt('');
    }
    setError('');
    setExpandedGroups(new Set());
  }, [open, editingPlan]);

  const toggleFeature = (key: string, value: boolean) => {
    setFeatures((prev) => {
      const next = { ...prev, [key]: value };
      // If disabling a main feature, also disable all sub-features
      const group = FEATURE_GROUPS.find((g) => g.key === key);
      if (group && !value) {
        group.sub.forEach((s) => { next[s.key] = false; });
      }
      return next;
    });
  };

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim() || !displayName.trim()) {
      setError('Name and Display Name are required');
      return;
    }
    if (!monthlyPrice || !annualPrice) {
      setError('Monthly and Annual prices are required');
      return;
    }

    const payload: Record<string, any> = {
      name: name.trim(),
      display_name: displayName.trim(),
      description: description.trim() || null,
      monthly_price: parseFloat(monthlyPrice),
      annual_price: parseFloat(annualPrice),
      max_branches: parseInt(maxBranches) || 1,
      max_members: parseInt(maxMembers) || 100,
      max_staff: parseInt(maxStaff) || 10,
      storage_limit_gb: parseInt(storageLimitGb) || 1,
      api_access: apiAccess,
      features,
      is_active: isActive,
      is_featured: isFeatured,
      sort_order: parseInt(sortOrder) || 0,
      plan_type: planType,
    };

    if (discountPercent) {
      payload.discount_percent = parseInt(discountPercent);
      payload.discount_label = discountLabel.trim() || null;
      payload.discount_expires_at = discountExpiresAt ? new Date(discountExpiresAt).toISOString() : null;
    } else {
      payload.discount_percent = null;
      payload.discount_label = null;
      payload.discount_expires_at = null;
    }

    try {
      if (isEditing) {
        await updatePlan.mutateAsync({ id: editingPlan.id, ...payload });
      } else {
        await createPlan.mutateAsync(payload);
      }
      onOpenChange(false);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Something went wrong';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
  };

  const isSubmitting = createPlan.isPending || updatePlan.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-primary" />
            <DialogTitle>
              {isEditing ? 'Edit Plan' : 'Create Gym Plan'}
            </DialogTitle>
          </div>
          <DialogDescription>
            {isEditing
              ? 'Update plan details. Changes sync to onboarding automatically.'
              : 'Create a new subscription plan. It will appear in onboarding immediately.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-[13px] text-destructive">
              {error}
            </div>
          )}


          {/* Name + Display Name */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="name" className="text-[13px]">Name (slug) *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                placeholder="pro"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="display_name" className="text-[13px]">Display Name *</Label>
              <Input
                id="display_name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Pro"
                required
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <Label htmlFor="description" className="text-[13px]">Description</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Best for growing studios"
            />
          </div>

          {/* Pricing */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="monthly_price" className="text-[13px]">Monthly Price (₹) *</Label>
              <Input
                id="monthly_price"
                type="number"
                min="0"
                step="0.01"
                value={monthlyPrice}
                onChange={(e) => setMonthlyPrice(e.target.value)}
                placeholder="2499"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="annual_price" className="text-[13px]">Annual Price (₹) *</Label>
              <Input
                id="annual_price"
                type="number"
                min="0"
                step="0.01"
                value={annualPrice}
                onChange={(e) => setAnnualPrice(e.target.value)}
                placeholder="24990"
                required
              />
            </div>
          </div>

          {/* Limits */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label htmlFor="max_branches" className="text-[13px]">Max Branches</Label>
              <Input id="max_branches" type="number" min="1" value={maxBranches} onChange={(e) => setMaxBranches(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="max_members" className="text-[13px]">Max Members</Label>
              <Input id="max_members" type="number" min="1" value={maxMembers} onChange={(e) => setMaxMembers(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="max_staff" className="text-[13px]">Max Staff</Label>
              <Input id="max_staff" type="number" min="1" value={maxStaff} onChange={(e) => setMaxStaff(e.target.value)} />
            </div>
          </div>

          {/* Storage + API */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="storage" className="text-[13px]">Storage (GB)</Label>
              <Input id="storage" type="number" min="1" value={storageLimitGb} onChange={(e) => setStorageLimitGb(e.target.value)} />
            </div>
            <div className="flex items-center gap-2 pt-5">
              <Switch checked={apiAccess} onCheckedChange={setApiAccess} />
              <Label className="text-[13px]">API Access</Label>
            </div>
          </div>

          {/* Features — Hierarchical Toggles */}
          {(
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-[13px] font-medium">
                  Features & Navigation
                </Label>
                <span className="text-[11px] text-muted-foreground">
                  Enabled features show in the gym dashboard sidebar
                </span>
              </div>
              <div className="rounded-lg border border-border overflow-hidden divide-y divide-border">
                {FEATURE_GROUPS.map((group) => {
                  const Icon = group.icon;
                  const isMainOn = features[group.key] ?? false;
                  const hasSub = group.sub.length > 0;
                  const isExpanded = expandedGroups.has(group.key);

                  return (
                    <div key={group.key}>
                      {/* Main Feature Row */}
                      <div className={`flex items-center gap-3 px-3 py-2.5 ${!isMainOn ? 'bg-muted/30' : 'bg-background'}`}>
                        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${isMainOn ? 'bg-primary/10' : 'bg-muted'}`}>
                          <Icon className={`h-3.5 w-3.5 ${isMainOn ? 'text-primary' : 'text-muted-foreground'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-[13px] font-medium ${isMainOn ? 'text-foreground' : 'text-muted-foreground'}`}>
                            {group.label}
                          </p>
                          <p className="text-[11px] text-muted-foreground truncate">{group.description}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {hasSub && isMainOn && (
                            <button
                              type="button"
                              onClick={() => toggleGroup(group.key)}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              {isExpanded
                                ? <ChevronDown className="h-3.5 w-3.5" />
                                : <ChevronRight className="h-3.5 w-3.5" />}
                            </button>
                          )}
                          <Switch
                            checked={isMainOn}
                            onCheckedChange={(v) => toggleFeature(group.key, v)}
                          />
                        </div>
                      </div>

                      {/* Sub-Features (only when main is ON and expanded) */}
                      {hasSub && isMainOn && isExpanded && (
                        <div className="bg-muted/20 divide-y divide-border/50">
                          {group.sub.map((sub) => {
                            const isSubOn = features[sub.key] ?? false;
                            return (
                              <div key={sub.key} className={`flex items-center gap-3 pl-12 pr-3 py-2 ${!isSubOn ? 'opacity-60' : ''}`}>
                                <div className="flex-1">
                                  <p className="text-[12px] text-foreground">{sub.label}</p>
                                </div>
                                <Switch
                                  checked={isSubOn}
                                  onCheckedChange={(v) => toggleFeature(sub.key, v)}
                                />
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Disabled main features will hide that entire section from the gym's sidebar navigation.
              </p>
            </div>
          )}


          {/* Discount Section */}
          <div className="rounded-md border border-border p-3 space-y-3">
            <p className="text-[13px] font-medium text-foreground">Discount (optional)</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="discount_percent" className="text-[13px]">Discount %</Label>
                <Input
                  id="discount_percent"
                  type="number"
                  min="0"
                  max="100"
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(e.target.value)}
                  placeholder="20"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="discount_label" className="text-[13px]">Label</Label>
                <Input
                  id="discount_label"
                  value={discountLabel}
                  onChange={(e) => setDiscountLabel(e.target.value)}
                  placeholder="20% OFF"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="discount_expires" className="text-[13px]">Expires At</Label>
              <Input
                id="discount_expires"
                type="date"
                value={discountExpiresAt}
                onChange={(e) => setDiscountExpiresAt(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">Leave empty for a permanent discount</p>
            </div>
          </div>

          {/* Toggles */}
          <div className="grid grid-cols-3 gap-3">
            <div className="flex items-center gap-2">
              <Switch checked={isActive} onCheckedChange={setIsActive} />
              <Label className="text-[13px]">Active</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={isFeatured} onCheckedChange={setIsFeatured} />
              <Label className="text-[13px]">Featured</Label>
            </div>
            <div className="space-y-1">
              <Label htmlFor="sort_order" className="text-[13px]">Sort Order</Label>
              <Input
                id="sort_order"
                type="number"
                min="0"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : isEditing ? 'Update Plan' : 'Create Plan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
