-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "studio_template";

-- CreateTable marketplace.service_providers
CREATE TABLE "studio_template"."service_providers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "first_name" VARCHAR(255) NOT NULL,
    "last_name" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "city" VARCHAR(100) NOT NULL,
    "state" VARCHAR(100) NOT NULL,
    "country" VARCHAR(100) NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "service_radius_km" INTEGER NOT NULL DEFAULT 10,
    "bio" TEXT,
    "experience_years" INTEGER NOT NULL DEFAULT 0,
    "specializations" TEXT[] NOT NULL DEFAULT '{}',
    "certifications" TEXT[] DEFAULT '{}',
    "business_type" VARCHAR(50) NOT NULL DEFAULT 'individual',
    "business_name" VARCHAR(255),
    "business_reg_no" VARCHAR(100),
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "verification_status" VARCHAR(50) NOT NULL DEFAULT 'pending',
    "verification_date" TIMESTAMPTZ,
    "avatar_url" TEXT,
    "banner_url" TEXT,
    "portfolio_images" TEXT[] DEFAULT '{}',
    "average_rating" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "total_reviews" INTEGER NOT NULL DEFAULT 0,
    "subscription_id" UUID,
    "total_bookings" INTEGER NOT NULL DEFAULT 0,
    "completed_bookings" INTEGER NOT NULL DEFAULT 0,
    "cancelled_bookings" INTEGER NOT NULL DEFAULT 0,
    "response_time_hours" DECIMAL(5,2) NOT NULL DEFAULT 24,
    "completion_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_suspended" BOOLEAN NOT NULL DEFAULT false,
    "is_banned" BOOLEAN NOT NULL DEFAULT false,
    "suspension_reason" TEXT,
    "suspension_until" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_providers_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "service_providers_user_id_key" UNIQUE("user_id")
);

-- CreateIndex
CREATE INDEX "service_providers_user_id_idx" ON "studio_template"."service_providers"("user_id");
CREATE INDEX "service_providers_city_state_idx" ON "studio_template"."service_providers"("city", "state");
CREATE INDEX "service_providers_latitude_longitude_idx" ON "studio_template"."service_providers"("latitude", "longitude");
CREATE INDEX "service_providers_is_verified_idx" ON "studio_template"."service_providers"("is_verified") WHERE "is_verified" = true;
CREATE INDEX "service_providers_is_active_idx" ON "studio_template"."service_providers"("is_active");

-- CreateTable marketplace.services
CREATE TABLE "studio_template"."services" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "service_category_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "base_price" DECIMAL(10,2),
    "is_negotiable" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "services_service_category_id_idx" ON "studio_template"."services"("service_category_id");
CREATE UNIQUE INDEX "services_service_category_id_slug_key" ON "studio_template"."services"("service_category_id", "slug");

-- CreateTable marketplace.service_categories
CREATE TABLE "studio_template"."service_categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "icon_url" TEXT,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_categories_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "service_categories_name_key" UNIQUE("name"),
    CONSTRAINT "service_categories_slug_key" UNIQUE("slug")
);

-- CreateIndex
CREATE INDEX "service_categories_slug_idx" ON "studio_template"."service_categories"("slug");

-- CreateTable marketplace.service_bookings
CREATE TABLE "studio_template"."service_bookings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "gym_id" UUID NOT NULL,
    "requester_id" UUID NOT NULL,
    "provider_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "location" VARCHAR(255),
    "location_lat" DOUBLE PRECISION,
    "location_lng" DOUBLE PRECISION,
    "requested_date" TIMESTAMPTZ NOT NULL,
    "scheduled_date" TIMESTAMPTZ,
    "estimated_duration" INTEGER,
    "status" VARCHAR(50) NOT NULL DEFAULT 'requested',
    "requested_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accepted_at" TIMESTAMPTZ,
    "started_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "provider_notes" TEXT,
    "client_notes" TEXT,
    "estimated_cost" DECIMAL(10,2),
    "final_cost" DECIMAL(10,2),
    "payment_status" VARCHAR(50) NOT NULL DEFAULT 'pending',
    "rating" DECIMAL(2,1),
    "review" TEXT,
    "reviewer_id" UUID,
    "cancelled_by" VARCHAR(50),
    "cancellation_reason" TEXT,
    "cancelled_at" TIMESTAMPTZ,
    "chat_room_id" UUID,
    "is_disputed" BOOLEAN NOT NULL DEFAULT false,
    "dispute_reason" TEXT,
    "dispute_resolved" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "service_bookings_gym_id_status_idx" ON "studio_template"."service_bookings"("gym_id", "status");
