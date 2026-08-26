/**
 * The check-in request body, in one place.
 *
 * This lived inline in the mutation and was RE-IMPLEMENTED in its test, which
 * meant the test asserted the shape of a copy: the real payload could change
 * freely and the test would still pass. Both now build from here.
 */
export type CheckInInput = {
  /** Manual path: the member picked from search. */
  memberId?: string;
  /** Scan path: the raw scanned string, forwarded verbatim. */
  qrCode?: string;
  clientEventId: string;
  branchId?: string | null;
};

export function buildCheckInBody(input: CheckInInput): Record<string, unknown> {
  return {
    // A scan identifies the member by signed token; the two are never both sent.
    ...(input.qrCode ? { qr_code: input.qrCode } : { member_id: input.memberId }),
    checkin_method: input.qrCode ? 'qr' : 'manual',
    client_event_id: input.clientEventId,
    source: 'staff_mobile',
    // Must be ABSENT, not null, on "All branches" — the DTO's @IsUUID rejects null.
    ...(input.branchId ? { branch_id: input.branchId } : {}),
  };
}
