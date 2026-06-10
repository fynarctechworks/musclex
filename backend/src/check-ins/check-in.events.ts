/**
 * In-process event topics for the check-in module.
 *
 * The orchestrator emits these via EventEmitter2 AFTER its persistence
 * transaction commits. Listeners (e.g. CheckInsGateway) react without
 * coupling to the orchestrator's internals.
 *
 * These are runtime topics distinct from `DomainEvent` rows — the latter
 * are the durable audit log, these are ephemeral broadcast cues.
 */

export const CHECK_IN_RECORDED = 'check_in.recorded';
export const CHECK_IN_DENIED = 'check_in.denied';
export const CHECK_IN_OVERRIDDEN = 'check_in.overridden';
export const OCCUPANCY_UPDATED = 'check_in.occupancy_updated';

export interface CheckInRecordedPayload {
  gym_id: string;
  branch_id: string;
  check_in_id: string;
  check_in_event_id: string;
  member: {
    id: string;
    full_name: string;
    member_code: string;
  };
  method: string;
  source: string;
  recorded_at: string; // ISO
  class_id: string | null;
  /** Per-request correlation id — echoes back so the originating client
   *  can attach the same key to a Sentry breadcrumb and tie front-end
   *  errors to back-end logs / persisted CheckInEvent rows. */
  correlation_id?: string;
}

export interface CheckInDeniedPayload {
  gym_id: string;
  branch_id: string;
  check_in_event_id: string;
  member: {
    id: string;
    full_name: string;
    member_code: string;
  };
  denial_reason: string;
  message: string;
  recorded_at: string; // ISO
  correlation_id?: string;
}

export interface CheckInOverriddenPayload extends CheckInRecordedPayload {
  override_by_user_id: string | null;
  override_reason: string | null;
}

export interface OccupancyUpdatedPayload {
  gym_id: string;
  branch_id: string;
  current: number;
  as_of: string; // ISO
}
