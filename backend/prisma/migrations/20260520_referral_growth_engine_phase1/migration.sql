-- =============================================================
-- Referral & Growth Engine — Phase 1 (Foundation)
-- =============================================================
-- Adds:
--   public.studios.subscription_expires_at (column + index)
--   public.referrals
--   public.referral_reward_rules
--   public.reward_logs
--   public.referral_lifecycle_events
--   public.referral_fraud_signals
--   public.referral_wallets
--   public.referral_wallet_entries
--   public.referral_campaigns
--   studio_template.member_referral_events
--   studio_template.member_referral_rewards
--   studio_template.member_referral_fraud_signals
--
-- Design notes:
--   * reward_logs and referral_wallet_entries are append-only (no UPDATE/DELETE policy here —
--     enforced in service code; revoke could be added via row security or triggers in a later phase).
--   * Lifecycle audit lives in referral_lifecycle_events / member_referral_events.
--   * Fraud signals never auto-ban; reviewed via admin queue.
--   * Wallet balance column is cached; authoritative source is sum of entries.
-- =============================================================

-- ── studios: add hard subscription expiry column ───────────────────
ALTER TABLE "public"."studios"
  ADD COLUMN IF NOT EXISTS "subscription_expires_at" TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS "studios_subscription_expires_at_idx"
  ON "public"."studios" ("subscription_expires_at");

-- ── referrals ──────────────────────────────────────────────────────
CREATE TABLE "public"."referrals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "referrer_studio_id" UUID NOT NULL,
    "referred_studio_id" UUID NOT NULL,
    "referral_code" TEXT NOT NULL,
    "referred_email" TEXT,
    "campaign_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "risk_score" INTEGER NOT NULL DEFAULT 0,
    "rewarded_at" TIMESTAMPTZ,
    "reversed_at" TIMESTAMPTZ,
    "reversed_reason" TEXT,
    "idempotency_key" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "referrals_referred_studio_id_key" ON "public"."referrals"("referred_studio_id");
CREATE UNIQUE INDEX "referrals_idempotency_key_key" ON "public"."referrals"("idempotency_key");
CREATE INDEX "referrals_referrer_studio_id_idx" ON "public"."referrals"("referrer_studio_id");
CREATE INDEX "referrals_status_idx" ON "public"."referrals"("status");
CREATE INDEX "referrals_referral_code_idx" ON "public"."referrals"("referral_code");
CREATE INDEX "referrals_campaign_id_idx" ON "public"."referrals"("campaign_id");

-- ── referral_reward_rules ──────────────────────────────────────────
CREATE TABLE "public"."referral_reward_rules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "description" TEXT,
    "trigger_event" TEXT NOT NULL DEFAULT 'b2b_subscription_activated',
    "campaign_id" UUID,
    "conditions" JSONB NOT NULL DEFAULT '{}',
    "rewards" JSONB NOT NULL DEFAULT '[]',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
    "max_uses" INTEGER,
    "uses_count" INTEGER NOT NULL DEFAULT 0,
    "valid_from" TIMESTAMPTZ,
    "valid_until" TIMESTAMPTZ,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "referral_reward_rules_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "referral_reward_rules_is_active_trigger_event_idx"
  ON "public"."referral_reward_rules"("is_active", "trigger_event");
CREATE INDEX "referral_reward_rules_priority_idx"
  ON "public"."referral_reward_rules"("priority");
CREATE INDEX "referral_reward_rules_campaign_id_idx"
  ON "public"."referral_reward_rules"("campaign_id");

-- ── reward_logs (append-only) ──────────────────────────────────────
CREATE TABLE "public"."reward_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "referral_id" UUID NOT NULL,
    "rule_id" UUID NOT NULL,
    "beneficiary_studio_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "event_payload" JSONB NOT NULL,
    "reward_type" TEXT NOT NULL,
    "reward_value" JSONB NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'applied',
    "failure_reason" TEXT,
    "subscription_extended_from" TIMESTAMPTZ,
    "subscription_extended_to" TIMESTAMPTZ,
    "applied_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "reversed_at" TIMESTAMPTZ,
    "reversed_reason" TEXT,

    CONSTRAINT "reward_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "reward_logs_idempotency_key_key" ON "public"."reward_logs"("idempotency_key");
