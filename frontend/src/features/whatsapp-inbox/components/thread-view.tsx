"use client";

import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useSendReply, useThread } from "../hooks";
import type { MessageStatus, ThreadMessage } from "../types";

/** Status tick text for outbound bubbles, WhatsApp-style. */
const STATUS_LABEL: Record<MessageStatus, string> = {
  received: "received",
  sent: "sent ✓",
  delivered: "delivered ✓✓",
  read: "read ✓✓",
  failed: "failed — not delivered",
};

function Bubble({ message }: { message: ThreadMessage }) {
  const outbound = message.direction === "outbound";
  return (
    <div className={cn("flex", outbound ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[75%] rounded-lg px-3 py-2",
          outbound
            ? "bg-primary text-primary-foreground"
            : "bg-canvas-soft-2 text-foreground"
        )}
      >
        <p className="whitespace-pre-wrap break-words text-sm leading-5">
          {message.message_type === "text" ? message.body : message.body || `[${message.message_type}]`}
        </p>
        <p
          className={cn(
            "mt-1 text-[10px]",
            outbound ? "text-primary-foreground/70" : "text-muted-foreground",
            message.status === "failed" && "text-error-deep font-medium"
          )}
        >
          {format(new Date(message.created_at), "MMM d, HH:mm")}
          {outbound && ` · ${STATUS_LABEL[message.status] ?? message.status}`}
        </p>
      </div>
    </div>
  );
}

export function ThreadView({ phone, title }: { phone: string; title: string }) {
  const { data: messages, isLoading } = useThread(phone);
  const replyMutation = useSendReply();
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const count = messages?.length ?? 0;
  useEffect(() => {
    // Keep the newest message in view when the thread grows or changes.
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [count, phone]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || replyMutation.isPending) return;
    replyMutation.mutate(
      { phone, text: trimmed },
      { onSuccess: () => setText("") }
    );
  };

  return (
    <div className="flex h-full flex-col">
      {/* Thread header */}
      <div className="border-b border-hairline px-4 py-3">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-[11px] text-muted-foreground">+{phone}</p>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-2/3" />
            <Skeleton className="ml-auto h-12 w-2/3" />
            <Skeleton className="h-12 w-1/2" />
          </div>
        ) : count === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No messages in this conversation yet.
          </p>
        ) : (
          messages!.map((m) => <Bubble key={m.id} message={m} />)
        )}
        <div ref={bottomRef} />
      </div>

      {/* Reply input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="flex items-center gap-2 border-t border-hairline p-3"
      >
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a reply…"
          disabled={replyMutation.isPending}
          maxLength={2000}
          aria-label="Reply message"
        />
        <Button
          type="submit"
          disabled={replyMutation.isPending || !text.trim()}
          className="bg-primary hover:bg-primary/90 text-primary-foreground shrink-0"
        >
          <Send className="mr-1.5 h-4 w-4" />
          {replyMutation.isPending ? "Sending…" : "Send"}
        </Button>
      </form>
    </div>
  );
}
