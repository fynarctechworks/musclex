"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader, KPICard, LoadingSkeleton, AccessDenied } from "@/components/shared";
import { useRequirePermission } from "@/hooks/use-require-permission";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAiChat, useDailyBriefing } from "@/features/ai";
import { useChurnRisk, useAnalyticsDashboard, useDailyMetricsTrend } from "@/features/reports";
import type { ChatMessage, AIInsight, InsightType, InsightSeverity } from "@/features/ai";
import type { ChurnRiskEntry, DashboardSummary, TrendDataPoint } from "@/features/reports";
import {
  Send,
  Bot,
  User,
  Sparkles,
  AlertTriangle,

  Users,
  CalendarCheck,
  DollarSign,
  Target,
  Zap,
  ArrowRight,
  Lightbulb,
  Calendar,
} from "lucide-react";
import Link from "next/link";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";


// ── Insight Generator ─────────────────────────────────────

function generateInsights(
  dashboard: DashboardSummary | undefined,
  churnRisk: ChurnRiskEntry[] | undefined,
  trend: TrendDataPoint[] | undefined,
  briefing: { metrics?: { expiring_this_week?: number; pending_payments?: number }; recommendations?: string[] } | undefined,
): AIInsight[] {
  const insights: AIInsight[] = [];
  const now = new Date().toISOString();

  // Churn risk insights
  if (churnRisk && churnRisk.length > 0) {
    const highRisk = churnRisk.find((c) => c.churn_risk === "high");
    const critical = churnRisk.find((c) => c.churn_risk === "critical");
    const atRisk = (highRisk?._count ?? 0) + (critical?._count ?? 0);
    if (atRisk > 0) {
      insights.push({
        id: "churn-risk",
        type: "churn_risk",
        title: `${atRisk} Members at High Churn Risk`,
        description: `${critical?._count ?? 0} critical and ${highRisk?._count ?? 0} high-risk members may cancel soon. Their average engagement score is ${Number(critical?._avg?.engagement_score ?? highRisk?._avg?.engagement_score ?? 0).toFixed(0)}/100.`,
        severity: critical && critical._count > 0 ? "critical" : "high",
        suggested_action: "Send a personalized re-engagement campaign to at-risk members",
        metric_value: String(atRisk),
        metric_label: "at-risk members",
        created_at: now,
      });
    }
    const lowRisk = churnRisk.find((c) => c.churn_risk === "low");
    if (lowRisk && lowRisk._count > 0) {
      insights.push({
        id: "healthy-base",
        type: "churn_risk",
        title: `${lowRisk._count} Members in Good Standing`,
        description: `Your healthy member base has an average engagement score of ${Number(lowRisk._avg?.engagement_score ?? 0).toFixed(0)}/100. Consider a referral incentive to leverage their satisfaction.`,
        severity: "low",
        suggested_action: "Launch a referral campaign targeting engaged members",
        metric_value: String(lowRisk._count),
        metric_label: "healthy members",
        created_at: now,
      });
    }
  }

  // Revenue insights from trend
  if (trend && trend.length >= 14) {
    const recent7 = trend.slice(-7);
    const prior7 = trend.slice(-14, -7);
    const recentRevenue = recent7.reduce((s, d) => s + d.total_revenue, 0);
    const priorRevenue = prior7.reduce((s, d) => s + d.total_revenue, 0);
    if (priorRevenue > 0) {
      const change = ((recentRevenue - priorRevenue) / priorRevenue) * 100;
      if (change > 10) {
        insights.push({
          id: "revenue-up",
          type: "revenue",
          title: `Revenue Up ${change.toFixed(0)}% This Week`,
          description: `Weekly revenue increased from ₹${priorRevenue.toLocaleString()} to ₹${recentRevenue.toLocaleString()}. Great momentum — consider promoting your top-selling services.`,
          severity: "low",
          suggested_action: "Identify top revenue drivers and double down on marketing them",
          metric_value: `+${change.toFixed(0)}%`,
          metric_label: "week-over-week",
          created_at: now,
        });
      } else if (change < -10) {
        insights.push({
          id: "revenue-down",
          type: "revenue",
          title: `Revenue Down ${Math.abs(change).toFixed(0)}% This Week`,
          description: `Weekly revenue dropped from ₹${priorRevenue.toLocaleString()} to ₹${recentRevenue.toLocaleString()}. Review your pricing, promotions, and member engagement.`,
          severity: "high",
          suggested_action: "Run a flash sale or promotion to boost this week's revenue",
          metric_value: `${change.toFixed(0)}%`,
          metric_label: "week-over-week",
          created_at: now,
        });
      }
    }

    // Attendance trends
    const recentVisits = recent7.reduce((s, d) => s + d.total_visits, 0);
    const priorVisits = prior7.reduce((s, d) => s + d.total_visits, 0);
    if (priorVisits > 0) {
      const visitChange = ((recentVisits - priorVisits) / priorVisits) * 100;
      if (Math.abs(visitChange) > 15) {
        insights.push({
          id: "visits-change",
          type: "attendance",
          title: visitChange > 0
            ? `Attendance Up ${visitChange.toFixed(0)}%`
            : `Attendance Down ${Math.abs(visitChange).toFixed(0)}%`,
          description: visitChange > 0
            ? `Great engagement! ${recentVisits} visits this week vs ${priorVisits} last week.`
            : `Visits dropped to ${recentVisits} from ${priorVisits}. Consider sending check-in reminders.`,
          severity: visitChange > 0 ? "low" : "medium",
          suggested_action: visitChange > 0
            ? "Reward consistent members with a loyalty perk"
            : "Send push notifications encouraging members to visit",
          metric_value: `${visitChange > 0 ? "+" : ""}${visitChange.toFixed(0)}%`,
          metric_label: "weekly visits",
          created_at: now,
        });
      }
    }
  }

  // Expiring memberships
  if (briefing?.metrics?.expiring_this_week && briefing.metrics.expiring_this_week > 0) {
    insights.push({
      id: "expiring-memberships",
      type: "operational",
      title: `${briefing.metrics.expiring_this_week} Memberships Expiring This Week`,
      description: "These members need renewal follow-up before they lapse. Early renewal offers increase retention by 40%.",
      severity: briefing.metrics.expiring_this_week > 10 ? "high" : "medium",
      suggested_action: "Send personalized renewal offers with an early-bird discount",
      metric_value: String(briefing.metrics.expiring_this_week),
      metric_label: "expiring this week",
      created_at: now,
    });
  }

  // Pending payments
  if (briefing?.metrics?.pending_payments && briefing.metrics.pending_payments > 0) {
    insights.push({
      id: "pending-payments",
      type: "revenue",
      title: `${briefing.metrics.pending_payments} Pending Payments`,
      description: "Outstanding payments need follow-up. Automated reminders reduce overdue payments by 35%.",
      severity: briefing.metrics.pending_payments > 5 ? "high" : "medium",
      suggested_action: "Send payment reminder notifications to members with overdue balances",
      metric_value: String(briefing.metrics.pending_payments),
      metric_label: "pending",
      created_at: now,
    });
  }

  // Top classes insight from dashboard
  if (dashboard?.top_classes && dashboard.top_classes.length > 0) {
    const topClass = dashboard.top_classes[0];
    if (topClass.class_template?.name) {
      insights.push({
        id: "top-class",
        type: "attendance",
        title: `${topClass.class_template.name} Is Your Top Class`,
        description: `With ${topClass._sum?.total_bookings ?? 0} bookings, this class leads in popularity. Consider adding another session to meet demand.`,
        severity: "low",
        suggested_action: "Add an extra session or increase capacity for this class",
        metric_value: String(topClass._sum?.total_bookings ?? 0),
        metric_label: "bookings",
        created_at: now,
      });
    }
  }

  // Sort by severity (critical > high > medium > low)
  const severityOrder: Record<InsightSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  insights.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return insights;
}

