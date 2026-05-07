import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getTenantGymId } from '../common/tenant-context';
import { AssignClientDto } from './dto/assign-client.dto';
import { CreateTrainerSessionDto } from './dto/create-trainer-session.dto';
import { UpdateTrainerSessionDto } from './dto/update-trainer-session.dto';
import { PayrollService } from './payroll.service';

@Injectable()
export class TrainerService {
  constructor(
    private prisma: PrismaService,
    private payrollService: PayrollService,
  ) {}

  // ── Client Assignment ─────────────────────────────────────────

  async assignClient(studioId: string, dto: AssignClientDto) {
    // Verify trainer exists, IS a trainer, and belongs to studio
    const trainer = await this.prisma.staff.findFirst({
      where: { id: dto.trainer_id },
    });
    if (!trainer) throw new NotFoundException('Trainer not found');
    if (trainer.role !== 'trainer') {
      throw new BadRequestException('Staff member is not a trainer');
    }

    // Verify member exists and belongs to studio
    const member = await this.prisma.member.findFirst({
      where: { id: dto.member_id },
    });
    if (!member) throw new NotFoundException('Member not found');

    // Check for existing assignment
    const existing = await this.prisma.trainerClient.findUnique({
      where: {
        trainer_id_member_id: {
          trainer_id: dto.trainer_id,
          member_id: dto.member_id,
        },
      },
    });
    if (existing) throw new ConflictException('Client already assigned to this trainer');

    return this.prisma.trainerClient.create({
      data: {
        gym_id: getTenantGymId()!,
        trainer_id: dto.trainer_id,
        member_id: dto.member_id,
        status: dto.status ?? 'active',
        notes: dto.notes,
      },
      include: {
        trainer: { select: { id: true, full_name: true } },
        member: { select: { id: true, full_name: true, phone: true } },
      },
    });
  }

  async getTrainerClients(studioId: string, trainerId: string, status?: string) {
    // Verify trainer belongs to studio
    const trainer = await this.prisma.staff.findFirst({
      where: { id: trainerId },
    });
    if (!trainer) throw new NotFoundException('Trainer not found');

    const where: any = { trainer_id: trainerId };
    if (status) where.status = status;

    return this.prisma.trainerClient.findMany({
      where,
      orderBy: { assigned_date: 'desc' },
      include: {
        member: {
          select: {
            id: true,
            full_name: true,
            phone: true,
            email: true,
            status: true,
            profile_photo_url: true,
          },
        },
      },
    });
  }

  async updateClientAssignment(studioId: string, id: string, status: string) {
    // Get assignment and verify it belongs to this studio's trainer
    const assignment = await this.prisma.trainerClient.findUnique({ where: { id } });
    if (!assignment) throw new NotFoundException('Client assignment not found');

    // Verify trainer belongs to studio
    const trainer = await this.prisma.staff.findFirst({
      where: { id: assignment.trainer_id },
    });
    if (!trainer) throw new ForbiddenException('Access denied to this assignment');

    return this.prisma.trainerClient.update({
      where: { id },
      data: { status },
    });
  }

  // ── Trainer Sessions ──────────────────────────────────────────

  async createSession(studioId: string, dto: CreateTrainerSessionDto) {
    // Verify trainer belongs to studio
    const trainer = await this.prisma.staff.findFirst({
      where: { id: dto.trainer_id },
    });
    if (!trainer) throw new NotFoundException('Trainer not found');

    // Verify member belongs to studio
    const member = await this.prisma.member.findFirst({
      where: { id: dto.member_id },
    });
    if (!member) throw new NotFoundException('Member not found');

    // Check for scheduling conflicts
    const sessionDate = new Date(dto.session_date);
    const sessionEnd = new Date(
      sessionDate.getTime() + dto.session_duration * 60 * 1000,
    );

    const conflict = await this.prisma.trainerSession.findFirst({
      where: {
        trainer_id: dto.trainer_id,
        status: { in: ['scheduled', 'in_progress'] },
        session_date: { lt: sessionEnd },
        AND: {
          session_date: {
            gte: new Date(
              sessionDate.getTime() - dto.session_duration * 60 * 1000,
            ),
          },
        },
      },
    });
    if (conflict) {
      throw new ConflictException('Trainer has a scheduling conflict for this time slot');
    }

    return this.prisma.trainerSession.create({
      data: {
        gym_id: getTenantGymId()!,
        trainer_id: dto.trainer_id,
        member_id: dto.member_id,
        branch_id: dto.branch_id,
        session_date: sessionDate,
        session_duration: dto.session_duration,
        session_type: dto.session_type ?? 'personal_training',
        notes: dto.notes,
      },
      include: {
        trainer: { select: { id: true, full_name: true } },
        member: { select: { id: true, full_name: true } },
        branch: { select: { id: true, name: true } },
      },
    });
  }

