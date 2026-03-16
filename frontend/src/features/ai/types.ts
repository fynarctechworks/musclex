// ── Chat Types ────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface ChatResponse {
  conversation_id: string;
  response: string;
  messages: ChatMessage[];
}

export interface Conversation {
  id: string;
  created_at: string;
  updated_at: string;
}

// ── Daily Briefing ────────────────────────────────────────

export interface BriefingAlert {
  type: 'warning' | 'info' | 'danger';
  title: string;
  message: string;
}

export interface DailyBriefing {
  date: string;
  summary: string;
  metrics: {
    total_members: number;
    active_members: number;
    today_check_ins: number;
    expiring_this_week: number;
    revenue_today: number;
    pending_payments: number;
  };
  alerts: BriefingAlert[];
  recommendations: string[];
}

// ── AI Insights ───────────────────────────────────────────

export type InsightType = 'churn_risk' | 'revenue' | 'attendance' | 'marketing' | 'trainer' | 'operational';
export type InsightSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface AIInsight {
  id: string;
  type: InsightType;
  title: string;
  description: string;
  severity: InsightSeverity;
  suggested_action: string;
  metric_value?: string;
  metric_label?: string;
  created_at: string;
}
