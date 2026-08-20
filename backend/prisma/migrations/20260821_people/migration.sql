-- Finding people: hashed phone matching (2026-08-21).
--
-- ─── WHY A HASH AND NOT THE NUMBERS ─────────────────────────────────────────
--
-- Strava's fastest growth lever is uploading the phone's address book. We match
-- on a HASH instead: the app normalises and hashes each contact locally and
-- sends only digests, so we never receive, log or store a member's address
-- book, and a breach of our request logs yields no phone numbers.
--
-- Be honest about the limit: phone numbers are a small, enumerable space, so a
-- determined attacker WITH the salt could reverse a digest. This is not
-- cryptographic privacy. What it buys is real but bounded — no plaintext
-- address book in transit, in logs, or at rest — and the UI says as much
-- rather than implying more.
--
-- ─── WHY THE LAST TEN DIGITS ────────────────────────────────────────────────
--
-- `phone` is documented as E.164 but rows exist both with and without a country
-- code — the same human appears twice depending on how the number was
-- submitted, which has already bitten this codebase. Keying on the last ten
-- digits makes '9877000111' and '919877000111' hash identically, so contact
-- matching works despite that mess rather than silently missing half of it.

-- Generated, so it can never drift from the column it is derived from.
ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS phone_tail text
  GENERATED ALWAYS AS (right(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 10)) STORED;

CREATE INDEX IF NOT EXISTS app_users_phone_tail_idx ON public.app_users (phone_tail);
