"use client";

import { AppLayout } from "@/components/layout/app-layout";
import {
  FormInput,
  FormSelect,
  FormTextarea,
  AccessDenied,
} from "@/components/shared";
import { FieldWrapper } from "@/components/shared/form-fields";
import { useRequirePermission } from "@/hooks/use-require-permission";
import { apiClient } from "@/lib/api";
import { Staff, Branch } from "@/lib/types";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";
import { Input } from "@/components/ui/input";

interface CreateClassForm {
  name: string;
  category: string;
  branch_id: string;
  trainer_id: string;
  room: string;
  capacity: number;
  duration_minutes: number;
  starts_at: string;
  description: string;
}

const categories = [
  { label: "Cardio", value: "cardio" },
  { label: "Strength", value: "strength" },
  { label: "Flexibility", value: "flexibility" },
  { label: "Mind & Body", value: "mind_body" },
  { label: "Dance", value: "dance" },
  { label: "Martial Arts", value: "martial_arts" },
  { label: "Rehabilitation", value: "rehabilitation" },
  { label: "Other", value: "other" },
];

export default function NewClassPage() {
  const { allowed, checked } = useRequirePermission("classes", "create", "deny");
  const { gymPath } = useGymSlug();
  const router = useRouter();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<CreateClassForm>();

  const { data: trainers } = useQuery<Staff[]>({
    queryKey: ["trainers"],
    queryFn: () =>
      apiClient
        .get<{ data: Staff[]; total: number }>("/staff", {
          params: { role: "trainer", limit: 100 },
        })
        .then((r) => r.data),
  });

  const { data: branches } = useQuery<Branch[]>({
    queryKey: ["branches"],
    queryFn: () =>
      apiClient
        .get<{ data: Branch[] }>("/branches")
        .then((r) => r.data ?? r),
  });

  const mutation = useMutation({
    mutationFn: (data: CreateClassForm) => {
      // Convert datetime-local value to ISO string
      const startsAt = data.starts_at
        ? new Date(data.starts_at).toISOString()
        : data.starts_at;

      return apiClient.post("/classes", {
        name: data.name,
        category: data.category,
        branch_id: data.branch_id,
        trainer_id: data.trainer_id,
        room: data.room || undefined,
        capacity: Number(data.capacity),
        duration_minutes: Number(data.duration_minutes),
        starts_at: startsAt,
        description: data.description || undefined,
      });
    },
    onSuccess: () => {
      toast.success("Class created successfully");
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      router.push(gymPath("/schedule"));
    },
    onError: (err: Error) => toast.error(err.message || "Failed to create class"),
  });

  if (checked && !allowed) {
    return (
      <AppLayout>
        <AccessDenied module="classes" />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-2xl">
        <Link
          href={gymPath("/schedule")}
          className="text-sm text-primary hover:text-primary/80 flex items-center gap-1 mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Schedule
        </Link>
        <h1 className="text-xl font-semibold text-foreground mb-6">
          Create New Class
        </h1>

        <form
          onSubmit={handleSubmit((data) => mutation.mutate(data))}
          className="space-y-4"
        >
          <div className="bg-card border border-border rounded-lg p-6 space-y-4">
            <FormInput
              label="Class Name"
              {...register("name", { required: "Class name is required" })}
              placeholder="e.g. Morning Yoga"
              error={errors.name?.message}
            />

            <div className="grid grid-cols-2 gap-4">
              <Controller
                name="category"
                control={control}
                rules={{ required: "Category is required" }}
                render={({ field }) => (
                  <FormSelect
                    label="Category"
                    value={field.value || ""}
                    onValueChange={field.onChange}
                    options={categories}
                    error={errors.category?.message}
                  />
                )}
              />
              <Controller
                name="branch_id"
                control={control}
                rules={{ required: "Branch is required" }}
                render={({ field }) => (
                  <FormSelect
                    label="Branch"
                    value={field.value || ""}
                    onValueChange={field.onChange}
                    options={
                      branches?.map((b) => ({ label: b.name, value: b.id })) ??
                      []
                    }
                    error={errors.branch_id?.message}
                  />
                )}
              />
            </div>

            <Controller
              name="trainer_id"
              control={control}
              rules={{ required: "Trainer is required" }}
              render={({ field }) => (
                <FormSelect
                  label="Trainer"
                  value={field.value || ""}
                  onValueChange={field.onChange}
                  options={
                    trainers?.map((t) => ({
                      label: t.full_name,
                      value: t.id,
                    })) ?? []
                  }
                  error={errors.trainer_id?.message}
                />
              )}
            />

            <div className="grid grid-cols-3 gap-4">
              <FormInput
                label="Room"
                {...register("room")}
                placeholder="e.g. Studio A"
              />
              <FormInput
                label="Capacity"
                type="number"
                {...register("capacity", {
                  required: "Required",
                  min: { value: 1, message: "Min 1" },
                })}
                placeholder="20"
                error={errors.capacity?.message}
              />
              <FormInput
                label="Duration (min)"
                type="number"
                {...register("duration_minutes", {
                  required: "Required",
                  min: { value: 15, message: "Min 15" },
                })}
                placeholder="60"
                error={errors.duration_minutes?.message}
              />
            </div>

            <FieldWrapper
              label="Starts At"
              error={errors.starts_at?.message}
            >
              <Input
                type="datetime-local"
                min={new Date().toISOString().slice(0, 16)}
                {...register("starts_at", {
                  required: "Start time is required",
                  validate: (v) =>
                    new Date(v).getTime() > Date.now() ||
                    "Cannot schedule a class in the past",
                })}
                className="h-9 bg-secondary border-border text-foreground text-[13px] focus:border-primary focus:ring-1 focus:ring-primary/30"
              />
            </FieldWrapper>

            <FormTextarea
              label="Description"
              {...register("description")}
              placeholder="Class description (optional)"
              rows={3}
            />
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={mutation.isPending}
              className="bg-primary text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {mutation.isPending ? "Creating..." : "Create Class"}
            </button>
            <Link
              href={gymPath("/schedule")}
              className="px-6 py-2.5 rounded-lg text-sm font-medium text-muted-foreground border border-border hover:bg-muted transition-colors"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}
