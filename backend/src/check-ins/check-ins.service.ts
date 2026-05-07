import {
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getTenantGymId } from '../common/tenant-context';
import { DEFAULT_TIMEZONE } from '../common/defaults';

@Injectable()
export class CheckInsService {
  constructor(private prisma: PrismaService) {}

  async create(studioId: string, data: {
    member_id?: string;
    qr_code?: string;
    branch_id?: string;
    checkin_method: string;
    class_id?: string;
  }) {
    // Resolve member from QR code if provided
    let memberId = data.member_id;
    if (data.qr_code && !memberId) {
      const member = await this.prisma.member.findFirst({
        where: { qr_code: data.qr_code, branch_id: data.branch_id }, // TENANT FILTER by branch
      });
      if (!member) throw new BadRequestException('Invalid QR code');
      memberId = member.id;
    }

    if (!memberId) throw new BadRequestException('Member ID or QR code required');

    // Get active membership
    const membership = await this.prisma.memberMembership.findFirst({
      where: { member_id: memberId, status: 'active' },
      include: { plan: true },
      orderBy: { created_at: 'desc' },
    });

    if (!membership) {
      return {
        success: false,
        failure_reason: 'expired',
        message: 'No active membership found',
      };
    }

    // Verify member belongs to this branch (if branch_id provided)
    let member: any;
    if (data.branch_id) {
      member = await this.prisma.member.findFirst({
        where: { id: memberId, branch_id: data.branch_id },
        include: { branch: { select: { name: true } } },
      });
      if (!member) {
        const memberAny = await this.prisma.member.findUnique({ where: { id: memberId }, include: { branch: { select: { name: true } } } });
        if (memberAny) {
          throw new BadRequestException(`Member is registered at "${memberAny.branch?.name ?? 'another branch'}". Please switch to that branch to check them in.`);
        }
        throw new BadRequestException('Member not found');
      }
    } else {
      member = await this.prisma.member.findUnique({
        where: { id: memberId },
        include: { branch: { select: { name: true } } },
      });
      if (!member) throw new BadRequestException('Member not found');
    }

    // Check end_date
    if (membership.end_date && new Date(membership.end_date) < new Date()) {
      await this.prisma.memberMembership.update({
        where: { id: membership.id },
        data: { status: 'expired' },
      });
      await this.prisma.member.update({
        where: { id: memberId },
        data: { status: 'expired' },
      });
      return { success: false, failure_reason: 'expired', message: 'Membership expired' };
    }

    // Check classes remaining for class_pack
    if (
      membership.plan.plan_type === 'class_pack' &&
      membership.classes_remaining !== null &&
      membership.classes_remaining <= 0
    ) {
      return { success: false, failure_reason: 'no_credits', message: 'No classes remaining' };
    }

    // Check branch (skip if branch_id not provided)
    if (data.branch_id && membership.branch_id !== data.branch_id) {
      return { success: false, failure_reason: 'wrong_branch', message: 'Wrong branch' };
    }

    // Wrap duplicate check + check-in creation + credit decrement in a single transaction
    // to prevent race conditions (double check-in from concurrent requests)
    const result = await this.prisma.$transaction(async (tx) => {
      // Use studio timezone for day boundaries instead of server timezone
      // Branch-level timezone not available; default to Asia/Kolkata (configurable per studio)
      const branchTz = DEFAULT_TIMEZONE;
      const nowInTz = new Date(new Date().toLocaleString('en-US', { timeZone: branchTz }));
      const todayStart = new Date(nowInTz);
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(nowInTz);
      todayEnd.setHours(23, 59, 59, 999);

      // Duplicate check INSIDE transaction for atomicity
      const existingToday = await tx.checkIn.findFirst({
        where: {
          member_id: memberId,
          checked_in_at: { gte: todayStart, lte: todayEnd },
          status: 'success',
          ...(data.class_id ? { class_id: data.class_id } : {}),
        },
      });
      if (existingToday && !data.class_id) {
        return { _duplicate: true as const };
      }

      const checkIn = await tx.checkIn.create({
        data: {
          gym_id: getTenantGymId()!,
          member_id: memberId,
          membership_id: membership.id,
          branch_id: data.branch_id ?? membership.branch_id,
          class_id: data.class_id,
          checkin_method: data.checkin_method,
          status: 'success',
        },
        include: {
          member: { select: { full_name: true, member_code: true } },
        },
      });

      // Decrement classes if class_pack — atomically inside transaction
      if (
        membership.plan.plan_type === 'class_pack' &&
        membership.classes_remaining !== null
      ) {
        await tx.memberMembership.update({
          where: { id: membership.id },
          data: { classes_remaining: { decrement: 1 } },
        });
      }

      return checkIn;
    });

    if ('_duplicate' in result) {
      return {
        success: false,
        failure_reason: 'already_checked_in',
        message: 'Member has already checked in today',
      };
    }

    const resultWithMember = result as typeof result & { member?: { full_name: string; member_code: string } | null };
    return {
      success: true,
      check_in: result,
      member_name: resultWithMember.member?.full_name,
      membership_status: membership.status,
    };
  }

