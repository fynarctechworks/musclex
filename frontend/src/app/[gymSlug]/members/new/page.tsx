"use client";

import React, { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
// Using react-hook-form built-in validation
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, UserPlus } from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import {
  FormInput,
  FormDatePicker,
  FormTextarea,
  FormSelect,
} from "@/components/shared/form-fields";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api";
import type { MembershipPlan, Member, Branch } from "@/lib/types";
import Link from "next/link";
import { format } from "date-fns";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";

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
  notes?: string;
}

export default function AddMemberPage() {
  const { gymPath } = useGymSlug();
  const router = useRouter();

  const {
    register,
    handleSubmit,
    control,
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
      notes: "",
    },
  });

  const { data: plans } = useQuery({
    queryKey: ["membership-plans"],
    queryFn: () => apiClient.get<MembershipPlan[]>("/membership-plans"),
  });

  const { data: branches } = useQuery({
    queryKey: ["branches"],
    queryFn: () => apiClient.get<Branch[]>("/branches"),
  });

  const memberIdPreview = useMemo(() => {
    const dateStr = format(new Date(), "yyyyMMdd");
    const random = Math.floor(1000 + Math.random() * 9000);
    return `FS-${dateStr}-${random}`;
  }, []);

  const createMutation = useMutation({
    mutationFn: (data: MemberFormData) =>
      apiClient.post<Member>("/members", data),
    onSuccess: (member) => {
      toast.success("Member created successfully");
      router.push(gymPath(`/members/${member.id}`));
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create member");
    },
  });

  const onSubmit = (data: MemberFormData) => {
    const cleanedData = {
      ...data,
      email: data.email || undefined,
      profile_photo_url: data.profile_photo_url || undefined,
      plan_id: data.plan_id || undefined,
      membership_start_date: data.membership_start_date || undefined,
    };
    createMutation.mutate(cleanedData);
  };

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

  return (
    <AppLayout>
      <div className="mx-auto max-w-2xl space-y-6">
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
        <div className="rounded-xl border border-border bg-card p-4">
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
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
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
              <FormInput
                label="Phone *"
                placeholder="+91 98765 43210"
                error={errors.phone?.message}
                {...register("phone", {
                  required: "Phone number is required",
                  pattern: {
                    value: /^\+?[\d\s-]{7,15}$/,
                    message: "Enter a valid phone number",
                  },
                })}
              />
            </div>

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

            <FormInput
              label="Profile Photo URL"
              placeholder="https://example.com/photo.jpg"
              error={errors.profile_photo_url?.message}
              {...register("profile_photo_url")}
            />
          </div>

          {/* Emergency Contact */}
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
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
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
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
          </div>

          {/* Notes */}
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
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
              disabled={isSubmitting || createMutation.isPending}
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