// ── Insight Card Component ────────────────────────────────

const INSIGHT_ICONS: Record<InsightType, typeof AlertTriangle> = {
  churn_risk: Users,
  revenue: DollarSign,
  attendance: CalendarCheck,
  marketing: Target,
  trainer: Zap,
  operational: Lightbulb,
};

const SEVERITY_STYLES: Record<InsightSeverity, { bg: string; border: string; badge: string; text: string }> = {
  critical: { bg: "bg-destructive/5", border: "border-destructive/30", badge: "bg-destructive text-destructive-foreground", text: "text-destructive" },
  high: { bg: "bg-amber-500/5", border: "border-amber-500/30", badge: "bg-amber-500 text-white", text: "text-amber-500" },
  medium: { bg: "bg-primary/5", border: "border-primary/30", badge: "bg-primary text-primary-foreground", text: "text-primary" },
  low: { bg: "bg-success/5", border: "border-success/30", badge: "bg-success text-success-foreground", text: "text-success" },
};

function InsightCard({ insight }: { insight: AIInsight }) {
  const Icon = INSIGHT_ICONS[insight.type] ?? Lightbulb;
  const style = SEVERITY_STYLES[insight.severity];

  return (
    <div className={`rounded-lg border ${style.border} ${style.bg} p-4 space-y-3`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className={`w-9 h-9 rounded-lg ${style.bg} flex items-center justify-center flex-shrink-0`}>
            <Icon className={`w-4 h-4 ${style.text}`} />
          </div>
          <div>
            <h4 className="text-sm font-medium text-foreground">{insight.title}</h4>
            <p className="text-xs text-muted-foreground mt-0.5">{insight.description}</p>
          </div>
        </div>
        {insight.metric_value && (
          <div className="text-right flex-shrink-0">
            <p className={`text-lg font-semibold ${style.text}`}>{insight.metric_value}</p>
            <p className="text-[10px] text-muted-foreground">{insight.metric_label}</p>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 text-xs">
        <ArrowRight className="w-3 h-3 text-muted-foreground" />
        <span className="text-muted-foreground">{insight.suggested_action}</span>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────

export default function AIAdvisorPage() {
  const { allowed, checked } = useRequirePermission("ai", "view", "deny");
  const { gymPath } = useGymSlug();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | undefined>();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Data hooks for insight generation
  const dashboard = useAnalyticsDashboard();
  const churnRisk = useChurnRisk();
  const trend = useDailyMetricsTrend();
  const briefing = useDailyBriefing();
  const chatMutation = useAiChat();

  const insightsLoading = dashboard.isLoading || churnRisk.isLoading || trend.isLoading || briefing.isLoading;

  const insights = useMemo(
    () =>
      generateInsights(
        dashboard.data as DashboardSummary | undefined,
        churnRisk.data as ChurnRiskEntry[] | undefined,
        trend.data as TrendDataPoint[] | undefined,
        briefing.data as { metrics?: { expiring_this_week?: number; pending_payments?: number }; recommendations?: string[] } | undefined,
      ),
    [dashboard.data, churnRisk.data, trend.data, briefing.data],
  );

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || chatMutation.isPending) return;
    const userMessage = input.trim();
    setInput("");

    const userMsg: ChatMessage = { role: "user", content: userMessage, timestamp: new Date().toISOString() };
    setMessages((prev) => [...prev, userMsg]);

    chatMutation.mutate(
      { message: userMessage, conversation_id: conversationId },
      {
        onSuccess: (data) => {
          const resp = data as { conversation_id: string; response: string; messages: ChatMessage[] };
          setConversationId(resp.conversation_id);
          const assistantMsg: ChatMessage = {
            role: "assistant",
            content: resp.response,
            timestamp: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, assistantMsg]);
        },
        onError: () => {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: "Sorry, I encountered an error. Please try again.", timestamp: new Date().toISOString() },
          ]);
        },
      },
    );
  };

  if (checked && !allowed) {
    return (
      <AppLayout>
        <AccessDenied module="ai" />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title="AI Advisor"
          description="Proactive insights and intelligent recommendations"
          actions={
            <Link
              href={gymPath("/ai/briefing")}
              className="inline-flex items-center gap-2 border border-border text-sm font-medium px-4 py-2 rounded-lg hover:bg-muted transition-colors"
            >
              <Calendar className="h-4 w-4" />
              Daily Briefing
            </Link>
          }
        />

        <Tabs defaultValue="insights">
          <TabsList>
            <TabsTrigger value="insights">
              <Sparkles className="w-4 h-4 mr-1.5" />
              Insights
            </TabsTrigger>
            <TabsTrigger value="chat">
              <Bot className="w-4 h-4 mr-1.5" />
              Chat
            </TabsTrigger>
          </TabsList>

          {/* ── Insights Tab ────────────────────────────── */}
          <TabsContent value="insights">
            <div className="space-y-4">
              {/* Quick Stats */}
              {briefing.data && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <KPICard
                    label="Active Members"
                    value={(briefing.data as { metrics: { active_members: number } }).metrics?.active_members ?? 0}
                    icon={Users}
                  />
                  <KPICard
                    label="Today's Check-ins"
                    value={(briefing.data as { metrics: { today_check_ins: number } }).metrics?.today_check_ins ?? 0}
                    icon={CalendarCheck}
                  />
                  <KPICard
                    label="Today's Revenue"
                    value={`₹${((briefing.data as { metrics: { revenue_today: number } }).metrics?.revenue_today ?? 0).toLocaleString()}`}
                    icon={DollarSign}
                  />
                  <KPICard
                    label="Expiring This Week"
                    value={(briefing.data as { metrics: { expiring_this_week: number } }).metrics?.expiring_this_week ?? 0}
                    icon={AlertTriangle}
                  />
                </div>
              )}

              {/* Insights Feed */}
              {insightsLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <LoadingSkeleton key={i} className="h-28 rounded-lg" />
                  ))}
                </div>
              ) : insights.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 pt-2">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <h3 className="text-sm font-medium text-foreground">
                      {insights.length} Insight{insights.length !== 1 ? "s" : ""} Generated
                    </h3>
                  </div>
                  {insights.map((insight) => (
                    <InsightCard key={insight.id} insight={insight} />
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-border bg-card p-12 text-center">
                  <Sparkles className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    No actionable insights right now. Your gym is running smoothly!
                  </p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* ── Chat Tab ────────────────────────────────── */}
          <TabsContent value="chat">
            <div className="flex flex-col h-[calc(100vh-280px)]">
              {/* Messages */}
              <div className="flex-1 overflow-y-auto bg-card border border-border rounded-xl p-4 space-y-4">
                {/* Welcome message */}
                {messages.length === 0 && (
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Bot className="w-4 h-4 text-primary" />
                    </div>
                    <div className="max-w-[70%] rounded-xl px-4 py-3 text-sm bg-muted text-foreground">
                      <p>
                        Hi! I&apos;m your AI gym advisor. Ask me about revenue trends,
                        member retention, class optimization, trainer performance, or any
                        other business question.
                      </p>
                    </div>
                  </div>
                )}

                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}
                  >
                    {msg.role === "assistant" && (
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Bot className="w-4 h-4 text-primary" />
                      </div>
                    )}
                    <div
                      className={`max-w-[70%] rounded-xl px-4 py-3 text-sm ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-foreground"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                    {msg.role === "user" && (
                      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                ))}

                {chatMutation.isPending && (
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Bot className="w-4 h-4 text-primary" />
                    </div>
                    <div className="bg-muted rounded-xl px-4 py-3">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
                        <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:0.1s]" />
                        <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:0.2s]" />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  placeholder="Ask about revenue, retention, classes, trainers..."
                  className="flex-1 bg-background border border-border rounded-lg px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary outline-none"
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || chatMutation.isPending}
                  className="bg-primary text-primary-foreground px-4 py-3 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