  async facialCheckIn(studioId: string, data: { descriptor: number[]; branch_id: string }) {
    const startMs = Date.now();
    const BATCH_SIZE = 200;
    const MATCH_THRESHOLD = 0.5;
    const NEAR_PERFECT_THRESHOLD = 0.2;

    let bestMatch: { id: string; full_name: string } | null = null;
    let bestDistance = Infinity;
    let totalScanned = 0;
    let cursor: string | undefined;

    // Paginated scan — processes in batches to bound memory usage
    // Stops early on near-perfect match
    while (true) {
      const members = await this.prisma.member.findMany({
        where: {
          branch_id: data.branch_id,
          face_descriptor: { isEmpty: false },
          status: { in: ['active', 'expiring_soon'] },
        },
        select: { id: true, full_name: true, face_descriptor: true },
        take: BATCH_SIZE,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        orderBy: { id: 'asc' },
      });

      if (members.length === 0) break;
      cursor = members[members.length - 1].id;
      totalScanned += members.length;

      for (const member of members) {
        if (member.face_descriptor.length !== 128) continue;

        let sum = 0;
        for (let i = 0; i < 128; i++) {
          const diff = data.descriptor[i] - member.face_descriptor[i];
          sum += diff * diff;
          if (sum > bestDistance * bestDistance) break;
        }
        const distance = Math.sqrt(sum);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestMatch = { id: member.id, full_name: member.full_name };
        }
      }

      // Early exit if near-perfect match found or hard limit reached
      if (bestDistance < NEAR_PERFECT_THRESHOLD || totalScanned >= 2000) break;
      if (members.length < BATCH_SIZE) break;
    }

    const elapsedMs = Date.now() - startMs;
    if (elapsedMs > 200) {
      console.warn(`[FacialCheckIn] Slow scan: ${totalScanned} candidates in ${elapsedMs}ms`);
    }

    if (!bestMatch || bestDistance >= MATCH_THRESHOLD) {
      return { success: false, message: 'No matching face found', confidence: 0 };
    }

    const result = await this.create(studioId, {
      member_id: bestMatch.id,
      branch_id: data.branch_id,
      checkin_method: 'facial',
    });

    return {
      ...result,
      matched_member_id: bestMatch.id,
      confidence: Math.max(0, 1 - bestDistance),
    };
  }

  async syncOffline(studioId: string, checkIns: Array<{
    member_id: string;
    branch_id: string;
    checkin_method: string;
    checked_in_at: string;
    class_id?: string;
  }>) {
    let synced = 0;
    let failed = 0;

    for (const ci of checkIns) {
      try {
        const result = await this.create(studioId, {
          member_id: ci.member_id,
          branch_id: ci.branch_id,
          checkin_method: ci.checkin_method,
          class_id: ci.class_id,
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

  async findAll(studioId: string, query: {
    branch_id?: string;
    date_from?: string;
    date_to?: string;
    member_id?: string;
    page?: number;
    limit?: number;
    user_branch_ids?: string[];
  }) {
    const { branch_id, date_from, date_to, member_id, page = 1, limit = 50, user_branch_ids } = query;
    const skip = (page - 1) * limit;
    const where: any = {}; // Tenant isolation handled by SET search_path in TenantMiddleware

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
          member: { select: { full_name: true, member_code: true, profile_photo_url: true } },
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

    // Build 7x24 grid
    const grid: number[][] = Array.from({ length: 7 }, () =>
      Array(24).fill(0),
    );

    for (const ci of checkIns) {
      const d = new Date(ci.checked_in_at);
      grid[d.getDay()][d.getHours()]++;
    }

    return grid;
  }
}
