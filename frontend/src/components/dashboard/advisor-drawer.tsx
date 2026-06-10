"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Sparkles, Send, X, Loader2, Mic, MicOff } from "lucide-react";
import { apiClient } from "@/lib/api";
import { cn } from "@/lib/utils";

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: any) => void) | null;
  onend: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
}

function createRecognition(): SpeechRecognitionLike | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!Ctor) return null;
  const r: SpeechRecognitionLike = new Ctor();
  r.continuous = false;
  r.interimResults = true;
  r.lang = "en-IN";
  return r;
}

interface AdvisorDrawerProps {
  /** Active dashboard view context — passed to the AI as scope. */
  context?: Record<string, unknown>;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

const SAMPLE_PROMPTS = [
  "Why is revenue down today?",
  "Who should I call first today?",
  "Predict churn for this month",
  "How are renewals trending?",
];

/**
 * Floating AI Advisor — Wave 5. Click the bottom-right chip to open a
 * drawer with a chat panel. Every message carries the current view
 * context so the AI answers in scope without re-asking.
 */
export function AdvisorDrawer({ context }: AdvisorDrawerProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [listening, setListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    const r = createRecognition();
    setVoiceSupported(!!r);
    if (!r) return;
    recognitionRef.current = r;
    return () => {
      try {
        r.abort();
      } catch {}
    };
  }, []);

  const toggleVoice = () => {
    const r = recognitionRef.current;
    if (!r) return;
    if (listening) {
      r.stop();
      return;
    }
    setDraft("");
    r.onresult = (event: any) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setDraft(transcript);
    };
    r.onend = () => {
      setListening(false);
      // Auto-submit if we got a non-trivial transcript
      window.setTimeout(() => {
        setDraft((d) => {
          const t = d.trim();
          if (t.length > 2) submit(t);
          return d;
        });
      }, 50);
    };
    r.onerror = () => {
      setListening(false);
    };
    try {
      r.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  };

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [open, messages.length]);

  const send = useMutation({
    mutationFn: (message: string) =>
      apiClient.post<{
        conversation_id: string;
        response: string;
        messages: ChatMessage[];
      }>("/ai/chat", {
        message,
        conversation_id: conversationId ?? undefined,
        view_context: context ?? {},
      }),
    onMutate: (message) => {
      setMessages((m) => [
        ...m,
        { role: "user", content: message, timestamp: new Date().toISOString() },
      ]);
    },
    onSuccess: (res) => {
      setConversationId(res.conversation_id);
      setMessages(res.messages);
    },
    onError: () => {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content:
            "Sorry, I couldn't reach the advisor. Check that ANTHROPIC_API_KEY is configured.",
          timestamp: new Date().toISOString(),
        },
      ]);
    },
  });

  const submit = (text: string) => {
    const t = text.trim();
    if (!t || send.isPending) return;
    setDraft("");
    send.mutate(t);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-[13px] font-medium text-primary-foreground shadow-level-4 hover:bg-primary/90"
        aria-label="Open AI Advisor"
      >
        <Sparkles className="h-4 w-4" />
        Ask AI
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex justify-end"
          onClick={() => setOpen(false)}
        >
          <div
            className="h-full w-full max-w-md bg-card border-l border-border flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <h2 className="text-[14px] font-semibold text-foreground">
                  AI Advisor
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-muted-foreground hover:bg-canvas-soft hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 ? (
                <div className="space-y-3">
                  <p className="text-[13px] text-muted-foreground">
                    I'm aware of your current view. Ask anything about your
                    gym's performance, members, or operations.
                  </p>
                  <div className="grid grid-cols-1 gap-1.5">
                    {SAMPLE_PROMPTS.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => submit(p)}
                        className="text-left rounded-md border border-border/60 bg-background/40 px-3 py-2 text-[12px] text-foreground hover:border-primary/40 hover:bg-primary/5"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((m, i) => (
                  <div
                    key={i}
                    className={cn(
                      "rounded-lg px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap",
                      m.role === "user"
                        ? "bg-canvas-soft-2 text-foreground ml-6"
                        : "bg-background/50 text-foreground border border-border/40 mr-6",
                    )}
                  >
                    {m.content}
                  </div>
                ))
              )}
              {send.isPending && (
                <div className="rounded-lg border border-border/40 bg-background/50 px-3 py-2 mr-6 text-[13px] text-muted-foreground inline-flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Thinking…
                </div>
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                submit(draft);
              }}
              className="p-3 border-t border-border bg-background/40 flex gap-2"
            >
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={listening ? "Listening…" : "Ask about your gym…"}
                className={cn(
                  "flex-1 rounded-md border bg-card px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none",
                  listening
                    ? "border-primary ring-2 ring-primary/30"
                    : "border-border focus:border-primary",
                )}
                disabled={send.isPending}
              />
              {voiceSupported && (
                <button
                  type="button"
                  onClick={toggleVoice}
                  disabled={send.isPending}
                  className={cn(
                    "inline-flex items-center justify-center rounded-md px-3 disabled:opacity-50",
                    listening
                      ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      : "bg-muted text-foreground hover:bg-canvas-soft-2",
                  )}
                  aria-label={listening ? "Stop listening" : "Start voice input"}
                  title={listening ? "Stop listening" : "Voice input"}
                >
                  {listening ? (
                    <MicOff className="h-4 w-4" />
                  ) : (
                    <Mic className="h-4 w-4" />
                  )}
                </button>
              )}
              <button
                type="submit"
                disabled={send.isPending || !draft.trim()}
                className="inline-flex items-center justify-center rounded-md bg-primary px-3 text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                aria-label="Send"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
