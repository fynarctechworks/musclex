import { Injectable, Logger } from '@nestjs/common';
import { PublicPrismaService } from '../../prisma/public-prisma.service';
import { TenantPrisma } from '../../prisma/tenant-prisma.accessor';
import { TenantTaskRunner } from '../../prisma/tenant-task-runner';
import { CheckInOrchestrator } from '../policy/check-in.orchestrator';

export interface AttlogRecord {
  pin: string;
  timestamp: Date;
}

export interface IclockIngestResult {
  received: number;
  checked_in: number;
  unmatched: number;
  no_membership: number;
  duplicates: number;
  /** Blocked by the access-policy engine (freeze, branch scope, credits…). */
  denied: number;
}

/**
 * eSSL / ZKTeco ADMS ("iclock") attendance ingestion. Devices push ATTLOG
 * lines (tab-separated: PIN, timestamp, status, verify-mode, ...) to
 * POST /iclock/cdata?SN=<serial>. The serial resolves the tenant via the
 * public biometric_device_index (written on admin registration), then each
 * PIN resolves to a member via BiometricEnrollment(provider='iclock',
 * template_ref=PIN) with a member_code fallback, and a CheckIn row is created
 * against the member's active membership.
 *
 * Idempotency: devices retry until they get OK, so a (member, exact
 * device-timestamp) match is treated as a duplicate and skipped.
 */
@Injectable()
export class IclockService {
  private readonly logger = new Logger(IclockService.name);

  constructor(
    private readonly pub: PublicPrismaService,
    private readonly tenant: TenantPrisma,
    private readonly tasks: TenantTaskRunner,
    private readonly orchestrator: CheckInOrchestrator,
  ) {}

  /** Parse an ATTLOG body: one record per line, tab-separated, PIN then timestamp. */
  parseAttlog(body: string): AttlogRecord[] {
    const records: AttlogRecord[] = [];
    for (const line of body.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const cols = trimmed.split('\t');
      if (cols.length < 2) continue;
      const pin = cols[0].trim();
      // Device format: "2026-07-16 18:42:05" in the device's local time.
      const timestamp = new Date(cols[1].trim().replace(' ', 'T'));
      if (!pin || Number.isNaN(timestamp.getTime())) continue;
      records.push({ pin, timestamp });
    }
    return records;
  }

  async resolveDevice(serial: string): Promise<{ gymId: string; branchId: string } | null> {
    if (!serial) return null;
    const index = await this.pub.biometricDeviceIndex.findUnique({
      where: { device_sn: serial },
    });
    if (!index) {
      this.logger.warn(`iclock: unregistered device SN=${serial} — ignored`);
      return null;
    }
    return { gymId: index.gym_id, branchId: index.branch_id };
  }

  async ingestAttendance(serial: string, body: string): Promise<IclockIngestResult> {
    const result: IclockIngestResult = {
      received: 0,
      checked_in: 0,
      unmatched: 0,
      no_membership: 0,
      duplicates: 0,
      denied: 0,
    };

    const device = await this.resolveDevice(serial);
    const records = this.parseAttlog(body);
    result.received = records.length;
    if (!device || records.length === 0) return result;

    await this.tasks.runForGym(device.gymId, async () => {
      for (const record of records) {
        try {
          const outcome = await this.processRecord(device.branchId, record);
          result[outcome]++;
        } catch (e) {
          this.logger.warn(`iclock: record pin=${record.pin} failed: ${(e as Error).message}`);
        }
      }
    });

    this.logger.log(
      `iclock SN=${serial}: ${result.checked_in}/${result.received} checked in ` +
        `(${result.unmatched} unmatched, ${result.no_membership} no membership, ${result.denied} denied, ${result.duplicates} dup)`,
    );
    return result;
  }

  private async processRecord(
    branchId: string,
    record: AttlogRecord,
  ): Promise<'checked_in' | 'unmatched' | 'no_membership' | 'duplicates' | 'denied'> {
    // PIN → member: explicit device mapping first, member_code fallback.
    const enrollment = await this.tenant.client.biometricEnrollment.findFirst({
      where: { provider: 'iclock', template_ref: record.pin, revoked_at: null },
      select: { member_id: true },
    });
    let memberId = enrollment?.member_id ?? null;
    if (!memberId) {
      const byCode = await this.tenant.client.member.findFirst({
        where: { member_code: record.pin },
        select: { id: true },
      });
      memberId = byCode?.id ?? null;
    }
    if (!memberId) return 'unmatched';

    // Device retries deliveries — exact (member, timestamp) is a duplicate.
    const existing = await this.tenant.client.checkIn.findFirst({
      where: { member_id: memberId, checked_in_at: record.timestamp },
      select: { id: true },
    });
    if (existing) return 'duplicates';

    // Route through the orchestrator instead of writing CheckIn directly.
    //
    // The direct write bypassed the ENTIRE access-policy engine: a frozen
    // member, a member outside their branch's access scope, one with no class
    // credits left, or one already inside another branch could all walk through
    // the turnstile. It also skipped the CheckInEvent audit row, the rule
    // trace, the WebSocket broadcast and the class-credit decrement — so the
    // hardware door was the one entrance with no rules on it.
    //
    // `client_event_id` gives the orchestrator its own idempotency key on top
    // of the timestamp dedupe above, since ADMS re-delivers aggressively.
    const result = await this.orchestrator.process({
      member_id: memberId,
      branch_id: branchId,
      checkin_method: 'biometric_device',
      source: 'iclock',
      occurred_at: record.timestamp,
      client_event_id: `iclock:${memberId}:${record.timestamp.toISOString()}`,
    });

    if (result.success) return 'checked_in';

    // Policy denial. `no_membership` keeps its own bucket for the operator
    // summary the device logs; everything else is a policy block.
    this.logger.log(
      `iclock denial for member ${memberId}: ${result.failure_reason} — ${result.message}`,
    );
    return result.failure_reason === 'no_membership' ||
      result.failure_reason === 'membership_expired'
      ? 'no_membership'
      : 'denied';
  }
}