CREATE INDEX "service_bookings_provider_id_status_idx" ON "studio_template"."service_bookings"("provider_id", "status");
CREATE INDEX "service_bookings_requested_date_idx" ON "studio_template"."service_bookings"("requested_date");
CREATE INDEX "service_bookings_scheduled_date_idx" ON "studio_template"."service_bookings"("scheduled_date");

-- CreateTable marketplace.chat_rooms
CREATE TABLE "studio_template"."chat_rooms" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "gym_id" UUID NOT NULL,
    "gym_user_id" UUID NOT NULL,
    "provider_id" UUID NOT NULL,
    "booking_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_message_at" TIMESTAMPTZ,
    "closed_at" TIMESTAMPTZ,
    "closed_by" VARCHAR(50),
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chat_rooms_gym_id_idx" ON "studio_template"."chat_rooms"("gym_id");
CREATE INDEX "chat_rooms_provider_id_idx" ON "studio_template"."chat_rooms"("provider_id");
CREATE INDEX "chat_rooms_is_active_idx" ON "studio_template"."chat_rooms"("is_active");
CREATE UNIQUE INDEX "chat_rooms_gym_id_provider_id_key" ON "studio_template"."chat_rooms"("gym_id", "provider_id");

-- CreateTable marketplace.messages
CREATE TABLE "studio_template"."messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "chat_room_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "attachments" TEXT[] DEFAULT '{}',
    "is_edited" BOOLEAN NOT NULL DEFAULT false,
    "edited_at" TIMESTAMPTZ,
    "seen_by" TEXT[] DEFAULT '{}',
    "seen_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "messages_chat_room_id_fkey" FOREIGN KEY ("chat_room_id") REFERENCES "studio_template"."chat_rooms"("id") ON DELETE CASCADE
);

-- CreateIndex
CREATE INDEX "messages_chat_room_id_idx" ON "studio_template"."messages"("chat_room_id");
CREATE INDEX "messages_sender_id_idx" ON "studio_template"."messages"("sender_id");
CREATE INDEX "messages_chat_room_id_created_at_idx" ON "studio_template"."messages"("chat_room_id", "created_at" DESC);

-- CreateTable marketplace.provider_subscriptions
CREATE TABLE "studio_template"."provider_subscriptions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "provider_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'active',
    "current_period_start" TIMESTAMPTZ NOT NULL,
    "current_period_end" TIMESTAMPTZ NOT NULL,
    "next_billing_date" TIMESTAMPTZ,
    "payment_method_id" VARCHAR(255),
    "auto_renew" BOOLEAN NOT NULL DEFAULT true,
    "monthly_price" DECIMAL(10,2) NOT NULL,
    "billing_cycle" INTEGER NOT NULL DEFAULT 30,
    "enabled_features" TEXT[] DEFAULT '{}',
    "lead_limit" INTEGER NOT NULL DEFAULT 0,
    "cancelled_at" TIMESTAMPTZ,
    "cancellation_reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_subscriptions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "provider_subscriptions_provider_id_key" UNIQUE("provider_id")
);

-- CreateIndex
CREATE INDEX "provider_subscriptions_provider_id_idx" ON "studio_template"."provider_subscriptions"("provider_id");
CREATE INDEX "provider_subscriptions_status_idx" ON "studio_template"."provider_subscriptions"("status") WHERE "status" = 'active';
CREATE INDEX "provider_subscriptions_current_period_end_idx" ON "studio_template"."provider_subscriptions"("current_period_end");

-- CreateTable marketplace.subscription_plans
CREATE TABLE "studio_template"."subscription_plans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "price_monthly" DECIMAL(10,2) NOT NULL,
    "price_annual" DECIMAL(10,2),
    "currency" VARCHAR(3) NOT NULL DEFAULT 'INR',
    "features" TEXT[] DEFAULT '{}',
    "lead_limit" INTEGER NOT NULL DEFAULT 0,
    "max_active_jobs" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "subscription_plans_name_key" UNIQUE("name")
);