  async getSessions(studioId: string, filters: {
    trainer_id?: string;
    member_id?: string;
    branch_id?: string;
    status?: string;
    start_date?: string;
    end_date?: string;
    page?: number;
    limit?: number;
  }) {
    const { trainer_id, member_id, branch_id, status, start_date, end_date, page = 1, limit = 50 } = filters;
    const skip = (page - 1) * limit;
    const where: any = {};

    if (trainer_id) {
      // Verify trainer belongs to studio
      const trainer = await this.prisma.staff.findFirst({
        where: { id: trainer_id },
      });
      if (!trainer) throw new NotFoundException('Trainer not found');
      where.trainer_id = trainer_id;
    }
    if (member_id) where.member_id = member_id;
    if (branch_id) where.branch_id = branch_id;
    if (status) where.status = status;
    if (start_date || end_date) {
      where.session_date = {};
      if (start_date) where.session_date.gte = new Date(start_date);
      if (end_date) where.session_date.lte = new Date(end_date);
    }

    const [data, total] = await Promise.all([
      this.prisma.trainerSession.findMany({
        where,
        skip,
        take: limit,
        orderBy: { session_date: 'desc' },
        include: {
          trainer: { select: { id: true, full_name: true } },
          member: { select: { id: true, full_name: true } },
          branch: { select: { id: true, name: true } },
          revenue: true,
        },
      }),
      this.prisma.trainerSession.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async updateSession(studioId: string, id: string, dto: UpdateTrainerSessionDto) {
    const session = await this.prisma.trainerSession.findUnique({
      where: { id },
      include: { revenue: true, trainer: { select: { organization_id: true } } },
    });
    if (!session) throw new NotFoundException('Trainer session not found');

    // Verify session belongs to this studio
    if (session.trainer.organization_id !== studioId) {
      throw new ForbiddenException('Access denied to this session');
    }

    const updated = await this.prisma.trainerSession.update({
      where: { id },
      data: dto,
      include: {
        trainer: { select: { id: true, full_name: true } },
        member: { select: { id: true, full_name: true } },
        branch: { select: { id: true, name: true } },
      },
    });

    // Auto-record revenue when session is completed (if not already recorded)
    if (dto.status === 'completed' && !session.revenue) {
      const config = await this.prisma.payrollConfig.findUnique({
        where: { staff_id: session.trainer_id },
      });
      const commissionPct = Number(config?.commission_percentage ?? 0);
      // Default session rate; in production this would come from pricing config
      const sessionRate = 500;
      const commissionAmount = (sessionRate * commissionPct) / 100;

      await this.payrollService.recordRevenue({
        trainer_id: session.trainer_id,
        branch_id: session.branch_id,
        session_id: session.id,
        revenue_amount: sessionRate,
        commission_amount: commissionAmount,
      });
    }

    return updated;
  }

  // ── Performance Analytics ─────────────────────────────────────

  async getTrainerPerformance(filters?: {
    branch_id?: string;
    organization_id?: string;
  }) {
    const trainerWhere: any = { role: 'trainer', is_active: true };
    if (filters?.branch_id) {
      trainerWhere.OR = [
        { branch_id: filters.branch_id },
        { branch_ids: { has: filters.branch_id } },
      ];
    }
    if (filters?.organization_id) {
      trainerWhere.organization_id = filters.organization_id;
    }

    const trainers = await this.prisma.staff.findMany({
      where: trainerWhere,
      include: {
        profile: { select: { rating: true, total_ratings: true } },
        trainer_clients: { where: { status: 'active' } },
        trainer_sessions: {
          where: {
            session_date: {
              gte: new Date(new Date().setDate(new Date().getDate() - 30)),
            },
          },
        },
        trainer_revenue: {
          where: {
            created_at: {
              gte: new Date(new Date().setDate(new Date().getDate() - 30)),
            },
          },
        },
        classes_as_trainer: {
          include: { enrollments: true },
        },
      },
    });

    return trainers.map((trainer) => {
      const activeClients = trainer.trainer_clients.length;
      const sessionsLast30Days = trainer.trainer_sessions.length;
      const completedSessions = trainer.trainer_sessions.filter(
        (s) => s.status === 'completed',
      ).length;

      const totalRevenue = trainer.trainer_revenue.reduce(
        (sum, r) => sum + Number(r.revenue_amount),
        0,
      );
      const totalCommission = trainer.trainer_revenue.reduce(
        (sum, r) => sum + Number(r.commission_amount),
        0,
      );

      const classes = trainer.classes_as_trainer;
      const classesCount = classes.length;
      const totalOccupancy = classes.reduce((sum, cls) => {
        const enrolled = cls.enrollments.filter(
          (e) => e.status === 'enrolled' || e.status === 'attended',
        ).length;
        return sum + (cls.capacity > 0 ? (enrolled / cls.capacity) * 100 : 0);
      }, 0);
      const avgOccupancy = classesCount > 0
        ? Math.round(totalOccupancy / classesCount)
        : 0;

      const utilizationRate = sessionsLast30Days > 0
        ? Math.round((completedSessions / sessionsLast30Days) * 100)
        : 0;

      const { salary, payroll_config, trainer_clients, trainer_sessions, trainer_revenue, classes_as_trainer, ...trainerData } = trainer as any;

      return {
        ...trainerData,
        metrics: {
          active_clients: activeClients,
          sessions_last_30_days: sessionsLast30Days,
          completed_sessions: completedSessions,
          revenue_last_30_days: totalRevenue,
          commission_last_30_days: totalCommission,
          classes_count: classesCount,
          avg_class_occupancy: avgOccupancy,
          utilization_rate: utilizationRate,
        },
      };
    });
  }

  async getTrainerDashboard(studioId: string, trainerId: string) {
    const trainer = await this.prisma.staff.findFirst({
      where: { id: trainerId },
      include: { profile: true },
    });
    if (!trainer) throw new NotFoundException('Trainer not found');

    const now = new Date();
    const thirtyDaysAgo = new Date(now.setDate(now.getDate() - 30));

    const [
      activeClients,
      upcomingSessions,
      completedSessionsCount,
      revenueData,
    ] = await Promise.all([
      this.prisma.trainerClient.count({
        where: { trainer_id: trainerId, status: 'active' },
      }),
      this.prisma.trainerSession.findMany({
        where: {
          trainer_id: trainerId,
          status: 'scheduled',
          session_date: { gte: new Date() },
        },
        orderBy: { session_date: 'asc' },
        take: 10,
        include: {
          member: { select: { id: true, full_name: true, profile_photo_url: true } },
          branch: { select: { id: true, name: true } },
        },
      }),
      this.prisma.trainerSession.count({
        where: {
          trainer_id: trainerId,
          status: 'completed',
          session_date: { gte: thirtyDaysAgo },
        },
      }),
      this.prisma.trainerRevenue.aggregate({
        where: {
          trainer_id: trainerId,
          created_at: { gte: thirtyDaysAgo },
        },
        _sum: { revenue_amount: true, commission_amount: true },
      }),
    ]);

    return {
      trainer: {
        id: trainer.id,
        full_name: trainer.full_name,
        rating: trainer.profile?.rating,
        total_ratings: trainer.profile?.total_ratings,
      },
      active_clients: activeClients,
      upcoming_sessions: upcomingSessions,
      completed_sessions_30d: completedSessionsCount,
      revenue_30d: Number(revenueData._sum.revenue_amount ?? 0),
      commission_30d: Number(revenueData._sum.commission_amount ?? 0),
    };
  }

  // ── Performance Snapshots ─────────────────────────────────────

  async recordPerformanceSnapshot(studioId: string, trainerId: string, periodStart: string, periodEnd: string) {
    const trainer = await this.prisma.staff.findFirst({
      where: { id: trainerId },
      include: { profile: true },
    });
    if (!trainer) throw new NotFoundException('Trainer not found');

    const start = new Date(periodStart);
    const end = new Date(periodEnd);

    const [sessions, clients, revenueAgg] = await Promise.all([
      this.prisma.trainerSession.findMany({
        where: {
          trainer_id: trainerId,
          session_date: { gte: start, lte: end },
        },
      }),
      this.prisma.trainerClient.count({
        where: { trainer_id: trainerId, status: 'active' },
      }),
      this.prisma.trainerRevenue.aggregate({
        where: {
          trainer_id: trainerId,
          created_at: { gte: start, lte: end },
        },
        _sum: { revenue_amount: true, commission_amount: true },
      }),
    ]);

    const totalSessions = sessions.length;
    const completedSessions = sessions.filter((s) => s.status === 'completed').length;
    const cancelledSessions = sessions.filter((s) => s.status === 'cancelled').length;
    const utilizationRate = totalSessions > 0
      ? Math.round((completedSessions / totalSessions) * 100)
      : 0;

    return this.prisma.trainerPerformanceRecord.create({
      data: {
        gym_id: getTenantGymId()!,
        trainer_id: trainerId,
        total_sessions: totalSessions,
        completed_sessions: completedSessions,
        cancelled_sessions: cancelledSessions,
        active_clients: clients,
        member_ratings: Number(trainer.profile?.rating ?? 0),
        revenue_generated: Number(revenueAgg._sum.revenue_amount ?? 0),
        commission_earned: Number(revenueAgg._sum.commission_amount ?? 0),
        utilization_rate: utilizationRate,
        period_start: start,
        period_end: end,
      },
      include: {
        trainer: { select: { id: true, full_name: true } },
      },
    });
  }

  async getPerformanceHistory(studioId: string, trainerId: string, filters?: {
    start_date?: string;
    end_date?: string;
  }) {
    // Verify trainer belongs to studio
    const trainer = await this.prisma.staff.findFirst({
      where: { id: trainerId },
    });
    if (!trainer) throw new NotFoundException('Trainer not found');

    const where: any = { trainer_id: trainerId };
    if (filters?.start_date || filters?.end_date) {
      where.period_start = {};
      if (filters.start_date) where.period_start.gte = new Date(filters.start_date);
      if (filters.end_date) where.period_start.lte = new Date(filters.end_date);
    }

    return this.prisma.trainerPerformanceRecord.findMany({
      where,
      orderBy: { period_start: 'desc' },
      include: {
        trainer: { select: { id: true, full_name: true } },
      },
    });
  }
}
