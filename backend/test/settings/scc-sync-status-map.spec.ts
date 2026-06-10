import { Test, TestingModule } from '@nestjs/testing';
import { SccSyncService } from '../../src/common/services/scc-sync.service';
import { PrismaService } from '../../src/prisma/prisma.service';

/**
 * Regression test for SccSyncService.mapStatus.
 *
 * Background: the SCC TenantStatus enum is ACTIVE | TRIAL | EXPIRED | SUSPENDED
 * (no GRACE_PERIOD or LOCKED bucket). Callers can now pass EITHER the legacy
 * studio.subscription_status (trial|active|expired|suspended) OR the live-
 * computed lifecycle_status (active|grace_period|locked|suspended). Both must
 * map onto the SCC enum correctly so the SaaS Control Center dashboard never
 * shows a gym as ACTIVE while it's actually in grace/locked.
 *
 * mapStatus is private, so we exercise it via upsertTenant by intercepting
 * the raw SQL the service emits (the status is positional arg 8 / $8).
 */
describe('SccSyncService — status mapping for SCC TenantStatus', () => {
  let service: SccSyncService;
  let prisma: { $executeRawUnsafe: jest.Mock };

  /** Returns the value bound to $8 (the status arg) in the last upsert call. */
  const lastStatusArg = () => prisma.$executeRawUnsafe.mock.calls.at(-1)?.[8];

  beforeEach(async () => {
    prisma = { $executeRawUnsafe: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SccSyncService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(SccSyncService);
  });

  afterEach(() => jest.clearAllMocks());

  const callWith = (status: { lifecycle_status?: string; subscription_status?: string }) =>
    service.upsertTenant({
      id: 'studio-1',
      name: 'Shiva Gym',
      slug: 'shiva-gym',
      ...status,
    });

  describe('computed lifecycle_status (preferred)', () => {
    it('maps active → ACTIVE', async () => {
      await callWith({ lifecycle_status: 'active' });
      expect(lastStatusArg()).toBe('ACTIVE');
    });

    it('maps grace_period → EXPIRED (a gym in grace IS past expiry)', async () => {
      await callWith({ lifecycle_status: 'grace_period' });
      expect(lastStatusArg()).toBe('EXPIRED');
    });

    it('maps locked → EXPIRED', async () => {
      await callWith({ lifecycle_status: 'locked' });
      expect(lastStatusArg()).toBe('EXPIRED');
    });

    it('maps suspended → SUSPENDED', async () => {
      await callWith({ lifecycle_status: 'suspended' });
      expect(lastStatusArg()).toBe('SUSPENDED');
    });
  });

  describe('legacy subscription_status fallback', () => {
    it('uses subscription_status when lifecycle_status is absent', async () => {
      await callWith({ subscription_status: 'trial' });
      expect(lastStatusArg()).toBe('TRIAL');
    });

    it('prefers lifecycle_status over subscription_status when both passed', async () => {
      // The user's Shiva-Gym case: legacy column says 'active' (frozen at
      // onboarding) but live computed says 'grace_period'. SCC must reflect
      // reality, not the lie.
      await callWith({ lifecycle_status: 'grace_period', subscription_status: 'active' });
      expect(lastStatusArg()).toBe('EXPIRED');
    });
  });

  it('defaults unknown values to TRIAL (safe default for a new tenant)', async () => {
    await callWith({ lifecycle_status: 'mystery_state' });
    expect(lastStatusArg()).toBe('TRIAL');
  });

  it('defaults to TRIAL when no status is passed at all', async () => {
    await callWith({});
    expect(lastStatusArg()).toBe('TRIAL');
  });
});
