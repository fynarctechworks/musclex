"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { AccessDenied } from "@/components/shared/access-denied";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { TableSkeleton } from "@/components/shared/loading-skeleton";
import { Button } from "@/components/ui/button";
import { useRequirePermission } from "@/hooks/use-require-permission";
import { cn } from "@/lib/utils";
import {
  ConversationList,
  ThreadView,
  useConversations,
} from "@/features/whatsapp-inbox";

export default function WhatsAppInboxPage() {
  const { allowed, checked } = useRequirePermission("marketing", "view", "deny");
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);

  const { data: conversations, isLoading } = useConversations(100);

  const selectedConversation = useMemo(
    () => conversations?.find((c) => c.phone === selectedPhone) ?? null,
    [conversations, selectedPhone],
  );
  const threadTitle =
    selectedConversation?.member?.full_name ??
    (selectedPhone ? `+${selectedPhone}` : "");

  if (checked && !allowed) {
    return (
      <AppLayout>
        <AccessDenied module="marketing" />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Marketing"
          title="WhatsApp Inbox"
          description="Read and reply to WhatsApp messages members send to your gym's number."
        />

        {isLoading ? (
          <TableSkeleton rows={6} />
        ) : !conversations || conversations.length === 0 ? (
          <EmptyState
            icon={MessageCircle}
            title="No WhatsApp conversations yet"
            description="Connect WhatsApp under Integrations to start receiving messages. Once members message your gym's WhatsApp number, their conversations appear here."
          />
        ) : (
          <div className="grid h-[calc(100vh-260px)] min-h-[420px] grid-cols-1 overflow-hidden rounded-lg border border-hairline bg-card md:grid-cols-[320px_1fr]">
            {/* Left: conversation list (hidden on mobile while a thread is open) */}
            <div
              className={cn(
                "h-full overflow-hidden border-hairline md:border-r",
                selectedPhone ? "hidden md:block" : "block",
              )}
            >
              <ConversationList
                conversations={conversations}
                selectedPhone={selectedPhone}
                onSelect={setSelectedPhone}
              />
            </div>

            {/* Right: selected thread */}
            <div className={cn("h-full overflow-hidden", selectedPhone ? "block" : "hidden md:block")}>
              {selectedPhone ? (
                <div className="flex h-full flex-col">
                  {/* Mobile back-to-list */}
                  <div className="border-b border-hairline p-2 md:hidden">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedPhone(null)}
                      className="text-muted-foreground"
                    >
                      <ArrowLeft className="mr-1.5 h-4 w-4" /> All conversations
                    </Button>
                  </div>
                  <div className="min-h-0 flex-1">
                    <ThreadView phone={selectedPhone} title={threadTitle} />
                  </div>
                </div>
              ) : (
                <div className="flex h-full items-center justify-center">
                  <EmptyState
                    icon={MessageCircle}
                    title="Select a conversation"
                    description="Pick a conversation on the left to read the thread and reply."
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
