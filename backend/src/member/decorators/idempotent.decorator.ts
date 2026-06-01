import { SetMetadata } from '@nestjs/common';

/**
 * Marks a member write endpoint as idempotent: the IdempotencyInterceptor will
 * require an `Idempotency-Key` header, dedupe retries, and replay the original
 * response for a repeated key (offline outbox safety — Checklist §4.2).
 */
export const IDEMPOTENT_KEY = 'memberIdempotent';
export const Idempotent = () => SetMetadata(IDEMPOTENT_KEY, true);
