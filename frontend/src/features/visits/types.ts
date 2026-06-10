export interface VisitStats {
  total_visits: number;
  visits_last_30_days: number;
  visits_last_90_days: number;
  avg_visits_per_week: number;
  last_visit: { checked_in_at: string; branch?: { id: string; name: string } | null } | string | null;
}

export interface HeatmapCell {
  day: number;   // 0 = Sunday, 6 = Saturday
  hour: number;  // 0–23
  count: number;
}

export interface PeakHourData {
  hour: string;
  count: number;
}

export interface AtRiskMember {
  id: string;
  member_code: string;
  full_name: string;
  phone: string;
  email?: string;
  branch_name?: string;
  engagement_score: number;
  churn_risk: 'low' | 'medium' | 'high';
  last_visit_at: string | null;
  status: string;
  current_plan?: string;
}

export interface VisitTrendPoint {
  date: string;
  visits: number;
}
