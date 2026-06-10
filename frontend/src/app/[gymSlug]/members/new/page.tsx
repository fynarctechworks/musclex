"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, UserPlus, AlertCircle, Users } from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { AccessDenied } from "@/components/shared/access-denied";
import { useRequirePermission } from "@/hooks/use-require-permission";
import {
  FormInput,
  FormDatePicker,
  FormTextarea,
  FormSelect,
} from "@/components/shared/form-fields";
import { PhoneInput } from "@/components/shared/phone-input";
import { Button } from "@/components/ui/button";
import { PhotoUpload } from "@/components/ui/photo-upload";
import { apiClient } from "@/services/api-client";
import type { MembershipPlan, Branch } from "@/types";
import Link from "next/link";
import { format } from "date-fns";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";
import { useCreateMember, type CreateMemberDto } from "@/features/members";
import { queryKeys } from "@/services/query-client";

interface MemberFormData {
  full_name: string;
  phone: string;
  email?: string;
  date_of_birth?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  profile_photo_url?: string;
  branch_id: string;
  plan_id?: string;
  membership_start_date?: string;
  payment_method?: string;
  payment_amount?: string;
  notes?: string;
}

const PAYMENT_METHOD_OPTIONS = [
  { label: "Cash", value: "cash" },
  { label: "Card", value: "card" },
  { label: "UPI", value: "upi" },
  { label: "Bank Transfer", value: "bank_transfer" },
  { label: "Razorpay", value: "razorpay" },
];