-- CreateTable marketplace.availability_slots
CREATE TABLE "studio_template"."availability_slots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "provider_id" UUID NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "start_time" VARCHAR(5) NOT NULL,
    "end_time" VARCHAR(5) NOT NULL,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "availability_slots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "availability_slots_provider_id_idx" ON "studio_template"."availability_slots"("provider_id");
CREATE UNIQUE INDEX "availability_slots_provider_id_day_of_week_key" ON "studio_template"."availability_slots"("provider_id", "day_of_week");

-- CreateTable marketplace.blocked_dates
CREATE TABLE "studio_template"."blocked_dates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "provider_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blocked_dates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "blocked_dates_provider_id_idx" ON "studio_template"."blocked_dates"("provider_id");
CREATE INDEX "blocked_dates_date_idx" ON "studio_template"."blocked_dates"("date");
CREATE UNIQUE INDEX "blocked_dates_provider_id_date_key" ON "studio_template"."blocked_dates"("provider_id", "date");

-- CreateTable marketplace.working_hours
CREATE TABLE "studio_template"."working_hours" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "provider_id" UUID NOT NULL,
    "timezone" VARCHAR(50) NOT NULL DEFAULT 'Asia/Kolkata',
    "monday_start" VARCHAR(5),
    "monday_end" VARCHAR(5),
    "tuesday_start" VARCHAR(5),
    "tuesday_end" VARCHAR(5),
    "wednesday_start" VARCHAR(5),
    "wednesday_end" VARCHAR(5),
    "thursday_start" VARCHAR(5),
    "thursday_end" VARCHAR(5),
    "friday_start" VARCHAR(5),
    "friday_end" VARCHAR(5),
    "saturday_start" VARCHAR(5),
    "saturday_end" VARCHAR(5),
    "sunday_start" VARCHAR(5),
    "sunday_end" VARCHAR(5),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "working_hours_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "working_hours_provider_id_key" UNIQUE("provider_id")
);

-- CreateTable marketplace.reviews
CREATE TABLE "studio_template"."reviews" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "provider_id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "reviewer_id" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "title" VARCHAR(255),
    "comment" TEXT,
    "helpful_count" INTEGER NOT NULL DEFAULT 0,
    "unhelpful_count" INTEGER NOT NULL DEFAULT 0,
    "is_flagged" BOOLEAN NOT NULL DEFAULT false,
    "flag_reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "reviews_booking_id_key" UNIQUE("booking_id")
);

-- CreateIndex
CREATE INDEX "reviews_provider_id_idx" ON "studio_template"."reviews"("provider_id");
CREATE INDEX "reviews_reviewer_id_idx" ON "studio_template"."reviews"("reviewer_id");

-- CreateTable marketplace.verification_docs
CREATE TABLE "studio_template"."verification_docs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "provider_id" UUID NOT NULL,
    "doc_type" VARCHAR(50) NOT NULL,
    "doc_url" TEXT NOT NULL,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "verified_at" TIMESTAMPTZ,
    "verified_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_docs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "verification_docs_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "studio_template"."service_providers"("id") ON DELETE CASCADE
);

-- CreateIndex
CREATE INDEX "verification_docs_provider_id_idx" ON "studio_template"."verification_docs"("provider_id");

-- CreateTable marketplace.invoices
CREATE TABLE "studio_template"."invoices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "subscription_id" UUID NOT NULL,
    "invoice_number" VARCHAR(100) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'INR',
    "status" VARCHAR(50) NOT NULL DEFAULT 'pending',
    "due_date" TIMESTAMPTZ NOT NULL,
    "paid_date" TIMESTAMPTZ,
    "pdf_url" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "invoices_invoice_number_key" UNIQUE("invoice_number")
);

-- CreateIndex
CREATE INDEX "invoices_subscription_id_idx" ON "studio_template"."invoices"("subscription_id");
CREATE INDEX "invoices_status_idx" ON "studio_template"."invoices"("status");

