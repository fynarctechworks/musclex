import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CheckInOrchestrator,
  type OrchestratorInput,
} from './policy/check-in.orchestrator';
import { BiometricRegistry } from './biometric/biometric-registry.service';
import { getTenantGymId } from '../common/tenant-context';

@Injectable()
export class CheckInsService {
  constructor(
    private prisma: PrismaService,
    private orchestrator: CheckInOrchestrator,
    private biometric: BiometricRegistry,
  ) {}

  async create(
    _studioId: string,
    data: {
      member_id?: string;
      qr_code?: string;
      branch_id?: string;
      checkin_method: string;
      class_id?: string;
      client_event_id?: string;
      override_authorized?: boolean;
      override_reason?: string | null;
      override_by_user_id?: string | null;
      source?: string;
      ip_address?: string | null;
      user_agent?: string | null;
    },
  ) {
    const input: OrchestratorInput = {
      member_id: data.member_id,
      qr_code: data.qr_code,
      branch_id: data.branch_id,
      class_id: data.class_id,
      checkin_method: data.checkin_method,
      client_event_id: data.client_event_id,
      override_authorized: data.override_authorized,
      override_reason: data.override_reason ?? null,
      override_by_user_id: data.override_by_user_id ?? null,
      source: data.source,
      ip_address: data.ip_address ?? null,
      user_agent: data.user_agent ?? null,
    };

    const result = await this.orchestrator.process(input);

    if (result.success) {
      return {
        success: true,
        check_in: (result as any).check_in,
        check_in_event_id: result.check_in_event_id,
        member_name: result.member_name,
        member_code: result.member_code,
        membership_status: result.membership_status,
        membership_end_date: result.membership_end_date,
        membership_days_remaining: result.membership_days_remaining,
        membership_plan_name: result.membership_plan_name,
        warnings: result.warnings,
      };
    }

    return {
      success: false,
      failure_reason: result.failure_reason,
      message: result.message,
      severity: result.severity,
      trace: result.trace,
      member_name: result.member_name,
      member_code: result.member_code,
      membership_status: result.membership_status,
      membership_end_date: result.membership_end_date,
      membership_days_remaining: result.membership_days_remaining,
      membership_plan_name: result.membership_plan_name,
    };
  }

  async facialCheckIn(
    studioId: string,
    data: { descriptor: number[]; branch_id: string },
  ) {
    // Route through the biometric registry — selects the default face
    // provider (face-api-pgvector today) but can transparently switch to
    // a cloud / hardware vendor in future without changing this call site.
    const provider = this.biometric.defaultFor('face');
    if (!provider) {
      return {
        success: false,
        message: 'No available face provider',
        confidence: 0,
      };
    }

    const gymId = getTenantGymId() ?? studioId;
    const match = await provider.identify(
      { modality: 'face', descriptor: data.descriptor },
      { gym_id: gymId, branch_id: data.branch_id },
    );

    if (!match) {
      return {
        success: false,
        message: 'No matching face found',
        confidence: 0,
      };
    }

    const result = await this.create(studioId, {
      member_id: match.member_id,
      branch_id: data.branch_id,
      checkin_method: 'facial',
      source: 'kiosk',
    });

    return {
      ...result,
      matched_member_id: match.member_id,
      confidence: match.confidence,
      matcher: match.matcher,
    };
  }

