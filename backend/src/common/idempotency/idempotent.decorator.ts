import { SetMetadata } from '@nestjs/common';

export const STAFF_IDEMPOTENT_KEY = 'staffIdempotent';

/**
 * Marks a staff mutation as idempotency-aware. When the client sends an
 * `Idempotency-Key` header, the StaffIdempotencyInterceptor dedupes retries
 * (replaying the original response) and 409s a concurrent in-flight duplicate.
 *
 * The header is OPTIONAL by design — omitting it preserves today's behaviour,
 * so this can be rolled out without breaking existing callers. Send a UUID per
 * logical action (e.g. one "Record payment" click) to get the protection.
 */
export const Idempotent = () => SetMetadata(STAFF_IDEMPOTENT_KEY, true);
