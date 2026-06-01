-- Member App Directory: cross-tenant phone → (gym, member) lookup (public schema).
-- The ONLY cross-tenant table the member auth path reads. Idempotent + additive;
-- applied to staging via the Supabase migration tool (this DB's _prisma_migrations
-- history is untracked, so it is NOT deployed via `prisma migrate deploy`).

CREATE TABLE IF NOT EXISTS public.member_directory (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone      text NOT NULL,
  tenant_id  uuid NOT NULL,
  member_id  uuid NOT NULL,
  status     text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT member_directory_tenant_id_fkey FOREIGN KEY (tenant_id)
    REFERENCES public.studios(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS member_directory_phone_tenant_id_key
  ON public.member_directory (phone, tenant_id);

CREATE UNIQUE INDEX IF NOT EXISTS member_directory_tenant_id_member_id_key
  ON public.member_directory (tenant_id, member_id);

CREATE INDEX IF NOT EXISTS member_directory_phone_idx
  ON public.member_directory (phone);
