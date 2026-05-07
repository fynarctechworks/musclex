"use client";

import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader, AccessDenied } from "@/components/shared";
import { MessageTemplatesManager } from "@/components/marketing/message-templates-manager";
import { Plus, Megaphone, FileText, Zap, Users2 } from "lucide-react";
import Link from "next/link";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";
import { cn } from "@/lib/utils";
import { useRequirePermission } from "@/hooks/use-require-permission";

const subNavItems = [
  { label: "Campaigns", href: "/marketing", icon: Megaphone },
  { label: "Templates", href: "/marketing/templates", icon: FileText },
  { label: "Automation", href: "/marketing/automation", icon: Zap },
  { label: "Leads", href: "/marketing/leads", icon: Users2 },
];

export default function TemplatesPage() {
  const { allowed, checked } = useRequirePermission("marketing", "view", "deny");
  const { gymPath } = useGymSlug();
  const [createOpen, setCreateOpen] = useState(0);

  if (checked && !allowed) {
    return (
      <AppLayout>
        <AccessDenied module="marketing" />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader
        title="Marketing"
        description="Manage campaigns, templates, automation, and leads"
        actions={
          <button
            onClick={() => setCreateOpen((n) => n + 1)}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> New Template
          </button>
        }
        className="mb-4"
      />

      {/* Sub-navigation */}
      <div className="flex gap-1 mb-6 border-b border-border">
        {subNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.href === "/marketing/templates";
          return (
            <Link
              key={item.href}
              href={gymPath(item.href)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </Link>
          );
        })}
      </div>

      <MessageTemplatesManager hideInternalCreateButton openCreateSignal={createOpen} />
    </AppLayout>
  );
}
