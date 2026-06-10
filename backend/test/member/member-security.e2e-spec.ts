/**
 * ────────────────────────────────────────────────────────────────
 * MEMBER BFF — SECURITY GATES (Checklist §6)  [SCAFFOLD]
 * ────────────────────────────────────────────────────────────────
 *
 * These are the gates that MUST be green before the member app ships. They are
 * scaffolded as it.todo() until the staging seed + HTTP harness exist, so the
 * required assertions are tracked and can't be silently skipped.
 *
 * To implement (next test pass):
 *   1. Seed staging with TWO fake gyms (Studio A, Studio B), each with members
 *      A1/A2 and B1 (member_directory populated).
 *   2. Boot the Nest app via Test.createTestingModule(AppModule) + supertest.
 *   3. Mint member access tokens directly via MemberTokenService for A1/A2/B1
 *      (skips the Supabase OTP round-trip — we test the BFF, not Supabase).
 *   4. Replace each it.todo with the real request + assertion below.
 *
 * Make any failure here a CI failure (Checklist §6).
 */

describe('Member BFF security gates (§6)', () => {
  describe('cross-member isolation (same gym)', () => {
    // Member A2's token must never surface Member A1's data. Our endpoints take
    // no client memberId, so this verifies the @CurrentMember + member_id gate
    // end-to-end (service-layer coverage already in member-data.service.spec.ts).
    it.todo('GET /me as A2 returns A2, never A1');
    it.todo('GET /membership as A2 reflects only A2 memberships/invoices');
    it.todo('GET /progress as A2 returns only A2 body stats + photos');
    it.todo('POST /progress/metrics as A2 writes a row owned by A2');
    it.todo('POST /checkins as A2 records a check-in for A2 only');
  });

  describe('cross-tenant isolation (different gyms)', () => {
    // A token for Gym A must resolve gym_id from the JWT only; Gym B rows are invisible.
    it.todo('A1 cannot read any Gym B resource (404/empty), proving tenant scope from JWT');
    it.todo('a tenantId in body/query/header is ignored — scope comes from the token');
  });

  describe('token audience isolation', () => {
    it.todo('a member token (aud=member) is rejected by an /admin/* route');
    it.todo('an admin/Supabase token is rejected by every /member/* data route');
    it.todo('a malformed/expired member token yields 401 INVALID_TOKEN');
  });

  describe('idempotency + envelope', () => {
    it.todo('replaying an Idempotency-Key returns the original response, no double write');
    it.todo('reusing an Idempotency-Key with a different body returns 409 CONFLICT');
    it.todo('missing Idempotency-Key on an @Idempotent route returns 400');
    it.todo('data responses are wrapped in { data, meta }; errors as { error }');
  });

  describe('auth flow', () => {
    it.todo('POST /auth/otp/request always returns 200 (no phone enumeration)');
    it.todo('POST /auth/session for an unknown phone returns 403 NOT_A_MEMBER');
    it.todo('POST /auth/session for a multi-gym phone returns tenantChoices, no tokens');
    it.todo('POST /auth/refresh rotates and revokes the presented token');
  });
});
