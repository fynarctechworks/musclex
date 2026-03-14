"use client";

import { AppLayout } from "@/components/layout/app-layout";
import {
  FormInput,
  FormSelect,
  FormTextarea,
  FormDatePicker,
} from "@/components/shared";
import { apiClient } from "@/lib/api";
import { Staff, Branch } from "@/lib/types";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";

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

export default function NewClassPage() {
  const { gymPath } = useGymSlug();
  const router = useRouter();
  const { register, handleSubmit } = useForm<CreateClassForm>();

  const { data: trainers } = useQuery<Staff[]>({
    queryKey: ["trainers"],
    queryFn: () => apiClient.get("/staff?role=trainer"),
  });

  const { data: branches } = useQuery<Branch[]>({
    queryKey: ["branches"],
    queryFn: () => apiClient.get("/branches"),
  });

  const mutation = useMutation({
    mutationFn: (data: CreateClassForm) =>
      apiClient.post("/classes", {
        ...data,
        capacity: Number(data.capacity),
        duration_minutes: Number(data.duration_minutes),
      }),
    onSuccess: () => {
      toast.success("Class created successfully");
      router.push(gymPath("/schedule"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const categories = [
    { label: "Yoga", value: "yoga" },
    { label: "HIIT", value: "hiit" },
    { label: "Strength", value: "strength" },
    { label: "Cardio", value: "cardio" },
    { label: "Pilates", value: "pilates" },
    { label: "CrossFit", value: "crossfit" },
    { label: "Zumba", value: "zumba" },
    { label: "Spinning", value: "spinning" },
    { label: "Boxing", value: "boxing" },
    { label: "Other", value: "other" },
  ];

  return (
    <AppLayout>
      <div className="max-w-2xl">
        <Link
          href={gymPath("/schedule")}
          className="text-sm text-primary hover:text-primary/80 flex items-center gap-1 mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Schedule
        </Link>
        <h1 className="text-xl font-semibold text-foreground mb-6">Create New Class</h1>

        <form
          onSubmit={handleSubmit((data) => mutation.mutate(data))}
          className="space-y-4"
        >
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <FormInput
              label="Class Name"
              {...register("name", { required: "Class name is required" })}
              placeholder="e.g. Morning Yoga"
            />

            <div className="grid grid-cols-2 gap-4">
              <FormSelect
                label="Category"
                {...register("category", { required: "Category is required" })}
                options={categories}
              />
              <FormSelect
                label="Branch"
                {...register("branch_id", { required: "Branch is required" })}
                options={
                  branches?.map((b) => ({ label: b.name, value: b.id })) ?? []
                }
              />
            </div>

            <FormSelect
              label="Trainer"
              {...register("trainer_id", { required: "Trainer is required" })}
              options={
                trainers?.map((t) => ({
                  label: t.full_name,
                  value: t.id,
                })) ?? []
              }
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
              />
              <FormInput
                label="Duration (min)"
                type="number"
                {...register("duration_minutes", {
                  required: "Required",
                  min: { value: 15, message: "Min 15" },
                })}
                placeholder="60"
              />
            </div>

            <FormDatePicker
              label="Starts At"
              type="datetime-local"
              {...register("starts_at", {
                required: "Start time is required",
              })}
            />

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
