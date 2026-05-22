"use client";

import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { AccessDenied } from "@/components/shared";
import { MessageTemplatesManager } from "@/components/marketing/message-templates-manager";
import { AutoSendRulesPanel } from "@/components/marketing/auto-send-rules-panel";
import { ChevronRight, MessageSquare } from "lucide-react";
import Link from "next/link";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";
import { useRequirePermission } from "@/hooks/use-require-permission";
import type { MessageTemplate } from "@/features/marketing/types";

export default function SettingsMessageTemplatesPage() {
  const { allowed, checked } = useRequirePermission("settings", "view", "deny");
  const { gymPath } = useGymSlug();
  const [editSignal, setEditSignal] = useState<MessageTemplate | null>(null);

  if (checked && !allowed) {
    return (
      <AppLayout>
        <AccessDenied module="settings" />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      {/* ── Header ────────────────────────────────────────── */}
      <div className="mb-8 flex items-center gap-3">
        <Link href={gymPath("/settings")} className="text-muted-foreground hover:text-foreground transition-colors">
          <ChevronRight className="w-4 h-4 rotate-180" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2.5">
            <MessageSquare className="w-7 h-7 text-primary" /> Message Templates
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage WhatsApp, SMS and email templates — enable existing or create new
          </p>
        </div>
      </div>

      <AutoSendRulesPanel
        onEditTemplate={(t) => setEditSignal({ ...t })}
      />

      <div className="border-t border-border pt-6 mt-6">
        <h2 className="text-sm font-semibold text-foreground mb-1">All templates</h2>
        <p className="text-xs text-muted-foreground mb-4">
          Reusable messages — used by auto-send rules and one-off campaigns
        </p>
        <MessageTemplatesManager editTemplateSignal={editSignal} />
      </div>
    </AppLayout>
  );
}
