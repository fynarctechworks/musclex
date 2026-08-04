import { IclockService } from '../../src/check-ins/biometric/iclock.service';
import { tenantContext } from '../../src/common/tenant-context';

describe('IclockService', () => {
  const GYM = '77777777-7777-7777-7777-777777777777';
  const BRANCH = '88888888-8888-8888-8888-888888888888';

  function makeService(opts: {
    indexed?: boolean;
    enrollment?: { member_id: string } | null;
    memberByCode?: { id: string } | null;
    existingCheckIn?: boolean;
    /** What the access-policy engine decides for this record. */
    policy?:
      | { success: true }
      | { success: false; failure_reason: string; message?: string };
  } = {}) {
    const pub = {
      biometricDeviceIndex: {
        findUnique: jest.fn().mockResolvedValue(
          opts.indexed === false ? null : { device_sn: 'SN123', gym_id: GYM, schema_name: 'studio_x', branch_id: BRANCH },
        ),
      },
    } as any;
    const client = {
      biometricEnrollment: { findFirst: jest.fn().mockResolvedValue(opts.enrollment ?? null) },
      member: {
        findFirst: jest.fn().mockResolvedValue(opts.memberByCode ?? null),
        update: jest.fn().mockResolvedValue({}),
      },
      checkIn: {
        findFirst: jest.fn().mockResolvedValue(opts.existingCheckIn ? { id: 'ci-1' } : null),
        create: jest.fn().mockResolvedValue({ id: 'ci-new' }),
      },
    };
    const tasks = {
      runForGym: jest.fn((_g: string, fn: () => Promise<any>) =>
        tenantContext.run(
          { schemaName: 'studio_x', gymId: GYM, activeBranchId: null, allowedBranchIds: 'ALL', bypassBranchScope: true } as any,
          fn,
        ),
      ),
    } as any;
    // The turnstile now goes through the SAME orchestrator as the front desk,
    // so the policy decision is the thing under test — not a direct DB write.
    const decision = opts.policy ?? { success: true };
    const orchestrator = {
      process: jest.fn().mockResolvedValue(
        decision.success
          ? { success: true, check_in: { id: 'ci-new' }, check_in_event_id: 'ev-1' }
          : {
              success: false,
              failure_reason: decision.failure_reason,
              message: decision.message ?? 'denied',
              severity: 'block',
              trace: [],
            },
      ),
    } as any;
    const service = new IclockService(pub, { client } as any, tasks, orchestrator);
    return { service, client, pub, orchestrator };
  }

  describe('parseAttlog', () => {
    it('parses tab-separated PIN + timestamp lines and skips garbage', () => {
      const service = makeService().service;
      const body = [
        '1001\t2026-07-16 18:42:05\t0\t1',
        '',
        'garbage-line',
        '1002\t2026-07-16 18:43:10\t0\t1\textra',
        '1003\tnot-a-date\t0\t1',
      ].join('\r\n');
      const records = service.parseAttlog(body);
      expect(records).toHaveLength(2);
      expect(records[0].pin).toBe('1001');
      expect(records[0].timestamp.getFullYear()).toBe(2026);
      expect(records[1].pin).toBe('1002');
    });
  });

  describe('ingestAttendance', () => {
    const LINE = '1001\t2026-07-16 18:42:05\t0\t1';

    it('ignores unregistered device serials entirely', async () => {
      const { service, orchestrator } = makeService({ indexed: false });
      const result = await service.ingestAttendance('SN123', LINE);
      expect(result.checked_in).toBe(0);
      expect(orchestrator.process).not.toHaveBeenCalled();
    });

    it('checks in via the PIN→enrollment mapping, through the policy engine', async () => {
      const { service, orchestrator } = makeService({ enrollment: { member_id: 'm-1' } });
      const result = await service.ingestAttendance('SN123', LINE);
      expect(result).toMatchObject({ received: 1, checked_in: 1 });
      expect(orchestrator.process).toHaveBeenCalledWith(
        expect.objectContaining({
          member_id: 'm-1',
          branch_id: BRANCH,
          checkin_method: 'biometric_device',
          source: 'iclock',
        }),
      );
    });

    it('preserves the DEVICE timestamp rather than recording the entry as "now"', async () => {
      // Turnstiles batch their ATTLOG after a network outage, so a delivered
      // record can be hours old — recording it as now would corrupt history.
      const { service, orchestrator } = makeService({ enrollment: { member_id: 'm-1' } });
      await service.ingestAttendance('SN123', LINE);
      const arg = orchestrator.process.mock.calls[0][0];
      expect(arg.occurred_at).toBeInstanceOf(Date);
      expect(arg.occurred_at.getFullYear()).toBe(2026);
      expect(arg.occurred_at.getHours()).toBe(18);
    });

    it('falls back to member_code matching when no enrollment exists', async () => {
      const { service, orchestrator } = makeService({ memberByCode: { id: 'm-2' } });
      const result = await service.ingestAttendance('SN123', LINE);
      expect(result.checked_in).toBe(1);
      expect(orchestrator.process).toHaveBeenCalledWith(
        expect.objectContaining({ member_id: 'm-2' }),
      );
    });

    it('counts unmatched PINs without touching the policy engine', async () => {
      const { service, orchestrator } = makeService({});
      const result = await service.ingestAttendance('SN123', LINE);
      expect(result).toMatchObject({ received: 1, unmatched: 1, checked_in: 0 });
      expect(orchestrator.process).not.toHaveBeenCalled();
    });

    it('reports a missing membership as no_membership', async () => {
      const { service } = makeService({
        enrollment: { member_id: 'm-1' },
        policy: { success: false, failure_reason: 'no_membership' },
      });
      const result = await service.ingestAttendance('SN123', LINE);
      expect(result).toMatchObject({ no_membership: 1, checked_in: 0 });
    });

    it('BLOCKS a policy denial at the turnstile (frozen member) — the bypass is closed', async () => {
      // Previously the device path wrote CheckIn directly, so a frozen member,
      // one outside their branch scope, or one with no class credits walked
      // straight through. Those now deny like every other entrance.
      const { service } = makeService({
        enrollment: { member_id: 'm-1' },
        policy: { success: false, failure_reason: 'membership_frozen', message: 'Membership is frozen' },
      });
      const result = await service.ingestAttendance('SN123', LINE);
      expect(result).toMatchObject({ denied: 1, checked_in: 0, no_membership: 0 });
    });

    it('is idempotent for device retries (same member + exact timestamp)', async () => {
      const { service, orchestrator } = makeService({
        enrollment: { member_id: 'm-1' },
        existingCheckIn: true,
      });
      const result = await service.ingestAttendance('SN123', LINE);
      expect(result).toMatchObject({ duplicates: 1, checked_in: 0 });
      expect(orchestrator.process).not.toHaveBeenCalled();
    });
  });
});