export default function AddMemberPage() {
  const { allowed, checked } = useRequirePermission("members", "create", "deny");
  const { gymPath } = useGymSlug();
  const router = useRouter();

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<MemberFormData>({
    defaultValues: {
      full_name: "",
      phone: "",
      email: "",
      date_of_birth: "",
      emergency_contact_name: "",
      emergency_contact_phone: "",
      profile_photo_url: "",
      branch_id: "",
      plan_id: "",
      membership_start_date: format(new Date(), "yyyy-MM-dd"),
      payment_method: "cash",
      payment_amount: "",
      notes: "",
    },
  });

  const selectedPlanId = watch("plan_id");

  const { data: plans } = useQuery({
    queryKey: queryKeys.memberships.plans(),
    queryFn: () => apiClient.get<MembershipPlan[]>("/membership-plans"),
  });

  const { data: branches } = useQuery({
    queryKey: queryKeys.branches.list(),
    queryFn: () => apiClient.get<Branch[]>("/branches"),
  });

  const selectedPlan = useMemo(
    () => (plans ?? []).find((p) => p.id === selectedPlanId),
    [plans, selectedPlanId],
  );

  const memberIdPreview = useMemo(() => {
    const dateStr = format(new Date(), "yyyyMMdd");
    const random = Math.floor(1000 + Math.random() * 9000);
    return `FS-${dateStr}-${random}`;
  }, []);

  const [phoneCheck, setPhoneCheck] = useState<{
    status: 'idle' | 'checking' | 'duplicate' | 'clear';
    existingMember?: { id: string; full_name: string; member_code: string; branch_name?: string };
  }>({ status: 'idle' });

  const checkPhone = async (phone: string) => {
    if (!phone || phone.length < 7) return;
    setPhoneCheck({ status: 'checking' });
    try {
      const result = await apiClient.get<{ exists: boolean; member_id?: string; full_name?: string; member_code?: string; branch_name?: string }>(
        `/members/check-phone?phone=${encodeURIComponent(phone)}`
      );
      if (result.exists) {
        setPhoneCheck({
          status: 'duplicate',
          existingMember: {
            id: result.member_id!,
            full_name: result.full_name!,
            member_code: result.member_code!,
            branch_name: result.branch_name,
          },
        });
      } else {
        setPhoneCheck({ status: 'clear' });
      }
    } catch {
      setPhoneCheck({ status: 'idle' });
    }
  };

  const createMutation = useCreateMember();

  const onSubmit = (data: MemberFormData) => {
    const hasPlan = !!data.plan_id;
    const planPrice = selectedPlan ? Number(selectedPlan.price) : 0;
    const parsedAmount =
      data.payment_amount !== undefined && data.payment_amount !== ""
        ? Number(data.payment_amount)
        : undefined;
    // If customer hands over more than the plan price, cap the recorded
    // revenue at the plan price — the overage is returned as change.
    const recordedAmount =
      hasPlan && parsedAmount !== undefined && !Number.isNaN(parsedAmount)
        ? Math.min(parsedAmount, planPrice)
        : undefined;
    const cleanedData: CreateMemberDto = {
      full_name: data.full_name,
      phone: data.phone,
      branch_id: data.branch_id,
      email: data.email || undefined,
      date_of_birth: data.date_of_birth || undefined,
      emergency_contact_name: data.emergency_contact_name || undefined,
      emergency_contact_phone: data.emergency_contact_phone || undefined,
      profile_photo_url: data.profile_photo_url || undefined,
      plan_id: data.plan_id || undefined,
      membership_start_date: data.membership_start_date || undefined,
      payment_method: hasPlan ? data.payment_method || "cash" : undefined,
      payment_amount: recordedAmount,
      notes: data.notes || undefined,
    };
    createMutation.mutate(cleanedData, {
      onSuccess: (member) => router.push(gymPath(`/members/${member.id}`)),
    });
  };

  const receivedAmount = Number(watch("payment_amount") || 0);
  const planPriceNum = selectedPlan ? Number(selectedPlan.price) : 0;
  const changeDue =
    selectedPlanId && receivedAmount > planPriceNum
      ? receivedAmount - planPriceNum
      : 0;
  const shortfall =
    selectedPlanId && receivedAmount > 0 && receivedAmount < planPriceNum
      ? planPriceNum - receivedAmount
      : 0;

  const branchOptions = (branches ?? []).map((b) => ({
    label: b.name,
    value: b.id,
  }));

  const planOptions = (plans ?? [])
    .filter((p) => p.is_active)
    .map((p) => ({
      label: `${p.name} — ₹${p.price}`,
      value: p.id,
    }));

  const hasPlans = plans !== undefined && plans.filter((p) => p.is_active).length > 0;
  const plansLoaded = plans !== undefined;

  if (checked && !allowed) {
    return (
      <AppLayout>
        <AccessDenied module="members" />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-2xl space-y-6 pb-8">
        {/* No Plans Warning */}
        {plansLoaded && !hasPlans && (
          <div className="rounded-lg border border-warning/30 bg-warning/10 p-4">
            <p className="text-sm font-medium text-warning">
              You need at least one membership plan before adding members.
            </p>
            <Link href={gymPath("/settings/plans?create=true")} className="mt-2 inline-block text-sm text-primary underline">
              Create a membership plan →
            </Link>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href={gymPath("/members")}>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              Add New Member
            </h1>
            <p className="text-sm text-muted-foreground">
              Fill in the details below to register a new member
            </p>
          </div>
        </div>

        {/* Member ID Preview */}
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
            Auto-generated Member ID
          </p>
          <p className="font-mono text-lg font-semibold text-primary">
            {memberIdPreview}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Format: FS-YYYYMMDD-XXXX (assigned on creation)
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Personal Information */}
          <div className="rounded-lg border border-border bg-card p-6 space-y-4">
            <h2 className="text-base font-semibold text-foreground">
              Personal Information
            </h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormInput
                label="Full Name *"
                placeholder="Enter full name"
                error={errors.full_name?.message}
                {...register("full_name", { required: "Full name is required" })}
              />
              <Controller
                name="phone"
                control={control}
                rules={{
                  required: "Phone number is required",
                  validate: (v) => {
                    const d = (v ?? "").replace(/\D/g, "");
                    return (d.length >= 7 && d.length <= 15) || "Enter a valid phone number";
                  },
                }}
                render={({ field }) => (
                  <PhoneInput
                    label="Phone *"
                    value={field.value}
                    onChange={(val) => {
                      field.onChange(val);
                      setPhoneCheck({ status: "idle" });
                    }}
                    onBlur={() => checkPhone(field.value)}
                    error={errors.phone?.message}
                  />
                )}
              />
            </div>

            {/* Phone duplicate warning */}
            {phoneCheck.status === 'checking' && (
              <p className="text-xs text-muted-foreground">Checking phone number...</p>
            )}
            {phoneCheck.status === 'duplicate' && phoneCheck.existingMember && (
              <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-warning">Phone number already registered</p>
                    <p className="text-muted-foreground">
                      {phoneCheck.existingMember.full_name} ({phoneCheck.existingMember.member_code})
                      {phoneCheck.existingMember.branch_name ? ` · ${phoneCheck.existingMember.branch_name}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Link href={gymPath(`/members/${phoneCheck.existingMember.id}/family/add`)}>
                    <Button type="button" size="sm" variant="outline" className="text-xs border-warning/30 text-warning hover:bg-warning/10">
                      <Users className="h-3 w-3 mr-1" />
                      Add as Family Member
                    </Button>
                  </Link>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-xs text-muted-foreground"
                    onClick={() => setPhoneCheck({ status: 'idle' })}
                  >
                    Use different number
                  </Button>
                </div>
              </div>
            )}
            {phoneCheck.status === 'clear' && (
              <p className="text-xs text-success">✓ Phone number available</p>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <FormInput
                label="Email"
                placeholder="member@example.com"
                type="email"
                error={errors.email?.message}
                {...register("email", {
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: "Enter a valid email address",
                  },
                })}
              />
              <FormDatePicker
                label="Date of Birth"
                error={errors.date_of_birth?.message}
                {...register("date_of_birth")}
              />
            </div>

            <Controller
              name="profile_photo_url"
              control={control}
              render={({ field }) => (
                <PhotoUpload
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          </div>

          {/* Emergency Contact */}
          <div className="rounded-lg border border-border bg-card p-6 space-y-4">
            <h2 className="text-base font-semibold text-foreground">
              Emergency Contact
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormInput
                label="Contact Name"
                placeholder="Emergency contact name"
                error={errors.emergency_contact_name?.message}
                {...register("emergency_contact_name")}
              />
              <FormInput
                label="Contact Phone"
                placeholder="Contact phone number"
                error={errors.emergency_contact_phone?.message}
                {...register("emergency_contact_phone")}
              />
            </div>
          </div>

          {/* Membership */}
          <div className="rounded-lg border border-border bg-card p-6 space-y-4">
            <h2 className="text-base font-semibold text-foreground">
              Membership
            </h2>
            <Controller
              name="branch_id"
              control={control}
              rules={{ required: "Branch is required" }}
              render={({ field }) => (
                <FormSelect
                  label="Branch *"
                  placeholder="Select branch"
                  value={field.value}
                  onValueChange={field.onChange}
                  options={branchOptions}
                  error={errors.branch_id?.message}
                />
              )}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Controller
                name="plan_id"
                control={control}
                render={({ field }) => (
                  <FormSelect
                    label="Membership Plan"
                    placeholder="Select a plan"
                    value={field.value}
                    onValueChange={field.onChange}
                    options={planOptions}
                    error={errors.plan_id?.message}
                  />
                )}
              />
              <FormDatePicker
                label="Start Date"
                error={errors.membership_start_date?.message}
                {...register("membership_start_date")}
              />
            </div>

            {selectedPlanId && (
              <div className="grid gap-4 sm:grid-cols-2 pt-2 border-t border-border">
                <Controller
                  name="payment_method"
                  control={control}
                  render={({ field }) => (
                    <FormSelect
                      label="Payment Method *"
                      placeholder="Select method"
                      value={field.value}
                      onValueChange={field.onChange}
                      options={PAYMENT_METHOD_OPTIONS}
                      error={errors.payment_method?.message}
                    />
                  )}
                />
                <FormInput
                  label="Amount Received"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder={
                    selectedPlan ? `₹${selectedPlan.price}` : "0.00"
                  }
                  error={errors.payment_amount?.message}
                  {...register("payment_amount")}
                />
                <div className="sm:col-span-2 -mt-2 space-y-1">
                  <p className="text-xs text-muted-foreground">
                    Leave blank to charge the plan price (₹
                    {selectedPlan?.price ?? 0}). Payment is recorded as paid.
                  </p>
                  {changeDue > 0 && (
                    <p className="text-xs font-medium text-success">
                      Change to return: ₹{changeDue.toFixed(2)} (revenue
                      recorded as ₹{planPriceNum.toFixed(2)})
                    </p>
                  )}
                  {shortfall > 0 && (
                    <p className="text-xs font-medium text-warning">
                      Short by ₹{shortfall.toFixed(2)} — partial payment will
                      be recorded.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="rounded-lg border border-border bg-card p-6 space-y-4">
            <h2 className="text-base font-semibold text-foreground">
              Notes
            </h2>
            <FormTextarea
              label="Additional Notes"
              placeholder="Any additional information about the member..."
              {...register("notes")}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3">
            <Link href={gymPath("/members")}>
              <Button
                type="button"
                variant="ghost"
                className="text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                Cancel
              </Button>
            </Link>
            <Button
              type="submit"
              disabled={isSubmitting || createMutation.isPending || phoneCheck.status === 'duplicate'}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <UserPlus className="mr-2 h-4 w-4" />
              {createMutation.isPending ? "Creating..." : "Create Member"}
            </Button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}
