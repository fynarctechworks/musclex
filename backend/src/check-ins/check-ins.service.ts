import {
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CheckInsService {
  constructor(private prisma: PrismaService) {}

  async create(data: {
    member_id?: string;
    qr_code?: string;
    branch_id: string;
    checkin_method: string;
    class_id?: string;
  }) {
    // Resolve member from QR code if provided
    let memberId = data.member_id;
    if (data.qr_code && !memberId) {
      const member = await this.prisma.member.findUnique({
        where: { qr_code: data.qr_code },
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

    // Check branch
    if (membership.branch_id !== data.branch_id) {
      return { success: false, failure_reason: 'wrong_branch', message: 'Wrong branch' };
    }

    // Wrap check-in creation + credit decrement in a transaction to prevent race conditions
    const result = await this.prisma.$transaction(async (tx) => {
      const checkIn = await tx.checkIn.create({
        data: {
          member_id: memberId,
          membership_id: membership.id,
          branch_id: data.branch_id,
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

    return {
      success: true,
      check_in: result,
      member_name: result.member?.full_name,
      membership_status: membership.status,
    };
  }

  async facialCheckIn(data: { descriptor: number[]; branch_id: string }) {
    // Fetch all members with face descriptors for this branch
    const members = await this.prisma.member.findMany({
      where: {
        branch_id: data.branch_id,
        face_descriptor: { isEmpty: false },
        status: { in: ['active', 'expiring_soon'] },
      },
      select: { id: true, full_name: true, face_descriptor: true },
    });

    // Find best match using Euclidean distance
    let bestMatch: { id: string; full_name: string } | null = null;
    let bestDistance = Infinity;

    for (const member of members) {
      if (member.face_descriptor.length !== 128) continue;
      let sum = 0;
      for (let i = 0; i < 128; i++) {
        const diff = data.descriptor[i] - member.face_descriptor[i];
        sum += diff * diff;
      }
      const distance = Math.sqrt(sum);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestMatch = { id: member.id, full_name: member.full_name };
      }
    }

    if (!bestMatch || bestDistance >= 0.5) {
      return { success: false, message: 'No matching face found', confidence: 0 };
    }

    // Perform check-in
    const result = await this.create({
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

  async syncOffline(checkIns: Array<{
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
        const result = await this.create({
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

  async findAll(query: {
    branch_id?: string;
    date_from?: string;
    date_to?: string;
    member_id?: string;
    page?: number;
    limit?: number;
  }) {
    const { branch_id, date_from, date_to, member_id, page = 1, limit = 50 } = query;
    const skip = (page - 1) * limit;
    const where: any = {};

    if (branch_id) where.branch_id = branch_id;
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
