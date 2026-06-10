import { Test } from '@nestjs/testing';
import { ConflictException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { IdempotencyService } from './idempotency.service';
import { PrismaService } from '../../database/prisma.service';

type FakeRow = {
  key: string;
  endpoint: string;
  request_hash: string;
  admin_id?: string | null;
  response_body: unknown | null;
  status_code: number | null;
  created_at: Date;
};

function makePrismaStub() {
  const rows = new Map<string, FakeRow>();
  return {
    rows,
    idempotencyKey: {
      findUnique: jest.fn(async ({ where: { key } }: { where: { key: string } }) => {
        return rows.get(key) ?? null;
      }),
      create: jest.fn(async ({ data }: { data: Omit<FakeRow, 'response_body' | 'status_code' | 'created_at'> & { admin_id?: string | null } }) => {
        if (rows.has(data.key)) {
          throw new Prisma.PrismaClientKnownRequestError(
            'Unique constraint failed',
            { code: 'P2002', clientVersion: 'test' } as any,
          );
        }
        const row: FakeRow = {
          ...data,
          admin_id: data.admin_id ?? null,
          response_body: null,
          status_code: null,
          created_at: new Date(),
        };
        rows.set(data.key, row);
        return row;
      }),
      update: jest.fn(async ({ where: { key }, data }: { where: { key: string }; data: any }) => {
        const existing = rows.get(key);
        if (!existing) throw new Error('not found');
        const merged: FakeRow = { ...existing, ...data };
        rows.set(key, merged);
        return merged;
      }),
      delete: jest.fn(async ({ where: { key } }: { where: { key: string } }) => {
        const existing = rows.get(key);
        if (!existing) {
          throw new Prisma.PrismaClientKnownRequestError('not found', {
            code: 'P2025',
            clientVersion: 'test',
          } as any);
        }
        rows.delete(key);
        return existing;
      }),
      deleteMany: jest.fn(async ({ where }: any) => {
        const cutoff: Date = where.created_at.lt;
        let count = 0;
        for (const [k, v] of rows.entries()) {
          if (v.created_at < cutoff) {
            rows.delete(k);
            count++;
          }
        }
        return { count };
      }),
    },
  };
}

describe('IdempotencyService', () => {
  let svc: IdempotencyService;
  let prisma: ReturnType<typeof makePrismaStub>;

  beforeEach(async () => {
    prisma = makePrismaStub();
    const mod = await Test.createTestingModule({
      providers: [
        IdempotencyService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    svc = mod.get(IdempotencyService);
  });

  it('hashes request deterministically regardless of key order', () => {
    const a = svc.hashRequest('e', { id: '1', amount: 100 });
    const b = svc.hashRequest('e', { amount: 100, id: '1' });
    expect(a).toBe(b);
  });

  it('reserves a fresh key and returns replayed=false', async () => {
    const r = await svc.checkOrReserve('idem-key-aaaaaaaaaaaaaaa', 'POST /x', 'h1', 'admin-1');
    expect(r.replayed).toBe(false);
    expect(prisma.rows.has('idem-key-aaaaaaaaaaaaaaa')).toBe(true);
  });

  it('replays a stored response when key + hash match', async () => {
    await svc.checkOrReserve('idem-key-aaaaaaaaaaaaaaa', 'POST /x', 'h1');
    await svc.saveResponse('idem-key-aaaaaaaaaaaaaaa', { ok: true, id: 'p1' }, 200);

    const replayed = await svc.checkOrReserve('idem-key-aaaaaaaaaaaaaaa', 'POST /x', 'h1');
    expect(replayed.replayed).toBe(true);
    expect(replayed.response).toEqual({ ok: true, id: 'p1' });
    expect(replayed.status_code).toBe(200);
  });

  it('rejects key reuse on a different endpoint with 409', async () => {
    await svc.checkOrReserve('idem-key-bbbbbbbbbbbbbbb', 'POST /a', 'h');
    await svc.saveResponse('idem-key-bbbbbbbbbbbbbbb', { ok: true });
    await expect(
      svc.checkOrReserve('idem-key-bbbbbbbbbbbbbbb', 'POST /b', 'h'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects key reuse with a different request hash as 422', async () => {
    await svc.checkOrReserve('idem-key-ccccccccccccccc', 'POST /x', 'h1');
    await svc.saveResponse('idem-key-ccccccccccccccc', { ok: true });
    await expect(
      svc.checkOrReserve('idem-key-ccccccccccccccc', 'POST /x', 'h2-different'),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('rejects in-flight collisions as 409 (reservation exists, no response yet)', async () => {
    await svc.checkOrReserve('idem-key-ddddddddddddddd', 'POST /x', 'h1');
    await expect(
      svc.checkOrReserve('idem-key-ddddddddddddddd', 'POST /x', 'h1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('release deletes the reservation so a retry can start fresh', async () => {
    await svc.checkOrReserve('idem-key-eeeeeeeeeeeeeee', 'POST /x', 'h1');
    await svc.release('idem-key-eeeeeeeeeeeeeee');
    expect(prisma.rows.has('idem-key-eeeeeeeeeeeeeee')).toBe(false);
    // Now a fresh reservation should succeed
    const r = await svc.checkOrReserve('idem-key-eeeeeeeeeeeeeee', 'POST /x', 'h1');
    expect(r.replayed).toBe(false);
  });

  it('cleanupExpired deletes rows older than 24h and leaves fresh rows', async () => {
    const day = 24 * 60 * 60 * 1000;
    prisma.rows.set('old', {
      key: 'old', endpoint: 'POST /x', request_hash: 'h',
      response_body: null, status_code: null, admin_id: null,
      created_at: new Date(Date.now() - day - 1000),
    });
    prisma.rows.set('new', {
      key: 'new', endpoint: 'POST /x', request_hash: 'h',
      response_body: null, status_code: null, admin_id: null,
      created_at: new Date(),
    });
    await svc.cleanupExpired();
    expect(prisma.rows.has('old')).toBe(false);
    expect(prisma.rows.has('new')).toBe(true);
  });
});
