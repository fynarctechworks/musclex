import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '../common';

export interface TodaysClassDto {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  trainer_name: string | null;
  booked: number;
  capacity: number;
  fill_pct: number;
  status: 'upcoming' | 'in_progress' | 'completed';
}

/**
 * TodaysClassesService — returns a chronological list of today's class
 * sessions for a branch with capacity status. Caps at 8 sessions.
 */
@Injectable()
export class TodaysClassesService {
  private static readonly MAX_SESSIONS = 8;

  constructor(private prisma: PrismaService) {}

  private getBranchScope(user?: JwtPayload, branchId?: string) {
    if (branchId) return { branch_id: branchId };
    if (!user || user.role === 'owner') return {};
    if (user.branch_ids?.length > 0) {
      return { branch_id: { in: user.branch_ids } };
    }
    return {};
  }

  async getTodaysClasses(
    user?: JwtPayload,
    branchId?: string,
  ): Promise<TodaysClassDto[]> {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
      999,
    );
    const branchScope = this.getBranchScope(user, branchId);

    const sessions = await this.prisma.classSession.findMany({
      where: {
        start_time: { gte: startOfDay, lte: endOfDay },
        ...branchScope,
      },
      include: {
        trainer: { select: { id: true, full_name: true } },
        _count: {
          select: {
            bookings: { where: { booking_status: { in: ['booked', 'checked_in'] } } },
          },
        },
      },
      orderBy: { start_time: 'asc' },
      take: TodaysClassesService.MAX_SESSIONS,
    });

    return sessions.map((s) => {
      const start = new Date(s.start_time);
      const end = new Date(s.end_time);
      const booked = s._count?.bookings ?? s.enrolled_count ?? 0;
      const capacity = s.capacity ?? 0;
      const fillPct = capacity > 0 ? Math.round((booked / capacity) * 100) : 0;

      let status: TodaysClassDto['status'] = 'upcoming';
      if (s.status === 'completed' || end.getTime() <= now.getTime()) {
        status = 'completed';
      } else if (
        s.status === 'in_progress' ||
        (start.getTime() <= now.getTime() && end.getTime() > now.getTime())
      ) {
        status = 'in_progress';
      }

      return {
        id: s.id,
        name: s.name,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        trainer_name: s.trainer?.full_name ?? null,
        booked,
        capacity,
        fill_pct: fillPct,
        status,
      };
    });
  }
}