  async syncOffline(
    studioId: string,
    checkIns: Array<{
      member_id: string;
      branch_id: string;
      checkin_method: string;
      checked_in_at: string;
      class_id?: string;
      client_event_id?: string;
    }>,
  ) {
    let synced = 0;
    let failed = 0;

    for (const ci of checkIns) {
      try {
        const result = await this.create(studioId, {
          member_id: ci.member_id,
          branch_id: ci.branch_id,
          checkin_method: ci.checkin_method,
          class_id: ci.class_id,
          client_event_id: ci.client_event_id,
          source: 'offline_sync',
        });
        if ((result as any).success !== false) {
          synced++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }

    return { synced, failed };
  }

  async findAll(
    studioId: string,
    query: {
      branch_id?: string;
      date_from?: string;
      date_to?: string;
      member_id?: string;
      page?: number;
      limit?: number;
      user_branch_ids?: string[];
    },
  ) {
    const {
      branch_id,
      date_from,
      date_to,
      member_id,
      page = 1,
      limit = 50,
      user_branch_ids,
    } = query;
    const skip = (page - 1) * limit;
    const where: any = {};

    if (branch_id) {
      if (user_branch_ids && !user_branch_ids.includes(branch_id)) {
        return { data: [], total: 0, page, limit };
      }
      where.branch_id = branch_id;
    } else if (Array.isArray(user_branch_ids)) {
      if (user_branch_ids.length === 0) {
        return { data: [], total: 0, page, limit };
      }
      where.branch_id = { in: user_branch_ids };
    }
    if (member_id) where.member_id = member_id;
    if (date_from || date_to) {
      where.checked_in_at = {};
      if (date_from) where.checked_in_at.gte = new Date(date_from);
      if (date_to) where.checked_in_at.lte = new Date(date_to);
    }

    const [data, total] = await Promise.all([
      this.prisma.checkIn.findMany({
        where,
        include: {
          member: {
            select: {
              full_name: true,
              member_code: true,
              profile_photo_url: true,
            },
          },
          branch: { select: { name: true } },
        },
        skip,
        take: limit,
        orderBy: { checked_in_at: 'desc' },
      }),
      this.prisma.checkIn.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  // ── Check-out ─────────────────────────────────────────────────────────────
  // Pairs an exit with the member's most recent OPEN check-in (one without a
  // check_out_at) in the same branch. If a member_id is provided, we use that;
  // otherwise the check_in_id pins the visit explicitly. Idempotent: if the
  // visit is already closed, we return the existing row instead of erroring.
  async checkOut(data: {
    member_id?: string;
    check_in_id?: string;
    branch_id: string;
    qr_code?: string;
  }) {
    if (!data.member_id && !data.check_in_id && !data.qr_code) {
      throw new BadRequestException(
        'member_id, check_in_id, or qr_code is required',
      );
    }

    let memberId = data.member_id ?? null;
    if (!memberId && data.qr_code) {
      const m = await this.prisma.member.findFirst({
        where: { qr_code: data.qr_code },
        select: { id: true },
      });
      if (!m) throw new NotFoundException('Member not found for QR code');
      memberId = m.id;
    }

    // Resolve the open visit. If check_in_id supplied, trust it; else find the
    // most recent open success for the member in this branch.
    const open = data.check_in_id
      ? await this.prisma.checkIn.findFirst({
          where: { id: data.check_in_id, branch_id: data.branch_id },
        })
      : await this.prisma.checkIn.findFirst({
          where: {
            member_id: memberId!,
            branch_id: data.branch_id,
            status: 'success',
            check_out_at: null,
          },
          orderBy: { checked_in_at: 'desc' },
        });

    if (!open) {
      // Surface a structured "no open visit" so the kiosk UI can show a friendly
      // "member isn't currently inside" hint rather than a hard error.
      return {
        success: false,
        failure_reason: 'no_open_visit',
        message: 'No open check-in found for this member at this branch',
      };
    }

    if (open.check_out_at) {
      return {
        success: true,
        already_checked_out: true,
        check_in: open,
      };
    }

    const updated = await this.prisma.checkIn.update({
      where: { id: open.id },
      data: { check_out_at: new Date() },
      include: {
        member: {
          select: {
            full_name: true,
            member_code: true,
            profile_photo_url: true,
          },
        },
        branch: { select: { name: true } },
      },
    });

    const durationMs =
      updated.check_out_at!.getTime() - updated.checked_in_at.getTime();
    const durationMinutes = Math.max(0, Math.round(durationMs / 60_000));

    return {
      success: true,
      check_in: updated,
      duration_minutes: durationMinutes,
      member_name: updated.member?.full_name ?? null,
      member_code: updated.member?.member_code ?? null,
    };
  }

  // Returns members currently inside the branch (open check-ins).
  async listOpenVisits(branchId: string, limit = 100) {
    return this.prisma.checkIn.findMany({
      where: {
        branch_id: branchId,
        status: 'success',
        check_out_at: null,
      },
      include: {
        member: {
          select: {
            id: true,
            full_name: true,
            member_code: true,
            profile_photo_url: true,
          },
        },
      },
      orderBy: { checked_in_at: 'desc' },
      take: limit,
    });
  }

  async getHeatmap(branch_id?: string, weeks = 4) {
    const since = new Date();
    since.setDate(since.getDate() - weeks * 7);

    const where: any = {
      checked_in_at: { gte: since },
      status: 'success',
    };
    if (branch_id) where.branch_id = branch_id;

    const checkIns = await this.prisma.checkIn.findMany({
      where,
      select: { checked_in_at: true },
    });

    const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));

    for (const ci of checkIns) {
      const d = new Date(ci.checked_in_at);
      grid[d.getDay()][d.getHours()]++;
    }

    return grid;
  }
}
