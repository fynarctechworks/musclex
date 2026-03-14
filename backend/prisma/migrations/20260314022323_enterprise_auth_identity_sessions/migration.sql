-- Enterprise Auth: Identity, Device Tracking, Login History, Sessions, SSO, API Keys
-- This migration adds enterprise authentication tables without modifying existing tables.

-- =============================================
-- PUBLIC SCHEMA — Identity & Session Management
-- =============================================

-- User identity (synced from Supabase Auth on login)
CREATE TABLE IF NOT EXISTS "public"."user_identities" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "phone" TEXT,
    "avatar_url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "phone_verified" BOOLEAN NOT NULL DEFAULT false,
    "last_login_at" TIMESTAMPTZ,
    "login_count" INTEGER NOT NULL DEFAULT 0,
    "failed_login_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ,
    "password_changed_at" TIMESTAMPTZ,
    "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false,
    "two_factor_method" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "user_identities_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_identities_email_key" ON "public"."user_identities"("email");
CREATE INDEX IF NOT EXISTS "user_identities_email_idx" ON "public"."user_identities"("email");
CREATE INDEX IF NOT EXISTS "user_identities_status_idx" ON "public"."user_identities"("status");

-- Device tracking
CREATE TABLE IF NOT EXISTS "public"."user_devices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "device_fingerprint" TEXT NOT NULL,
    "device_name" TEXT,
    "device_type" TEXT NOT NULL DEFAULT 'desktop',
    "browser" TEXT,
    "os" TEXT,
    "ip_address" TEXT,
    "location_city" TEXT,
    "location_country" TEXT,
    "is_trusted" BOOLEAN NOT NULL DEFAULT false,
    "last_active_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "user_devices_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "user_devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_identities"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_devices_user_id_device_fingerprint_key" ON "public"."user_devices"("user_id", "device_fingerprint");
CREATE INDEX IF NOT EXISTS "user_devices_user_id_idx" ON "public"."user_devices"("user_id");

-- Login history (persistent audit trail)
CREATE TABLE IF NOT EXISTS "public"."login_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "email" TEXT NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "device_id" UUID,
    "login_method" TEXT NOT NULL DEFAULT 'password',
    "status" TEXT NOT NULL,
    "failure_reason" TEXT,
    "studio_id" UUID,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "login_history_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "login_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_identities"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "login_history_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "public"."user_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "login_history_user_id_created_at_idx" ON "public"."login_history"("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "login_history_email_created_at_idx" ON "public"."login_history"("email", "created_at");
CREATE INDEX IF NOT EXISTS "login_history_ip_address_idx" ON "public"."login_history"("ip_address");
CREATE INDEX IF NOT EXISTS "login_history_status_created_at_idx" ON "public"."login_history"("status", "created_at");

-- Active sessions
CREATE TABLE IF NOT EXISTS "public"."user_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "device_id" UUID,
    "token_hash" TEXT NOT NULL,
    "ip_address" TEXT,
    "studio_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "last_activity_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "revoked_at" TIMESTAMPTZ,
    "revoked_reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_identities"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "user_sessions_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "public"."user_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_sessions_token_hash_key" ON "public"."user_sessions"("token_hash");
CREATE INDEX IF NOT EXISTS "user_sessions_user_id_is_active_idx" ON "public"."user_sessions"("user_id", "is_active");
CREATE INDEX IF NOT EXISTS "user_sessions_token_hash_idx" ON "public"."user_sessions"("token_hash");
CREATE INDEX IF NOT EXISTS "user_sessions_expires_at_idx" ON "public"."user_sessions"("expires_at");

-- =============================================
-- STUDIO TEMPLATE SCHEMA — SSO & API Keys
-- =============================================

-- SSO Provider configuration
CREATE TABLE IF NOT EXISTS "studio_template"."sso_providers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "provider_type" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "client_id" TEXT,
    "encrypted_client_secret" TEXT,
    "issuer_url" TEXT,
    "authorization_url" TEXT,
    "token_url" TEXT,
    "userinfo_url" TEXT,
    "scopes" TEXT[] NOT NULL DEFAULT '{}',
    "attribute_mapping" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "auto_provision_users" BOOLEAN NOT NULL DEFAULT false,
    "allowed_domains" TEXT[] NOT NULL DEFAULT '{}',
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "sso_providers_pkey" PRIMARY KEY ("id")
);

-- API Key management
CREATE TABLE IF NOT EXISTS "studio_template"."api_keys" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "key_prefix" TEXT NOT NULL,
    "scopes" JSONB NOT NULL DEFAULT '{}',
    "rate_limit_per_minute" INTEGER NOT NULL DEFAULT 60,
    "expires_at" TIMESTAMPTZ,
    "last_used_at" TIMESTAMPTZ,
    "last_used_ip" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "api_keys_key_hash_key" ON "studio_template"."api_keys"("key_hash");
CREATE INDEX IF NOT EXISTS "api_keys_key_hash_idx" ON "studio_template"."api_keys"("key_hash");
CREATE INDEX IF NOT EXISTS "api_keys_key_prefix_idx" ON "studio_template"."api_keys"("key_prefix");
