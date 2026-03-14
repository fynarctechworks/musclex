-- Migration: Marketing & Automation Engine
-- Module 10: Leads, campaigns audience, templates, workflows, referral programs, push notifications

-- ══════════════════════════════════════════════════════════════════
-- Leads
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS studio_template.leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES studio_template.organizations(id),
    branch_id UUID REFERENCES studio_template.branches(id),
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(20),
    lead_source VARCHAR(50) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'new',
    assigned_staff_id UUID REFERENCES studio_template.staff(id),
    notes TEXT,
    converted_member_id UUID REFERENCES studio_template.members(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_leads_org ON studio_template.leads(organization_id);
CREATE INDEX idx_leads_branch ON studio_template.leads(branch_id);
CREATE INDEX idx_leads_status ON studio_template.leads(status);
CREATE INDEX idx_leads_source ON studio_template.leads(lead_source);
CREATE INDEX idx_leads_assigned ON studio_template.leads(assigned_staff_id);
CREATE INDEX idx_leads_created ON studio_template.leads(created_at);

-- ══════════════════════════════════════════════════════════════════
-- Lead Activities
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS studio_template.lead_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES studio_template.leads(id) ON DELETE CASCADE,
    staff_id UUID REFERENCES studio_template.staff(id),
    activity_type VARCHAR(30) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lead_activities_lead ON studio_template.lead_activities(lead_id);
CREATE INDEX idx_lead_activities_staff ON studio_template.lead_activities(staff_id);
CREATE INDEX idx_lead_activities_created ON studio_template.lead_activities(created_at);

-- ══════════════════════════════════════════════════════════════════
-- Campaign Audience (recipients tracking)
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS studio_template.campaign_audience (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES studio_template.campaigns(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES studio_template.members(id),
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    sent_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,
    UNIQUE(campaign_id, member_id)
);

CREATE INDEX idx_campaign_audience_campaign ON studio_template.campaign_audience(campaign_id);
CREATE INDEX idx_campaign_audience_member ON studio_template.campaign_audience(member_id);
CREATE INDEX idx_campaign_audience_status ON studio_template.campaign_audience(status);

-- ══════════════════════════════════════════════════════════════════
-- Message Templates
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS studio_template.message_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES studio_template.organizations(id),
    template_name VARCHAR(255) NOT NULL,
    channel VARCHAR(30) NOT NULL,
    subject VARCHAR(500),
    content TEXT NOT NULL,
    variables TEXT[] DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_msg_templates_org ON studio_template.message_templates(organization_id);
CREATE INDEX idx_msg_templates_channel ON studio_template.message_templates(channel);

-- ══════════════════════════════════════════════════════════════════
-- Automation Workflows
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS studio_template.automation_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES studio_template.organizations(id),
    workflow_name VARCHAR(255) NOT NULL,
    trigger_event VARCHAR(50) NOT NULL,
    trigger_config JSONB,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_workflows_org ON studio_template.automation_workflows(organization_id);
CREATE INDEX idx_workflows_trigger ON studio_template.automation_workflows(trigger_event);
CREATE INDEX idx_workflows_status ON studio_template.automation_workflows(status);

-- ══════════════════════════════════════════════════════════════════
-- Workflow Actions
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS studio_template.workflow_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES studio_template.automation_workflows(id) ON DELETE CASCADE,
    action_order INTEGER NOT NULL DEFAULT 1,
    action_type VARCHAR(30) NOT NULL,
    delay_minutes INTEGER NOT NULL DEFAULT 0,
    template_id UUID REFERENCES studio_template.message_templates(id),
    action_config JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_wf_actions_workflow ON studio_template.workflow_actions(workflow_id);
CREATE INDEX idx_wf_actions_template ON studio_template.workflow_actions(template_id);

-- ══════════════════════════════════════════════════════════════════
-- Referral Programs
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS studio_template.referral_programs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES studio_template.organizations(id),
    program_name VARCHAR(255) NOT NULL,
    reward_type VARCHAR(30) NOT NULL,
    reward_value DECIMAL(10,2) NOT NULL,
    min_referrals INTEGER NOT NULL DEFAULT 1,
    max_rewards INTEGER,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_referral_programs_org ON studio_template.referral_programs(organization_id);
CREATE INDEX idx_referral_programs_status ON studio_template.referral_programs(status);

-- ══════════════════════════════════════════════════════════════════
-- Push Notifications
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS studio_template.push_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES studio_template.members(id),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSONB,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    sent_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_push_notif_member ON studio_template.push_notifications(member_id);
CREATE INDEX idx_push_notif_status ON studio_template.push_notifications(status);
CREATE INDEX idx_push_notif_created ON studio_template.push_notifications(created_at);

-- ══════════════════════════════════════════════════════════════════
-- Triggers for updated_at
-- ══════════════════════════════════════════════════════════════════

CREATE TRIGGER set_updated_at_leads
    BEFORE UPDATE ON studio_template.leads
    FOR EACH ROW EXECUTE FUNCTION studio_template.set_updated_at();

CREATE TRIGGER set_updated_at_message_templates
    BEFORE UPDATE ON studio_template.message_templates
    FOR EACH ROW EXECUTE FUNCTION studio_template.set_updated_at();

CREATE TRIGGER set_updated_at_automation_workflows
    BEFORE UPDATE ON studio_template.automation_workflows
    FOR EACH ROW EXECUTE FUNCTION studio_template.set_updated_at();

CREATE TRIGGER set_updated_at_referral_programs
    BEFORE UPDATE ON studio_template.referral_programs
    FOR EACH ROW EXECUTE FUNCTION studio_template.set_updated_at();
