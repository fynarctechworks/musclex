import { Test } from '@nestjs/testing';
import { AccessScopeResolver } from './access-scope.resolver';
import { PrismaService } from '../../prisma/prisma.service';
import type { CheckInContext } from './rule.interface';

/**
 * Pure-logic tests for AccessScopeResolver. The only DB touches are inside
 * resolveAllAccess / resolveCityAccess fallback paths; everything else is
 * decided from the pre-loaded context.
 */
describe('AccessScopeResolver', () => {
  let resolver: AccessScopeResolver;
  let prisma: { branch: { findUnique: jest.Mock } };

  const HOME = '00000000-0000-0000-0000-000000000001';
  const SISTER = '00000000-0000-0000-0000-000000000002';
  const STRANGER = '00000000-0000-0000-0000-000000000003';
  const ORG = '00000000-0000-0000-0000-0000000000aa';
  const OTHER_ORG = '00000000-0000-0000-0000-0000000000bb';
  const MEMBER = '00000000-0000-0000-0000-0000000000cc';
  const MEMBERSHIP = '00000000-0000-0000-0000-0000000000dd';

  beforeEach(async () => {
    prisma = { branch: { findUnique: jest.fn() } };

    const module = await Test.createTestingModule({
      providers: [
        AccessScopeResolver,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    resolver = module.get(AccessScopeResolver);
  });

  // Default scope helpers — caller overrides only the fields under test.
  function ctx(overrides: Partial<{
    accessType: string;
    targetBranchId: string;
    membershipBranchId: string;
    memberBranchId: string;
    planAllowed: string[];
    branchAccessIds: string[];
    allowedCity: string | null;
    targetCity: string | null;
    planOrgId: string | null;
    branchOrgId: string | null;
    allowedHours: Record<string, unknown> | null;
    now: Date;
    timezone: string;
    classId: string | null;
  }> = {}): CheckInContext {
    const opts = {
      accessType: 'single_branch',
      targetBranchId: HOME,
      membershipBranchId: HOME,
      memberBranchId: HOME,
      planAllowed: [] as string[],
      branchAccessIds: [HOME],
      allowedCity: null as string | null,
      targetCity: null as string | null,
      planOrgId: null as string | null,
      branchOrgId: null as string | null,
      allowedHours: null as Record<string, unknown> | null,
      now: new Date('2026-05-21T10:00:00Z'),
      timezone: 'Asia/Kolkata',
      classId: null as string | null,
      ...overrides,
    };

    return {
      gym_id: 'gym-1',
      now: opts.now,
      member: {
        id: MEMBER,
        status: 'active',
        branch_id: opts.memberBranchId,
        full_name: 'Test Member',
        member_code: 'FS-001',
      },
      membership: {
        id: MEMBERSHIP,
        status: 'active',
        branch_id: opts.membershipBranchId,
        end_date: null,
        grace_end_date: null,
        classes_remaining: null,
        freeze_start_date: null,
        freeze_end_date: null,
        plan: {
          plan_type: 'monthly',
          name: 'Test Plan',
          access_type: opts.accessType,
          tier: 'basic',
          allowed_branch_ids: opts.planAllowed,
          allowed_city: opts.allowedCity,
          allowed_hours_json: opts.allowedHours,
          organization_id: opts.planOrgId,
        },
        branch_access_ids: opts.branchAccessIds,
      },
      branch: {
        id: opts.targetBranchId,
        timezone: opts.timezone,
        opening_time: null,
        closing_time: null,
        organization_id: opts.branchOrgId,
        city: opts.targetCity,
      },
      request: {
        branch_id: opts.targetBranchId,
        class_id: opts.classId,
        method: 'qr',
        source: 'staff_desktop',
        client_event_id: null,
        override_authorized: false,
        override_reason: null,
      },
      prisma: prisma as any,
      derived: {},
    };
  }

  it('no membership → pass through (rule layer decides)', async () => {
    const c = ctx();
    c.membership = null;
    expect(await resolver.resolve(c)).toEqual({ allowed: true });
  });

  // ── single_branch ────────────────────────────────────────────────────

  describe('single_branch', () => {
    it('allows home branch', async () => {
      expect(
        await resolver.resolve(ctx({ accessType: 'single_branch', targetBranchId: HOME })),
      ).toEqual({ allowed: true });
    });

    it('allows a sister branch when an explicit grant exists (transfer / travel pass)', async () => {
      expect(
        await resolver.resolve(
          ctx({
            accessType: 'single_branch',
            targetBranchId: SISTER,
            branchAccessIds: [HOME, SISTER],
          }),
        ),
      ).toEqual({ allowed: true });
    });

    it('denies a stranger branch with wrong_branch', async () => {
      const r = await resolver.resolve(
        ctx({ accessType: 'single_branch', targetBranchId: STRANGER, branchAccessIds: [HOME] }),
      );
      expect(r.allowed).toBe(false);
      if (!r.allowed) expect(r.reason).toBe('wrong_branch');
    });
  });

  // ── multi_branch ─────────────────────────────────────────────────────

  describe('multi_branch', () => {
    it('allows a branch in plan.allowed_branch_ids', async () => {
      const r = await resolver.resolve(
        ctx({
          accessType: 'multi_branch',
          targetBranchId: SISTER,
          planAllowed: [HOME, SISTER],
          branchAccessIds: [HOME],
        }),
      );
      expect(r.allowed).toBe(true);
    });

    it('allows a branch in explicit grants even if not in plan list', async () => {
      const r = await resolver.resolve(
        ctx({
          accessType: 'multi_branch',
          targetBranchId: SISTER,
          planAllowed: [HOME],
          branchAccessIds: [HOME, SISTER],
        }),
      );
      expect(r.allowed).toBe(true);
    });

    it('denies a branch not in plan list or grants with branch_not_in_plan', async () => {
      const r = await resolver.resolve(
        ctx({
          accessType: 'multi_branch',
          targetBranchId: STRANGER,
          planAllowed: [HOME, SISTER],
          branchAccessIds: [HOME],
        }),
      );
      expect(r.allowed).toBe(false);
      if (!r.allowed) expect(r.reason).toBe('branch_not_in_plan');
    });
  });

  // ── all_access ───────────────────────────────────────────────────────

  describe('all_access', () => {
    it('allows when plan.organization_id matches branch.organization_id (no DB hit)', async () => {
      const r = await resolver.resolve(
        ctx({
          accessType: 'all_access',
          targetBranchId: STRANGER,
          planOrgId: ORG,
          branchOrgId: ORG,
        }),
      );
      expect(r.allowed).toBe(true);
      expect(prisma.branch.findUnique).not.toHaveBeenCalled();
    });

    it('falls back to a DB lookup when branch.organization_id is missing', async () => {
      prisma.branch.findUnique.mockResolvedValueOnce({ organization_id: ORG });
      const r = await resolver.resolve(
        ctx({
          accessType: 'all_access',
          targetBranchId: STRANGER,
          planOrgId: ORG,
          branchOrgId: null,
        }),
      );
      expect(r.allowed).toBe(true);
      expect(prisma.branch.findUnique).toHaveBeenCalledWith({
        where: { id: STRANGER },
        select: { organization_id: true },
      });
    });

    it('falls back to home-branch org comparison when plan has no org', async () => {
      prisma.branch.findUnique
        .mockResolvedValueOnce({ organization_id: ORG }) // target
        .mockResolvedValueOnce({ organization_id: ORG }); // home
      const r = await resolver.resolve(
        ctx({
          accessType: 'all_access',
          targetBranchId: STRANGER,
          planOrgId: null,
          branchOrgId: null,
        }),
      );
      expect(r.allowed).toBe(true);
    });

    it('denies when target branch is outside the organization', async () => {
      prisma.branch.findUnique.mockResolvedValueOnce({ organization_id: OTHER_ORG });
      const r = await resolver.resolve(
        ctx({
          accessType: 'all_access',
          targetBranchId: STRANGER,
          planOrgId: ORG,
          branchOrgId: null,
        }),
      );
      expect(r.allowed).toBe(false);
      if (!r.allowed) expect(r.reason).toBe('branch_outside_organization');
    });
  });

  // ── city_access ──────────────────────────────────────────────────────

  describe('city_access', () => {
    it('allows when branch.city matches plan.allowed_city (case-insensitive)', async () => {
      const r = await resolver.resolve(
        ctx({
          accessType: 'city_access',
          targetBranchId: SISTER,
          allowedCity: 'Hyderabad',
          targetCity: 'HYDERABAD',
        }),
      );
      expect(r.allowed).toBe(true);
    });

    it('denies when cities differ', async () => {
      prisma.branch.findUnique.mockResolvedValueOnce({ city: 'Bangalore' });
      const r = await resolver.resolve(
        ctx({
          accessType: 'city_access',
          targetBranchId: SISTER,
          allowedCity: 'Hyderabad',
          targetCity: null,
        }),
      );
      expect(r.allowed).toBe(false);
      if (!r.allowed) expect(r.reason).toBe('branch_outside_city');
    });

    it('denies with city_scope_misconfigured when plan has no allowed_city', async () => {
      const r = await resolver.resolve(
        ctx({ accessType: 'city_access', allowedCity: null }),
      );
      expect(r.allowed).toBe(false);
      if (!r.allowed) expect(r.reason).toBe('city_scope_misconfigured');
    });
  });

  // ── time_based ───────────────────────────────────────────────────────

  describe('time_based', () => {
    it('allows when current time is inside the window', async () => {
      // 10:00 UTC = 15:30 IST → inside 06:00-22:00
      const r = await resolver.resolve(
        ctx({
          accessType: 'time_based',
          allowedHours: { start: '06:00', end: '22:00' },
        }),
      );
      expect(r.allowed).toBe(true);
    });

    it('denies when outside the window', async () => {
      // 10:00 UTC = 15:30 IST → outside 06:00-10:00
      const r = await resolver.resolve(
        ctx({
          accessType: 'time_based',
          allowedHours: { start: '06:00', end: '10:00' },
        }),
      );
      expect(r.allowed).toBe(false);
      if (!r.allowed) expect(r.reason).toBe('outside_allowed_hours');
    });

    it('handles overnight windows (22:00 → 04:00)', async () => {
      // 23:00 IST = 17:30 UTC
      const r = await resolver.resolve(
        ctx({
          accessType: 'time_based',
          now: new Date('2026-05-21T17:30:00Z'),
          allowedHours: { start: '22:00', end: '04:00' },
        }),
      );
      expect(r.allowed).toBe(true);
    });

    it('denies when wrong branch even within the window', async () => {
      const r = await resolver.resolve(
        ctx({
          accessType: 'time_based',
          targetBranchId: STRANGER,
          branchAccessIds: [HOME],
          allowedHours: { start: '06:00', end: '22:00' },
        }),
      );
      expect(r.allowed).toBe(false);
      if (!r.allowed) expect(r.reason).toBe('wrong_branch');
    });
  });

  // ── class_only ───────────────────────────────────────────────────────

  describe('class_only', () => {
    it('denies open-gym check-in (no class_id) with class_only_plan', async () => {
      const r = await resolver.resolve(
        ctx({ accessType: 'class_only', classId: null }),
      );
      expect(r.allowed).toBe(false);
      if (!r.allowed) expect(r.reason).toBe('class_only_plan');
    });

    it('allows class check-in at home branch', async () => {
      const r = await resolver.resolve(
        ctx({
          accessType: 'class_only',
          classId: '00000000-0000-0000-0000-0000000000ff',
        }),
      );
      expect(r.allowed).toBe(true);
    });
  });

  // ── unknown access_type ──────────────────────────────────────────────

  it('fails closed on unknown access_type', async () => {
    const r = await resolver.resolve(ctx({ accessType: 'voodoo' }));
    expect(r.allowed).toBe(false);
    if (!r.allowed) expect(r.reason).toBe('unknown_access_type');
  });
});
