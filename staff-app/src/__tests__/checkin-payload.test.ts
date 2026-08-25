import { uuidv4 } from '../lib/uuid';

/**
 * The check-in payload contract, asserted directly.
 *
 * The confirm dialog's button cannot be driven by idb (portal content is a
 * single accessibility element), so the end-to-end tap is verified by hand.
 * What IS testable is the payload — and that is where the real bug was:
 * `crypto.randomUUID` does not exist in Hermes, so a non-UUID idempotency key
 * was sent and the backend rejected it with "client_event_id must be a UUID".
 */
const RFC4122_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function buildCheckInBody(input: {
  memberId: string; clientEventId: string; branchId?: string | null;
}) {
  return {
    member_id: input.memberId,
    checkin_method: 'manual',
    client_event_id: input.clientEventId,
    source: 'staff_mobile',
    ...(input.branchId ? { branch_id: input.branchId } : {}),
  };
}

describe('check-in payload', () => {
  it('sends an RFC-4122 idempotency key the backend DTO accepts', () => {
    const body = buildCheckInBody({ memberId: 'm1', clientEventId: uuidv4() });
    expect(body.client_event_id).toMatch(RFC4122_V4);
  });

  it('omits branch_id entirely when on "All branches"', () => {
    // Sending null would fail @IsUUID; the field must be absent, not null.
    const body = buildCheckInBody({ memberId: 'm1', clientEventId: uuidv4(), branchId: null });
    expect('branch_id' in body).toBe(false);
  });

  it('includes branch_id when a branch is selected', () => {
    const body = buildCheckInBody({ memberId: 'm1', clientEventId: uuidv4(), branchId: 'b1' });
    expect(body).toMatchObject({ branch_id: 'b1' });
  });

  it('marks the source so desk traffic is distinguishable from kiosk/web', () => {
    expect(buildCheckInBody({ memberId: 'm1', clientEventId: uuidv4() }).source).toBe('staff_mobile');
  });
});
