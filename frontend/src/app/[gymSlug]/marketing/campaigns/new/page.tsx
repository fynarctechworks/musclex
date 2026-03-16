"use client";

import { AppLayout } from "@/components/layout/app-layout";
import {
  FormInput,
  FormSelect,
  FormTextarea,
  FormDatePicker,
} from "@/components/shared";
import { useCreateCampaign } from "@/features/marketing/hooks";
import type { CampaignSegment } from "@/features/marketing/types";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";
import { useAuthStore } from "@/stores/auth-store";

interface CreateCampaignForm {
  name: string;
  segment: CampaignSegment;
  channels: string[];
  message_template: string;
  scheduled_at: string;
}

export default function NewCampaignPage() {
  const { gymPath } = useGymSlug();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { register, handleSubmit, formState: { errors } } = useForm<CreateCampaignForm>();

  const mutation = useCreateCampaign();

  const onSubmit = (data: CreateCampaignForm) => {
    mutation.mutate(
      {
        name: data.name,
        segment: data.segment,
        channels: data.channels,
        message_template: data.message_template,
        created_by_staff_id: user?.id ?? "",
        scheduled_at: data.scheduled_at || undefined,
      },
      { onSuccess: () => router.push(gymPath("/marketing")) }
    );
  };

  const segments = [
    { label: "All Members", value: "all" },
    { label: "Active Members", value: "active" },
    { label: "Expiring Soon", value: "expiring" },
    { label: "Expired Members", value: "expired" },
    { label: "New Members", value: "new" },
    { label: "Inactive Members", value: "inactive" },
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
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4"
        >
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <FormInput
              label="Campaign Name"
              {...register("name", { required: "Name is required" })}
              placeholder="e.g. Summer Renewal Drive"
              error={errors.name?.message}
            />

            <FormSelect
              label="Target Segment"
              {...register("segment", { required: "Segment is required" })}
              options={segments}
              error={errors.segment?.message}
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
              {errors.channels && (
                <p className="text-xs text-destructive mt-1">{errors.channels.message}</p>
              )}
            </div>

            <FormTextarea
              label="Message Template"
              {...register("message_template", {
                required: "Message is required",
              })}
              placeholder="Hi {{name}}, your membership is expiring on {{expiry_date}}..."
              rows={4}
              error={errors.message_template?.message}
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
