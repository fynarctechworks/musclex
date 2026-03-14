"use client";

import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { apiClient } from "@/lib/api";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Zap, Bell, Mail, MessageSquare } from "lucide-react";
import Link from "next/link";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";

interface AutomationRule {
  id: string;
  name: string;
  trigger: string;
  action: string;
  channel: string;
  enabled: boolean;
  icon: typeof Bell;
}

const defaultRules: AutomationRule[] = [
  {
    id: "expiry_reminder",
    name: "Membership Expiry Reminder",
    trigger: "7 days before membership expires",
    action: "Send renewal reminder",
    channel: "sms",
    enabled: true,
    icon: Bell,
  },
  {
    id: "welcome_message",
    name: "Welcome New Members",
    trigger: "When a new member signs up",
    action: "Send welcome message",
    channel: "whatsapp",
    enabled: true,
    icon: MessageSquare,
  },
  {
    id: "inactive_followup",
    name: "Inactive Member Follow-up",
    trigger: "No check-in for 14 days",
    action: "Send re-engagement message",
    channel: "email",
    enabled: false,
    icon: Mail,
  },
  {
    id: "birthday_wish",
    name: "Birthday Wishes",
    trigger: "On member's birthday",
    action: "Send birthday greeting with offer",
    channel: "whatsapp",
    enabled: false,
    icon: Bell,
  },
];

export default function AutomationPage() {
  const { gymPath } = useGymSlug();
  const [rules, setRules] = useState(defaultRules);

  const toggleMutation = useMutation({
    mutationFn: async ({
      ruleId,
      enabled,
    }: {
      ruleId: string;
      enabled: boolean;
    }) => {
      await apiClient.patch(`/campaigns/automation/${ruleId}`, { enabled });
      return { ruleId, enabled };
    },
    onSuccess: ({ ruleId, enabled }) => {
      setRules((prev) =>
        prev.map((r) => (r.id === ruleId ? { ...r, enabled } : r)),
      );
      toast.success(
        `Rule ${enabled ? "enabled" : "disabled"}`,
      );
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <AppLayout>
      <Link
        href={gymPath("/marketing")}
        className="text-sm text-primary hover:text-primary/80 flex items-center gap-1 mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Marketing
      </Link>

      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
          <Zap className="w-6 h-6 text-amber-500" /> Automation Rules
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Set up automated messages based on triggers
        </p>
      </div>

      <div className="space-y-4">
        {rules.map((rule) => {
          const Icon = rule.icon;
          return (
            <div
              key={rule.id}
              className={`bg-card border rounded-xl p-5 transition-colors ${
                rule.enabled ? "border-primary/30" : "border-border"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div
                    className={`p-2 rounded-lg ${
                      rule.enabled ? "bg-primary/10" : "bg-muted"
                    }`}
                  >
                    <Icon
                      className={`w-5 h-5 ${
                        rule.enabled
                          ? "text-primary"
                          : "text-muted-foreground"
                      }`}
                    />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-foreground">
                      {rule.name}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Trigger: {rule.trigger}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Action: {rule.action}
                    </p>
                    <span className="inline-block mt-1 px-1.5 py-0.5 bg-muted text-muted-foreground text-[10px] rounded uppercase">
                      {rule.channel}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() =>
                    toggleMutation.mutate({
                      ruleId: rule.id,
                      enabled: !rule.enabled,
                    })
                  }
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    rule.enabled ? "bg-primary" : "bg-border"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                      rule.enabled ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </AppLayout>
  );
}