-- CreateTable marketplace.notifications
CREATE TABLE "studio_template"."notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "recipient_id" UUID NOT NULL,
    "type" VARCHAR(100) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "message" TEXT NOT NULL,
    "related_entity_id" UUID,
    "related_entity_type" VARCHAR(100),
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMPTZ,
    "email_sent" BOOLEAN NOT NULL DEFAULT false,
    "push_sent" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_recipient_id_idx" ON "studio_template"."notifications"("recipient_id");
CREATE INDEX "notifications_is_read_idx" ON "studio_template"."notifications"("is_read");
CREATE INDEX "notifications_created_at_idx" ON "studio_template"."notifications"("created_at" DESC);

-- AddForeignKey for service_providers
ALTER TABLE "studio_template"."service_providers" ADD CONSTRAINT "service_providers_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "studio_template"."provider_subscriptions"("id") ON DELETE SET NULL;

-- AddForeignKey for services
ALTER TABLE "studio_template"."services" ADD CONSTRAINT "services_service_category_id_fkey" FOREIGN KEY ("service_category_id") REFERENCES "studio_template"."service_categories"("id") ON DELETE RESTRICT;

-- AddForeignKey for service_bookings
ALTER TABLE "studio_template"."service_bookings" ADD CONSTRAINT "service_bookings_gym_id_fkey" FOREIGN KEY ("gym_id") REFERENCES "studio_template"."organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "studio_template"."service_bookings" ADD CONSTRAINT "service_bookings_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "studio_template"."service_providers"("id") ON DELETE CASCADE;
ALTER TABLE "studio_template"."service_bookings" ADD CONSTRAINT "service_bookings_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "studio_template"."services"("id") ON DELETE RESTRICT;

-- AddForeignKey for chat_rooms
ALTER TABLE "studio_template"."chat_rooms" ADD CONSTRAINT "chat_rooms_gym_id_fkey" FOREIGN KEY ("gym_id") REFERENCES "studio_template"."organizations"("id") ON DELETE CASCADE;
ALTER TABLE "studio_template"."chat_rooms" ADD CONSTRAINT "chat_rooms_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "studio_template"."service_providers"("id") ON DELETE CASCADE;

-- AddForeignKey for messages
ALTER TABLE "studio_template"."messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."user_identities"("id") ON DELETE CASCADE;

-- AddForeignKey for provider_subscriptions
ALTER TABLE "studio_template"."provider_subscriptions" ADD CONSTRAINT "provider_subscriptions_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "studio_template"."service_providers"("id") ON DELETE CASCADE;
ALTER TABLE "studio_template"."provider_subscriptions" ADD CONSTRAINT "provider_subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "studio_template"."subscription_plans"("id") ON DELETE RESTRICT;

-- AddForeignKey for availability_slots
ALTER TABLE "studio_template"."availability_slots" ADD CONSTRAINT "availability_slots_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "studio_template"."service_providers"("id") ON DELETE CASCADE;

-- AddForeignKey for blocked_dates
ALTER TABLE "studio_template"."blocked_dates" ADD CONSTRAINT "blocked_dates_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "studio_template"."service_providers"("id") ON DELETE CASCADE;

-- AddForeignKey for working_hours
ALTER TABLE "studio_template"."working_hours" ADD CONSTRAINT "working_hours_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "studio_template"."service_providers"("id") ON DELETE CASCADE;

-- AddForeignKey for reviews
ALTER TABLE "studio_template"."reviews" ADD CONSTRAINT "reviews_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "studio_template"."service_providers"("id") ON DELETE CASCADE;
ALTER TABLE "studio_template"."reviews" ADD CONSTRAINT "reviews_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "studio_template"."service_bookings"("id") ON DELETE CASCADE;
ALTER TABLE "studio_template"."reviews" ADD CONSTRAINT "reviews_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "public"."user_identities"("id") ON DELETE CASCADE;

-- AddForeignKey for invoices
ALTER TABLE "studio_template"."invoices" ADD CONSTRAINT "invoices_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "studio_template"."provider_subscriptions"("id") ON DELETE CASCADE;

-- AddForeignKey for notifications
ALTER TABLE "studio_template"."notifications" ADD CONSTRAINT "notifications_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "public"."user_identities"("id") ON DELETE CASCADE;
