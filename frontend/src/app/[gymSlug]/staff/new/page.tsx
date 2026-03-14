"use client";

import { AppLayout } from "@/components/layout/app-layout";
import { FormInput, FormSelect } from "@/components/shared";
import { apiClient } from "@/lib/api";
import { Branch } from "@/lib/types";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";

interface CreateStaffForm {
  full_name: string;
  email: string;
  phone: string;
  role: string;
  branch_ids: string[];
  specializations: string;
}

export default function NewStaffPage() {
  const { gymPath } = useGymSlug();
  const router = useRouter();
  const { register, handleSubmit } = useForm<CreateStaffForm>();

  const { data: branches } = useQuery<Branch[]>({
    queryKey: ["branches"],
    queryFn: () => apiClient.get("/branches"),
  });

  const mutation = useMutation({
    mutationFn: (data: CreateStaffForm) =>
      apiClient.post("/staff", {
        ...data,
        specializations: data.specializations
          ? data.specializations.split(",").map((s) => s.trim())
          : [],
      }),
    onSuccess: () => {
      toast.success("Staff member added");
      router.push(gymPath("/staff"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <AppLayout>
      <div className="max-w-2xl">
        <Link
          href={gymPath("/staff")}
          className="text-sm text-primary hover:text-primary/80 flex items-center gap-1 mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Staff
        </Link>
        <h1 className="text-xl font-semibold text-foreground mb-6">Add Staff Member</h1>

        <form
          onSubmit={handleSubmit((data) => mutation.mutate(data))}
          className="space-y-4"
        >
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <FormInput
              label="Full Name"
              {...register("full_name", { required: "Name is required" })}
              placeholder="John Doe"
            />

            <div className="grid grid-cols-2 gap-4">
              <FormInput
                label="Email"
                type="email"
                {...register("email")}
                placeholder="john@example.com"
              />
              <FormInput
                label="Phone"
                {...register("phone", { required: "Phone is required" })}
                placeholder="+91 98765 43210"
              />
            </div>

            <FormSelect
              label="Role"
              {...register("role", { required: "Role is required" })}
              options={[
                { label: "Manager", value: "manager" },
                { label: "Trainer", value: "trainer" },
                { label: "Front Desk", value: "front_desk" },
              ]}
            />

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                Branches
              </label>
              <div className="space-y-2">
                {branches?.map((branch) => (
                  <label key={branch.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      value={branch.id}
                      {...register("branch_ids")}
                      className="rounded border-border bg-background text-primary"
                    />
                    <span className="text-sm text-foreground">
                      {branch.name}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <FormInput
              label="Specializations"
              {...register("specializations")}
              placeholder="Yoga, HIIT, Strength Training (comma-separated)"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={mutation.isPending}
              className="bg-primary text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {mutation.isPending ? "Adding..." : "Add Staff"}
            </button>
            <Link
              href={gymPath("/staff")}
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
