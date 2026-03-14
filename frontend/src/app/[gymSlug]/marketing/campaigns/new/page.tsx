"use client";

import { AppLayout } from "@/components/layout/app-layout";
import {
  FormInput,
  FormSelect,
  FormTextarea,
  FormDatePicker,
} from "@/components/shared";
import { apiClient } from "@/lib/api";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";

interface CreateCampaignForm {
  name: string;
  segment: string;
  channels: string[];
  message_template: string;
  scheduled_at: string;
}

export default function NewCampaignPage() {
  const { gymPath } = useGymSlug();
  const router = useRouter();
  const { register, handleSubmit } = useForm<CreateCampaignForm>();

  const mutation = useMutation({
    mutationFn: (data: CreateCampaignForm) =>
      apiClient.post("/campaigns", data),
    onSuccess: () => {
      toast.success("Campaign created");
      router.push(gymPath("/marketing"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const segments = [
    { label: "All Members", value: "all" },
    { label: "Active Members", value: "active" },
    { label: "Expiring Soon", value: "expiring_soon" },
    { label: "Expired Members", value: "expired" },
    { label: "Inactive Members", value: "inactive" },
    { label: "New Members (30 days)", value: "new_members" },
    { label: "High Churn Risk", value: "high_churn_risk" },
  ];

  return (
    <AppLayout>
      <div className="max-w-2xl">
        <Link
          href={gymPath("/marketing")}
          className="text-sm text-primary hover:text-primary/80 flex items-center gap-1 mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Marketing
        </Link>
        <h1 className="text-xl font-semibold text-foreground mb-6">
          Create Campaign
        </h1>

        <form
          onSubmit={handleSubmit((data) => mutation.mutate(data))}
          className="space-y-4"
        >
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <FormInput
              label="Campaign Name"
              {...register("name", { required: "Name is required" })}
              placeholder="e.g. Summer Renewal Drive"
            />

            <FormSelect
              label="Target Segment"
              {...register("segment", { required: "Segment is required" })}
              options={segments}
            />

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                Channels
              </label>
              <div className="flex gap-4">
                {["sms", "email", "whatsapp", "push"].map((ch) => (
                  <label key={ch} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      value={ch}
                      {...register("channels", {
                        required: "Select at least one channel",
                      })}
                      className="rounded border-border bg-background text-primary"
                    />
                    <span className="text-sm text-foreground capitalize">
                      {ch}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <FormTextarea
              label="Message Template"
              {...register("message_template", {
                required: "Message is required",
              })}
              placeholder="Hi {{name}}, your membership is expiring on {{expiry_date}}..."
              rows={4}
            />

            <FormDatePicker
              label="Schedule At (optional)"
              type="datetime-local"
              {...register("scheduled_at")}
            />
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={mutation.isPending}
              className="bg-primary text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {mutation.isPending ? "Creating..." : "Create Campaign"}
            </button>
            <Link
              href={gymPath("/marketing")}
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
