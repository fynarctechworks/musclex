import {
  createParamDecorator,
  ExecutionContext,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';

const MIN_LEN = 16;
const MAX_LEN = 128;
const VALID_CHARS = /^[A-Za-z0-9._\-:]+$/;

/**
 * @IdempotencyKey() — extracts the `Idempotency-Key` request header and
 * enforces presence + a conservative format. Designed for money mutations
 * where the client (frontend or main app) is expected to generate a UUIDv4
 * once per user action and reuse it across network retries.
 */
export const IdempotencyKey = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest<Request>();
    const raw = req.headers['idempotency-key'];
    const key = Array.isArray(raw) ? raw[0] : raw;

    if (!key || typeof key !== 'string') {
      throw new BadRequestException(
        'Idempotency-Key header is required for this operation',
      );
    }
    if (key.length < MIN_LEN || key.length > MAX_LEN) {
      throw new BadRequestException(
        `Idempotency-Key must be ${MIN_LEN}-${MAX_LEN} characters`,
      );
    }
    if (!VALID_CHARS.test(key)) {
      throw new BadRequestException(
        'Idempotency-Key may only contain letters, digits, and . _ - :',
      );
    }
    return key;
  },
);