CREATE INDEX "reward_logs_beneficiary_studio_id_status_idx"
  ON "public"."reward_logs"("beneficiary_studio_id", "status");
CREATE INDEX "reward_logs_referral_id_idx" ON "public"."reward_logs"("referral_id");
CREATE INDEX "reward_logs_applied_at_idx" ON "public"."reward_logs"("applied_at");

-- ── referral_lifecycle_events (append-only) ────────────────────────
CREATE TABLE "public"."referral_lifecycle_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "referral_id" UUID NOT NULL,
    "from_status" TEXT,
    "to_status" TEXT NOT NULL,
    "actor_type" TEXT NOT NULL DEFAULT 'system',
    "actor_id" UUID,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "occurred_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "referral_lifecycle_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "referral_lifecycle_events_referral_id_occurred_at_idx"
  ON "public"."referral_lifecycle_events"("referral_id", "occurred_at");

-- ── referral_fraud_signals ─────────────────────────────────────────
CREATE TABLE "public"."referral_fraud_signals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "referral_id" UUID,
    "subject_studio_id" UUID,
    "signal_type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'low',
    "evidence" JSONB NOT NULL DEFAULT '{}',
    "review_status" TEXT NOT NULL DEFAULT 'pending',
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMPTZ,
    "reviewer_notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "referral_fraud_signals_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "referral_fraud_signals_review_status_severity_idx"
  ON "public"."referral_fraud_signals"("review_status", "severity");
CREATE INDEX "referral_fraud_signals_subject_studio_id_idx"
  ON "public"."referral_fraud_signals"("subject_studio_id");

-- ── referral_wallets ───────────────────────────────────────────────
CREATE TABLE "public"."referral_wallets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "studio_id" UUID NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "balance" DECIMAL(14, 2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "referral_wallets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "referral_wallets_studio_id_key" ON "public"."referral_wallets"("studio_id");

