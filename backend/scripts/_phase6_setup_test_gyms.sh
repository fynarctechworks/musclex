#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Phase 6 VERIFICATION HARNESS — branch DB only. NOT production.
# ─────────────────────────────────────────────────────────────────────────────
# Builds two faithful, structurally-complete per-gym schemas on the local Docker
# replica so every Phase-6 rewiring slice can run a real two-gym isolation check:
#
#   - clones studio_template STRUCTURE (all 146 tables, FKs, indexes, sequences)
#     into two real UUID-named schemas (matching TenantClientFactory's strict
#     studio_<uuid> regex), via pg_dump --schema-only | sed | psql
#   - registers both in public.studios with schema_name != studio_<gym_id>
#     (deliberately mismatched, exactly as prod does — proves routing must come
#     from the registry, never a transform of gym_id)
#   - seeds ONE distinguishing branch + member per gym so a query through gym A's
#     client returns Alice and through gym B's returns Bob, never the other.
#
# Idempotent: safe to re-run (drops + recreates the two test schemas, upserts
# the two studios, re-seeds). Leaves studio_template and prod-shaped data alone.
set -euo pipefail

C=musclex-branch-db

A_ID=11111111-1111-1111-1111-111111111111
A_SCHEMA=studio_aaaaaaaa_aaaa_aaaa_aaaa_aaaaaaaaaaaa
A_BRANCH=1b111111-1111-1111-1111-111111111111

B_ID=22222222-2222-2222-2222-222222222222
B_SCHEMA=studio_bbbbbbbb_bbbb_bbbb_bbbb_bbbbbbbbbbbb
B_BRANCH=2b222222-2222-2222-2222-222222222222

clone() { # $1 = target schema name
  echo "  cloning studio_template -> $1 ..."
  docker exec "$C" bash -lc "
    set -euo pipefail
    psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q -c 'DROP SCHEMA IF EXISTS \"$1\" CASCADE;'
    pg_dump -U postgres -d postgres --schema-only -n studio_template \
      | sed 's/studio_template/$1/g' \
      | psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q
  "
}

clone "$A_SCHEMA"
clone "$B_SCHEMA"

echo "  registering studios + seeding distinguishing rows ..."
docker exec -i "$C" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q <<SQL
-- Registry rows. schema_name is intentionally NOT studio_<id>: in prod it is
-- studio_<owner_user_id>, so the middleware MUST resolve it from here.
INSERT INTO public.studios (id, name, slug, schema_name, owner_user_id, referral_code)
VALUES
  ('$A_ID','Gym A (test)','gym-a-test','$A_SCHEMA','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','REF-GYM-A'),
  ('$B_ID','Gym B (test)','gym-b-test','$B_SCHEMA','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','REF-GYM-B')
ON CONFLICT (id) DO UPDATE
  SET name = EXCLUDED.name, slug = EXCLUDED.slug,
      schema_name = EXCLUDED.schema_name, owner_user_id = EXCLUDED.owner_user_id;

-- Gym A: one branch + one member (Alice)
INSERT INTO "$A_SCHEMA".branches (id, gym_id, name)
VALUES ('$A_BRANCH','$A_ID','Gym A Main')
ON CONFLICT (id) DO NOTHING;
INSERT INTO "$A_SCHEMA".members (gym_id, member_code, branch_id, full_name, phone, face_descriptor)
VALUES ('$A_ID','A-0001','$A_BRANCH','Alice (Gym A)','+910000000001','{}')
ON CONFLICT (member_code) DO NOTHING;

-- Gym B: one branch + one member (Bob)
INSERT INTO "$B_SCHEMA".branches (id, gym_id, name)
VALUES ('$B_BRANCH','$B_ID','Gym B Main')
ON CONFLICT (id) DO NOTHING;
INSERT INTO "$B_SCHEMA".members (gym_id, member_code, branch_id, full_name, phone, face_descriptor)
VALUES ('$B_ID','B-0001','$B_BRANCH','Bob (Gym B)','+910000000002','{}')
ON CONFLICT (member_code) DO NOTHING;
SQL

echo "Phase-6 test gyms ready:"
docker exec "$C" psql -U postgres -d postgres -c \
  "SELECT id, name, schema_name FROM public.studios WHERE slug LIKE 'gym-_-test' ORDER BY name;"
