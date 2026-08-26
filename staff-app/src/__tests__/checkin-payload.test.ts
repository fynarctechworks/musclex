import { uuidv4 } from '../lib/uuid';
import { buildCheckInBody } from '../api/checkin-payload';

/**
 * The check-in payload contract, asserted against the REAL builder the
 * mutation uses — this file used to re-implement it, which meant it was
 * asserting the shape of a copy.
 *
 * The confirm dialog's button cannot be driven by idb (portal content is a
 * single accessibility element), so the end-to-end tap is verified by hand.
 * What IS testable is the payload — and that is where the real bug was:
 * `crypto.randomUUID` does not exist in Hermes, so a non-UUID idempotency key
 * was sent and the backend rejected it with "client_event_id must be a UUID".
 */
const RFC4122_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

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

  describe('scan path', () => {
    const SCANNED = 'mxqr.v1.eyJtaWQiOiJhIn0.c2ln';

    it('sends the scanned string verbatim as qr_code', () => {
      // Never parsed or normalised client-side — the server owns verification.
      const body = buildCheckInBody({ qrCode: SCANNED, clientEventId: uuidv4() });
      expect(body).toMatchObject({ qr_code: SCANNED });
    });

    it('labels the method qr, so attendance reports can tell the paths apart', () => {
      const body = buildCheckInBody({ qrCode: SCANNED, clientEventId: uuidv4() });
      expect(body.checkin_method).toBe('qr');
    });

    it('does NOT also send member_id', () => {
      // Both set would leave the server choosing which identifier to trust.
      const body = buildCheckInBody({ qrCode: SCANNED, memberId: 'm1', clientEventId: uuidv4() });
      expect('member_id' in body).toBe(false);
    });

    it('still carries its own idempotency key', () => {
      const body = buildCheckInBody({ qrCode: SCANNED, clientEventId: uuidv4() });
      expect(body.client_event_id).toMatch(RFC4122_V4);
    });
  });
});
