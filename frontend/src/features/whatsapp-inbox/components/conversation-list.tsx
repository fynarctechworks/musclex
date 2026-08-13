"use client";

import { formatDistanceToNow } from "date-fns";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Conversation } from "../types";

function relativeTime(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return "";
  }
}

export function ConversationList({
  conversations,
  selectedPhone,
  onSelect,
}: {
  conversations: Conversation[];
  selectedPhone: string | null;
  onSelect: (phone: string) => void;
}) {
  return (
    <ScrollArea className="h-full">
      <ul className="divide-y divide-hairline">
        {conversations.map((c) => {
          const isSelected = c.phone === selectedPhone;
          const title = c.member?.full_name ?? `+${c.phone}`;
          return (
            <li key={c.phone}>
              <button
                type="button"
                onClick={() => onSelect(c.phone)}
                className={cn(
                  "w-full px-4 py-3 text-left transition-colors",
                  isSelected
                    ? "bg-canvas-soft-2"
                    : "hover:bg-canvas-soft"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium text-foreground">
                    {title}
                  </span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {relativeTime(c.last_at)}
                  </span>
                </div>
                {c.member && (
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    +{c.phone}
                    {c.member.member_code ? ` · ${c.member.member_code}` : ""}
                  </p>
                )}
                <div className="mt-1 flex items-center gap-1.5">
                  {c.last_direction === "inbound" ? (
                    <ArrowDownLeft className="h-3 w-3 shrink-0 text-success" aria-label="Received" />
                  ) : (
                    <ArrowUpRight className="h-3 w-3 shrink-0 text-muted-foreground" aria-label="Sent" />
                  )}
                  <p className="truncate text-xs text-muted-foreground">{c.last_message}</p>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </ScrollArea>
  );
}
