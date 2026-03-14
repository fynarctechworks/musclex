-- =============================================
-- Migration: Analytics & Business Intelligence Engine
-- Tables: daily_gym_metrics, membership_analytics, revenue_analytics,
--          class_analytics, member_behavior_analytics, trainer_analytics,
--          campaign_analytics
-- =============================================

-- Daily Gym Metrics (hourly aggregation)
CREATE TABLE IF NOT EXISTS daily_gym_metrics (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id),
    branch_id       UUID REFERENCES branches(id),
    date            DATE NOT NULL,
    total_revenue   DECIMAL(12,2) NOT NULL DEFAULT 0,
    new_members     INT NOT NULL DEFAULT 0,
    active_members  INT NOT NULL DEFAULT 0,
    total_visits    INT NOT NULL DEFAULT 0,
    classes_held    INT NOT NULL DEFAULT 0,
    products_sold   INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(organization_id, branch_id, date)
);
CREATE INDEX IF NOT EXISTS idx_daily_gym_metrics_org ON daily_gym_metrics(organization_id);
CREATE INDEX IF NOT EXISTS idx_daily_gym_metrics_branch ON daily_gym_metrics(branch_id);
CREATE INDEX IF NOT EXISTS idx_daily_gym_metrics_date ON daily_gym_metrics(date);

-- Membership Analytics (nightly aggregation)
CREATE TABLE IF NOT EXISTS membership_analytics (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id),
    branch_id       UUID REFERENCES branches(id),
    plan_id         UUID REFERENCES membership_plans(id),
    total_active    INT NOT NULL DEFAULT 0,
    renewals        INT NOT NULL DEFAULT 0,
    cancellations   INT NOT NULL DEFAULT 0,
    new_signups     INT NOT NULL DEFAULT 0,
    churn_rate      DECIMAL(5,2) NOT NULL DEFAULT 0,
    period_start    DATE NOT NULL,
    period_end      DATE NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(organization_id, branch_id, plan_id, period_start, period_end)
);
CREATE INDEX IF NOT EXISTS idx_membership_analytics_org ON membership_analytics(organization_id);
CREATE INDEX IF NOT EXISTS idx_membership_analytics_branch ON membership_analytics(branch_id);
CREATE INDEX IF NOT EXISTS idx_membership_analytics_period ON membership_analytics(period_start, period_end);

-- Revenue Analytics (nightly aggregation)
CREATE TABLE IF NOT EXISTS revenue_analytics (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id),
    branch_id       UUID REFERENCES branches(id),
    revenue_type    VARCHAR NOT NULL,
    amount          DECIMAL(12,2) NOT NULL DEFAULT 0,
    transaction_count INT NOT NULL DEFAULT 0,
    period_start    DATE NOT NULL,
    period_end      DATE NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(organization_id, branch_id, revenue_type, period_start, period_end)
);
CREATE INDEX IF NOT EXISTS idx_revenue_analytics_org ON revenue_analytics(organization_id);
CREATE INDEX IF NOT EXISTS idx_revenue_analytics_branch ON revenue_analytics(branch_id);
CREATE INDEX IF NOT EXISTS idx_revenue_analytics_type ON revenue_analytics(revenue_type);
CREATE INDEX IF NOT EXISTS idx_revenue_analytics_period ON revenue_analytics(period_start, period_end);

-- Class Analytics (nightly aggregation)
CREATE TABLE IF NOT EXISTS class_analytics (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_template_id    UUID REFERENCES class_templates(id),
    branch_id            UUID REFERENCES branches(id),
    total_sessions       INT NOT NULL DEFAULT 0,
    total_bookings       INT NOT NULL DEFAULT 0,
    average_attendance   DECIMAL(5,2) NOT NULL DEFAULT 0,
    no_show_rate         DECIMAL(5,2) NOT NULL DEFAULT 0,
    occupancy_rate       DECIMAL(5,2) NOT NULL DEFAULT 0,
    period_start         DATE NOT NULL,
    period_end           DATE NOT NULL,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(class_template_id, branch_id, period_start, period_end)
);
CREATE INDEX IF NOT EXISTS idx_class_analytics_template ON class_analytics(class_template_id);
CREATE INDEX IF NOT EXISTS idx_class_analytics_branch ON class_analytics(branch_id);
CREATE INDEX IF NOT EXISTS idx_class_analytics_period ON class_analytics(period_start, period_end);

-- Member Behavior Analytics (nightly aggregation)
CREATE TABLE IF NOT EXISTS member_behavior_analytics (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id         UUID NOT NULL REFERENCES members(id),
    branch_id         UUID REFERENCES branches(id),
    visit_frequency   DECIMAL(5,2) NOT NULL DEFAULT 0,
    classes_attended  INT NOT NULL DEFAULT 0,
    pt_sessions       INT NOT NULL DEFAULT 0,
    last_visit_date   DATE,
    days_since_visit  INT NOT NULL DEFAULT 0,
    engagement_score  INT NOT NULL DEFAULT 0,
    churn_risk        VARCHAR NOT NULL DEFAULT 'low',
    computed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(member_id, computed_at)
);
CREATE INDEX IF NOT EXISTS idx_member_behavior_member ON member_behavior_analytics(member_id);
CREATE INDEX IF NOT EXISTS idx_member_behavior_engagement ON member_behavior_analytics(engagement_score);
CREATE INDEX IF NOT EXISTS idx_member_behavior_churn ON member_behavior_analytics(churn_risk);

-- Trainer Analytics (nightly aggregation)
CREATE TABLE IF NOT EXISTS trainer_analytics (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trainer_id         UUID NOT NULL REFERENCES staff(id),
    branch_id          UUID REFERENCES branches(id),
    sessions_conducted INT NOT NULL DEFAULT 0,
    members_trained    INT NOT NULL DEFAULT 0,
    average_rating     DECIMAL(3,2) NOT NULL DEFAULT 0,
    revenue_generated  DECIMAL(12,2) NOT NULL DEFAULT 0,
    no_show_rate       DECIMAL(5,2) NOT NULL DEFAULT 0,
    period_start       DATE NOT NULL,
    period_end         DATE NOT NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(trainer_id, branch_id, period_start, period_end)
);
CREATE INDEX IF NOT EXISTS idx_trainer_analytics_trainer ON trainer_analytics(trainer_id);
CREATE INDEX IF NOT EXISTS idx_trainer_analytics_branch ON trainer_analytics(branch_id);
CREATE INDEX IF NOT EXISTS idx_trainer_analytics_period ON trainer_analytics(period_start, period_end);

-- Campaign Analytics (weekly aggregation)
CREATE TABLE IF NOT EXISTS campaign_analytics (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id        UUID NOT NULL REFERENCES campaigns(id),
    sent               INT NOT NULL DEFAULT 0,
    opened             INT NOT NULL DEFAULT 0,
    clicked            INT NOT NULL DEFAULT 0,
    converted          INT NOT NULL DEFAULT 0,
    bounced            INT NOT NULL DEFAULT 0,
    revenue_generated  DECIMAL(12,2) NOT NULL DEFAULT 0,
    computed_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_campaign_analytics_campaign ON campaign_analytics(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_analytics_computed ON campaign_analytics(computed_at);
