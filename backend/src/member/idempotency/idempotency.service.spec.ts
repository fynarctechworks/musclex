import { Prisma } from '@prisma/client';
import { IdempotencyService, IdempotencyKeyRef } from './idempotency.service';

/** Unit tests for the idempotency store's claim/replay/conflict logic. */
describe('IdempotencyService', () => {
  let prisma: any;
  let service: IdempotencyService;
  const ref: IdempotencyKeyRef = {
    tenantId: 't1',
    memberId: 'm1',
    key: 'k1',
    endpoint: 'POST CheckInsController#create',
    requestHash: 'reqhash',
  };

  const p2002 = () =>
    new Prisma.PrismaClientKnownRequestError('Unique constraint', {
      code: 'P2002',
      clientVersion: '5.22.0',
    });

  beforeEach(() => {
    prisma = {
      memberIdempotencyKey: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    service = new IdempotencyService(prisma);
  });

  it('claims a fresh key by inserting an in_progress row', async () => {
    prisma.memberIdempotencyKey.create.mockResolvedValue({});
    await expect(service.claim(ref)).resolves.toEqual({ kind: 'fresh' });
  });

  it('replays the stored response for a completed key with the same body', async () => {
    prisma.memberIdempotencyKey.create.mockRejectedValue(p2002());
    prisma.memberIdempotencyKey.findUnique.mockResolvedValue({
      endpoint: ref.endpoint,
      request_hash: ref.requestHash,
      status: 'completed',
      response_status: 201,
      response_body: { data: { ok: true } },
    });
    await expect(service.claim(ref)).resolves.toEqual({
      kind: 'replay',
      status: 201,
      body: { data: { ok: true } },
    });
  });

  it('conflicts when the same key is reused with a different body', async () => {
    prisma.memberIdempotencyKey.create.mockRejectedValue(p2002());
    prisma.memberIdempotencyKey.findUnique.mockResolvedValue({
      endpoint: ref.endpoint,
      request_hash: 'DIFFERENT',
      status: 'completed',
      response_status: 201,
      response_body: {},
    });
    await expect(service.claim(ref)).resolves.toEqual({
      kind: 'conflict',
      reason: 'key_reused',
    });
  });

  it('conflicts when the original request is still in progress', async () => {
    prisma.memberIdempotencyKey.create.mockRejectedValue(p2002());
    prisma.memberIdempotencyKey.findUnique.mockResolvedValue({
      endpoint: ref.endpoint,
      request_hash: ref.requestHash,
      status: 'in_progress',
      response_status: null,
      response_body: null,
    });
    await expect(service.claim(ref)).resolves.toEqual({
      kind: 'conflict',
      reason: 'in_progress',
    });
  });

  it('hashRequest is stable and body-sensitive', () => {
    expect(service.hashRequest({ a: 1 })).toBe(service.hashRequest({ a: 1 }));
    expect(service.hashRequest({ a: 1 })).not.toBe(service.hashRequest({ a: 2 }));
  });
});
