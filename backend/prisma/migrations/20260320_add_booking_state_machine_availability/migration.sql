SET search_path TO studio_template, public;

-- CreateTable BookingTransition
CREATE TABLE IF NOT EXISTS "studio_template"."booking_transitions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "booking_id" UUID NOT NULL,
  "from_status" TEXT NOT NULL,
  "to_status" TEXT NOT NULL,
  "triggered_by" TEXT NOT NULL,
  "reason" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "booking_transitions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "booking_transitions_booking_id_fkey"
    FOREIGN KEY ("booking_id") REFERENCES "studio_template"."service_bookings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "booking_transitions_booking_id_idx" ON "studio_template"."booking_transitions"("booking_id");
CREATE INDEX IF NOT EXISTS "booking_transitions_created_at_idx" ON "studio_template"."booking_transitions"("created_at");
CREATE INDEX IF NOT EXISTS "booking_transitions_triggered_by_idx" ON "studio_template"."booking_transitions"("triggered_by");

-- CreateTable ProviderAvailabilitySlot
CREATE TABLE IF NOT EXISTS "studio_template"."provider_availability_slots" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "provider_id" UUID NOT NULL,
  "branch_id" UUID,
  "date_start" TIMESTAMPTZ NOT NULL,
  "date_end" TIMESTAMPTZ NOT NULL,
  "slot_status" TEXT NOT NULL DEFAULT 'available',
  "locked_by_booking_id" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "provider_availability_slots_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "provider_availability_slots_provider_id_fkey"
    FOREIGN KEY ("provider_id") REFERENCES "studio_template"."service_providers" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "provider_availability_slots_locked_booking_fkey"
    FOREIGN KEY ("locked_by_booking_id") REFERENCES "studio_template"."service_bookings" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "provider_availability_slots_provider_id_idx" ON "studio_template"."provider_availability_slots"("provider_id");
CREATE INDEX IF NOT EXISTS "provider_availability_slots_date_start_date_end_idx" ON "studio_template"."provider_availability_slots"("date_start", "date_end");
CREATE INDEX IF NOT EXISTS "provider_availability_slots_status_idx" ON "studio_template"."provider_availability_slots"("slot_status");

-- CreateTable BookingDispute
CREATE TABLE IF NOT EXISTS "studio_template"."booking_disputes" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "booking_id" UUID NOT NULL UNIQUE,
  "initiated_by" UUID NOT NULL,
  "reason" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'open',
  "admin_notes" TEXT,
  "resolved_at" TIMESTAMPTZ,
  "resolution" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "booking_disputes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "booking_disputes_booking_id_fkey"
    FOREIGN KEY ("booking_id") REFERENCES "studio_template"."service_bookings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "booking_disputes_status_idx" ON "studio_template"."booking_disputes"("status");
CREATE INDEX IF NOT EXISTS "booking_disputes_created_at_idx" ON "studio_template"."booking_disputes"("created_at");
CREATE INDEX IF NOT EXISTS "booking_disputes_initiated_by_idx" ON "studio_template"."booking_disputes"("initiated_by");

-- Add missing indexes to service_bookings for tenant isolation
CREATE INDEX IF NOT EXISTS "service_bookings_gym_id_status_idx" ON "studio_template"."service_bookings"("gym_id", "status");
CREATE INDEX IF NOT EXISTS "service_bookings_gym_id_provider_id_idx" ON "studio_template"."service_bookings"("gym_id", "provider_id");
CREATE INDEX IF NOT EXISTS "service_bookings_gym_id_requester_id_idx" ON "studio_template"."service_bookings"("gym_id", "requester_id");
CREATE INDEX IF NOT EXISTS "service_bookings_gym_id_created_at_idx" ON "studio_template"."service_bookings"("gym_id", "created_at");
