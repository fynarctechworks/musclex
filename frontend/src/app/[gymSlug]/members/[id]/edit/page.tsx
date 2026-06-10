"use client";

import React, { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { ArrowLeft, Save } from "lucide-react";
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
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import Link from "next/link";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";
import { useMember, useUpdateMember } from "@/features/members";

interface EditMemberFormData {
  full_name: string;
  phone: string;
  email?: string;
  date_of_birth?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  profile_photo_url?: string;
  checkin_method?: string;
  notes?: string;
}

export default function EditMemberPage() {
  const { allowed, checked } = useRequirePermission("members", "edit", "deny");
  const { gymPath } = useGymSlug();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const memberId = params.id;

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<EditMemberFormData>();

  const { data: member, isLoading, isError } = useMember(memberId);
  const updateMutation = useUpdateMember(memberId);

  // Pre-populate form when member data loads
  useEffect(() => {
    if (member) {
      reset({
        full_name: member.full_name,
        phone: member.phone,
        email: member.email ?? "",
        date_of_birth: member.date_of_birth ?? "",
        emergency_contact_name: member.emergency_contact_name ?? "",
        emergency_contact_phone: member.emergency_contact_phone ?? "",
        profile_photo_url: member.profile_photo_url ?? "",
        checkin_method: member.checkin_method ?? "manual",
        notes: member.notes ?? "",
      });
    }
  }, [member, reset]);

  const onSubmit = (data: EditMemberFormData) => {
    // Strip empty strings to avoid overwriting with blanks
    const payload: Partial<EditMemberFormData> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== "" && value !== undefined) {
        (payload as Record<string, string>)[key] = value;
      }
    }
    updateMutation.mutate(payload as Record<string, unknown>, {
      onSuccess: () => router.push(gymPath(`/members/${memberId}`)),
    });
  };

  const checkinMethodOptions = [
    { label: "Manual", value: "manual" },
    { label: "QR Code", value: "qr" },
    { label: "Facial Recognition", value: "facial" },
  ];

  if (checked && !allowed) {
    return (
      <AppLayout>
        <AccessDenied module="members" />
      </AppLayout>
    );
  }

  if (isLoading) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-2xl space-y-6">
          <LoadingSkeleton className="h-10 w-48" />
          <LoadingSkeleton className="h-64 w-full" />
          <LoadingSkeleton className="h-48 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (isError || !member) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-2xl text-center py-12">
          <p className="text-muted-foreground">Member not found.</p>
          <Link href={gymPath("/members")}>
            <Button variant="ghost" className="mt-4">
              Back to Members
            </Button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href={gymPath(`/members/${memberId}`)}>
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
              Edit Member
            </h1>
            <p className="text-sm text-muted-foreground">
              <span className="font-mono text-primary">
                {member.member_code}
              </span>{" "}
              — {member.full_name}
            </p>
          </div>
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
                {...register("full_name", {
                  required: "Full name is required",
                })}
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
                    onChange={field.onChange}
                    error={errors.phone?.message}
                  />
                )}
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

          {/* Preferences */}
          <div className="rounded-lg border border-border bg-card p-6 space-y-4">
            <h2 className="text-base font-semibold text-foreground">
              Preferences
            </h2>
            <Controller
              name="checkin_method"
              control={control}
              render={({ field }) => (
                <FormSelect
                  label="Preferred Check-in Method"
                  value={field.value}
                  onValueChange={field.onChange}
                  options={checkinMethodOptions}
                />
              )}
            />
          </div>

          {/* Notes */}
          <div className="rounded-lg border border-border bg-card p-6 space-y-4">
            <h2 className="text-base font-semibold text-foreground">Notes</h2>
            <FormTextarea
              label="Additional Notes"
              placeholder="Any additional information about the member..."
              {...register("notes")}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3">
            <Link href={gymPath(`/members/${memberId}`)}>
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
              disabled={
                isSubmitting || updateMutation.isPending || !isDirty
              }
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <Save className="mr-2 h-4 w-4" />
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}