-- ── referral_wallet_entries (append-only) ──────────────────────────
CREATE TABLE "public"."referral_wallet_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "wallet_id" UUID NOT NULL,
    "entry_type" TEXT NOT NULL,
    "amount" DECIMAL(14, 2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "source_type" TEXT NOT NULL,
    "source_id" UUID,
    "reward_log_id" UUID,
    "reverses_entry_id" UUID,
    "idempotency_key" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ,
    "description" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "referral_wallet_entries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "referral_wallet_entries_idempotency_key_key"
  ON "public"."referral_wallet_entries"("idempotency_key");
CREATE INDEX "referral_wallet_entries_wallet_id_created_at_idx"
  ON "public"."referral_wallet_entries"("wallet_id", "created_at");
CREATE INDEX "referral_wallet_entries_source_type_source_id_idx"
  ON "public"."referral_wallet_entries"("source_type", "source_id");

-- ── referral_campaigns ─────────────────────────────────────────────
CREATE TABLE "public"."referral_campaigns" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "description" TEXT,
    "scope" TEXT NOT NULL DEFAULT 'global',
    "scope_filters" JSONB NOT NULL DEFAULT '{}',
    "rule_overrides" JSONB NOT NULL DEFAULT '[]',
    "valid_from" TIMESTAMPTZ,
    "valid_until" TIMESTAMPTZ,
    "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
    "max_total_uses" INTEGER,
    "uses_count" INTEGER NOT NULL DEFAULT 0,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "referral_campaigns_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "referral_campaigns_is_active_valid_from_valid_until_idx"
  ON "public"."referral_campaigns"("is_active", "valid_from", "valid_until");

-- ── Foreign keys (public schema) ───────────────────────────────────
ALTER TABLE "public"."referrals"
  ADD CONSTRAINT "referrals_referrer_studio_id_fkey"
  FOREIGN KEY ("referrer_studio_id") REFERENCES "public"."studios"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public"."referrals"
  ADD CONSTRAINT "referrals_referred_studio_id_fkey"
  FOREIGN KEY ("referred_studio_id") REFERENCES "public"."studios"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public"."referrals"
  ADD CONSTRAINT "referrals_campaign_id_fkey"
  FOREIGN KEY ("campaign_id") REFERENCES "public"."referral_campaigns"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."referral_reward_rules"
  ADD CONSTRAINT "referral_reward_rules_campaign_id_fkey"
  FOREIGN KEY ("campaign_id") REFERENCES "public"."referral_campaigns"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."reward_logs"
  ADD CONSTRAINT "reward_logs_referral_id_fkey"
  FOREIGN KEY ("referral_id") REFERENCES "public"."referrals"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public"."reward_logs"
  ADD CONSTRAINT "reward_logs_rule_id_fkey"
  FOREIGN KEY ("rule_id") REFERENCES "public"."referral_reward_rules"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public"."reward_logs"
  ADD CONSTRAINT "reward_logs_beneficiary_studio_id_fkey"
  FOREIGN KEY ("beneficiary_studio_id") REFERENCES "public"."studios"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public"."referral_lifecycle_events"
  ADD CONSTRAINT "referral_lifecycle_events_referral_id_fkey"
  FOREIGN KEY ("referral_id") REFERENCES "public"."referrals"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."referral_fraud_signals"
  ADD CONSTRAINT "referral_fraud_signals_referral_id_fkey"
  FOREIGN KEY ("referral_id") REFERENCES "public"."referrals"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."referral_fraud_signals"
  ADD CONSTRAINT "referral_fraud_signals_subject_studio_id_fkey"
  FOREIGN KEY ("subject_studio_id") REFERENCES "public"."studios"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."referral_wallets"
  ADD CONSTRAINT "referral_wallets_studio_id_fkey"
  FOREIGN KEY ("studio_id") REFERENCES "public"."studios"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."referral_wallet_entries"
  ADD CONSTRAINT "referral_wallet_entries_wallet_id_fkey"
  FOREIGN KEY ("wallet_id") REFERENCES "public"."referral_wallets"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── studio_template: per-gym B2C referral tables ───────────────────
CREATE TABLE "studio_template"."member_referral_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "gym_id" UUID NOT NULL,
    "member_referral_id" UUID NOT NULL,
    "from_status" TEXT,
    "to_status" TEXT NOT NULL,
    "actor_type" TEXT NOT NULL DEFAULT 'system',
    "actor_id" UUID,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "occurred_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "member_referral_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "member_referral_events_member_referral_id_occurred_at_idx"
  ON "studio_template"."member_referral_events"("member_referral_id", "occurred_at");
CREATE INDEX "member_referral_events_gym_id_idx"
  ON "studio_template"."member_referral_events"("gym_id");

CREATE TABLE "studio_template"."member_referral_rewards" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "gym_id" UUID NOT NULL,
    "member_referral_id" UUID NOT NULL,
    "program_id" UUID,
    "beneficiary_member_id" UUID NOT NULL,
    "reward_type" TEXT NOT NULL,
    "reward_value" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'applied',
    "idempotency_key" TEXT NOT NULL,
    "applied_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "claimed_at" TIMESTAMPTZ,
    "expires_at" TIMESTAMPTZ,
    "reversed_at" TIMESTAMPTZ,
    "reversed_reason" TEXT,
    "notes" TEXT,

    CONSTRAINT "member_referral_rewards_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "member_referral_rewards_idempotency_key_key"
  ON "studio_template"."member_referral_rewards"("idempotency_key");
CREATE INDEX "member_referral_rewards_gym_id_status_idx"
  ON "studio_template"."member_referral_rewards"("gym_id", "status");
CREATE INDEX "member_referral_rewards_beneficiary_member_id_idx"
  ON "studio_template"."member_referral_rewards"("beneficiary_member_id");
CREATE INDEX "member_referral_rewards_member_referral_id_idx"
  ON "studio_template"."member_referral_rewards"("member_referral_id");

CREATE TABLE "studio_template"."member_referral_fraud_signals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "gym_id" UUID NOT NULL,
    "member_referral_id" UUID,
    "subject_member_id" UUID,
    "signal_type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'low',
    "evidence" JSONB NOT NULL DEFAULT '{}',
    "review_status" TEXT NOT NULL DEFAULT 'pending',
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMPTZ,
    "reviewer_notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "member_referral_fraud_signals_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "member_referral_fraud_signals_gym_id_review_status_idx"
  ON "studio_template"."member_referral_fraud_signals"("gym_id", "review_status");
