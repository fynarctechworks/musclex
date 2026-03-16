-- Add description and expires_at to member_documents
ALTER TABLE "studio_template"."member_documents"
ADD COLUMN IF NOT EXISTS "description" TEXT,
ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMPTZ;
