import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { CronLockService } from '../common/services/cron-lock.service';
import {
  CreateClassSessionDto,
  UpdateClassSessionDto,
  CreateStudioRoomDto,
  UpdateStudioRoomDto,
  CreateRecurringRuleDto,
} from './dto';

@Injectable()
export class SchedulingService {
  private readonly logger = new Logger(SchedulingService.name);

  constructor(
    private prisma: PrismaService,
    private cronLock: CronLockService,
  ) {}

  // ── Conflict Detection ────────────────────────────────────

  private async checkTrainerConflict(
    trainerId: string,
    startTime: Date,
    endTime: Date,
    excludeSessionId?: string,
  ) {
    const where: any = {
      trainer_id: trainerId,
      status: { not: 'cancelled' },
      start_time: { lt: endTime },
      end_time: { gt: startTime },
    };
    if (excludeSessionId) where.id = { not: excludeSessionId };

    const conflict = await this.prisma.classSession.findFirst({ where });
    if (conflict) {
      throw new ConflictException(
        `Trainer is already assigned to "${conflict.name}" from ${conflict.start_time.toISOString()} to ${conflict.end_time.toISOString()}`,
      );
    }
  }

  private async checkStudioConflict(
    studioId: string,
    startTime: Date,
    endTime: Date,
    excludeSessionId?: string,
  ) {
    const where: any = {
      studio_id: studioId,
      status: { not: 'cancelled' },
      start_time: { lt: endTime },
      end_time: { gt: startTime },
    };
    if (excludeSessionId) where.id = { not: excludeSessionId };

    const conflict = await this.prisma.classSession.findFirst({ where });
    if (conflict) {
      throw new ConflictException(
        `Studio is already booked for "${conflict.name}" from ${conflict.start_time.toISOString()} to ${conflict.end_time.toISOString()}`,
      );
    }
  }

  // ── Class Sessions ────────────────────────────────────────

  async createSession(dto: CreateClassSessionDto) {
    const startTime = new Date(dto.start_time);
    const endTime = new Date(startTime.getTime() + dto.duration_minutes * 60000);

    // Validate trainer exists
    const trainer = await this.prisma.staff.findUnique({ where: { id: dto.trainer_id } });
    if (!trainer) throw new NotFoundException('Trainer not found');

    // Check trainer conflict
    await this.checkTrainerConflict(dto.trainer_id, startTime, endTime);

    // Check studio conflict if studio specified
    if (dto.studio_id) {
      const studio = await this.prisma.studioRoom.findUnique({ where: { id: dto.studio_id } });
      if (!studio) throw new NotFoundException('Studio room not found');
      if (!studio.is_active) throw new BadRequestException('Studio room is not active');
      await this.checkStudioConflict(dto.studio_id, startTime, endTime);
    }

    const session = await this.prisma.classSession.create({
      data: {
        template_id: dto.template_id,
        branch_id: dto.branch_id,
        trainer_id: dto.trainer_id,
        studio_id: dto.studio_id,
        name: dto.name,
        category: dto.category || 'other',
        start_time: startTime,
        end_time: endTime,
        capacity: dto.capacity,
      },
      include: {
        branch: { select: { id: true, name: true } },
        trainer: { select: { id: true, full_name: true } },
        studio: { select: { id: true, name: true } },
        template: { select: { id: true, name: true } },
      },
    });

    // Auto-create primary trainer assignment
    await this.prisma.trainerAssignment.create({
      data: {
        trainer_id: dto.trainer_id,
        session_id: session.id,
        role: 'primary',
      },
    });

    return session;
  }

  async findAllSessions(filters?: {
    branch_id?: string;
    trainer_id?: string;
    studio_id?: string;
    template_id?: string;
    category?: string;
    status?: string;
    date_from?: string;
    date_to?: string;
    page?: number;
    limit?: number;
  }) {
    const { page = 1, limit = 50 } = filters || {};
    const skip = (page - 1) * limit;
    const where: any = {};

    if (filters?.branch_id) where.branch_id = filters.branch_id;
    if (filters?.trainer_id) where.trainer_id = filters.trainer_id;
    if (filters?.studio_id) where.studio_id = filters.studio_id;
    if (filters?.template_id) where.template_id = filters.template_id;
    if (filters?.category) where.category = filters.category;
    if (filters?.status) where.status = filters.status;
    if (filters?.date_from || filters?.date_to) {
      where.start_time = {};
      if (filters?.date_from) where.start_time.gte = new Date(filters.date_from);
      if (filters?.date_to) where.start_time.lte = new Date(filters.date_to);
    }

    const [data, total] = await Promise.all([
      this.prisma.classSession.findMany({
        where,
        include: {
          branch: { select: { id: true, name: true } },
          trainer: { select: { id: true, full_name: true } },
          studio: { select: { id: true, name: true } },
          template: { select: { id: true, name: true } },
          _count: { select: { bookings: true, waitlist: true, attendance: true } },
        },
        skip,
        take: limit,
        orderBy: { start_time: 'asc' },
      }),
      this.prisma.classSession.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findOneSession(id: string) {
    const session = await this.prisma.classSession.findUnique({
      where: { id },
      include: {
        branch: { select: { id: true, name: true } },
        trainer: { select: { id: true, full_name: true, specializations: true } },
        studio: { select: { id: true, name: true, capacity: true } },
        template: { select: { id: true, name: true, category: true } },
        bookings: {
          include: {
            member: { select: { id: true, full_name: true, member_code: true, profile_photo_url: true } },
          },
          orderBy: { booked_at: 'asc' },
        },
        waitlist: {
          include: {
            member: { select: { id: true, full_name: true, member_code: true } },
          },
          orderBy: { position: 'asc' },
        },
        assignments: {
          include: {
            trainer: { select: { id: true, full_name: true } },
          },
        },
        attendance: {
          include: {
            member: { select: { id: true, full_name: true, member_code: true } },
          },
        },
      },
    });

    if (!session) throw new NotFoundException('Class session not found');
    return session;
  }

  async updateSession(id: string, dto: UpdateClassSessionDto) {
    const existing = await this.prisma.classSession.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Class session not found');

    const trainerId = dto.trainer_id || existing.trainer_id;
    const startTime = dto.start_time ? new Date(dto.start_time) : existing.start_time;
    const durationMs = dto.duration_minutes
      ? dto.duration_minutes * 60000
      : existing.end_time.getTime() - existing.start_time.getTime();
    const endTime = new Date(startTime.getTime() + durationMs);

    // Check trainer conflict if trainer or time changed
    if (dto.trainer_id || dto.start_time || dto.duration_minutes) {
      await this.checkTrainerConflict(trainerId, startTime, endTime, id);
    }

    // Check studio conflict if studio or time changed
    const studioId = dto.studio_id !== undefined ? dto.studio_id : existing.studio_id;
    if (studioId && (dto.studio_id || dto.start_time || dto.duration_minutes)) {
      await this.checkStudioConflict(studioId, startTime, endTime, id);
    }

    const data: any = {};
    if (dto.trainer_id !== undefined) data.trainer_id = dto.trainer_id;
    if (dto.studio_id !== undefined) data.studio_id = dto.studio_id;
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.start_time || dto.duration_minutes) {
      data.start_time = startTime;
      data.end_time = endTime;
    }
    if (dto.capacity !== undefined) data.capacity = dto.capacity;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.cancellation_reason !== undefined) data.cancellation_reason = dto.cancellation_reason;

    return this.prisma.classSession.update({
      where: { id },
      data,
      include: {
        branch: { select: { id: true, name: true } },
        trainer: { select: { id: true, full_name: true } },
        studio: { select: { id: true, name: true } },
        template: { select: { id: true, name: true } },
      },
    });
  }

  async cancelSession(id: string, reason?: string) {
    const session = await this.prisma.classSession.findUnique({ where: { id } });
    if (!session) throw new NotFoundException('Class session not found');
    if (session.status === 'cancelled') throw new BadRequestException('Session is already cancelled');

    // Cancel all bookings for this session
    await this.prisma.classBooking.updateMany({
      where: { session_id: id, booking_status: 'booked' },
      data: { booking_status: 'cancelled', cancelled_at: new Date(), cancellation_reason: 'Session cancelled' },
    });

    // Remove waitlist entries
    await this.prisma.classWaitlist.deleteMany({ where: { session_id: id } });

    return this.prisma.classSession.update({
      where: { id },
      data: { status: 'cancelled', cancellation_reason: reason, enrolled_count: 0, waitlist_count: 0 },
    });
  }

  // ── Studio Rooms ──────────────────────────────────────────

  async createRoom(dto: CreateStudioRoomDto) {
    return this.prisma.studioRoom.create({
      data: {
        branch_id: dto.branch_id,
        name: dto.name,
        capacity: dto.capacity ?? 30,
        equipment_available: dto.equipment_available || [],
      },
      include: { branch: { select: { id: true, name: true } } },
    });
  }

  async findAllRooms(branchId?: string) {
    const where: any = {};
    if (branchId) where.branch_id = branchId;

    return this.prisma.studioRoom.findMany({
      where,
      include: {
        branch: { select: { id: true, name: true } },
        _count: { select: { sessions: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOneRoom(id: string) {
    const room = await this.prisma.studioRoom.findUnique({
      where: { id },
      include: {
        branch: { select: { id: true, name: true } },
        _count: { select: { sessions: true } },
      },
    });
    if (!room) throw new NotFoundException('Studio room not found');
    return room;
  }

  async updateRoom(id: string, dto: UpdateStudioRoomDto) {
    await this.findOneRoom(id);
    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.capacity !== undefined) data.capacity = dto.capacity;
    if (dto.equipment_available !== undefined) data.equipment_available = dto.equipment_available;
    if (dto.is_active !== undefined) data.is_active = dto.is_active;

    return this.prisma.studioRoom.update({
      where: { id },
      data,
      include: { branch: { select: { id: true, name: true } } },
    });
  }

  // ── Recurring Rules ───────────────────────────────────────

  async createRecurringRule(dto: CreateRecurringRuleDto) {
    const template = await this.prisma.classTemplate.findUnique({ where: { id: dto.template_id } });
    if (!template) throw new NotFoundException('Class template not found');

    return this.prisma.classRecurringRule.create({
      data: {
        template_id: dto.template_id,
        branch_id: dto.branch_id,
        days_of_week: dto.days_of_week,
        start_time: dto.start_time,
        duration_minutes: dto.duration_minutes ?? template.default_duration_minutes,
        trainer_id: dto.trainer_id,
        studio_id: dto.studio_id,
        capacity: dto.capacity ?? template.default_capacity,
        repeat_until: dto.repeat_until ? new Date(dto.repeat_until) : null,
      },
      include: { template: { select: { id: true, name: true, category: true } } },
    });
  }

  async findRecurringRules(templateId?: string, branchId?: string) {
    const where: any = {};
    if (templateId) where.template_id = templateId;
    if (branchId) where.branch_id = branchId;

    return this.prisma.classRecurringRule.findMany({
      where,
      include: { template: { select: { id: true, name: true, category: true } } },
      orderBy: { created_at: 'desc' },
    });
  }

  async deactivateRecurringRule(id: string) {
    const rule = await this.prisma.classRecurringRule.findUnique({ where: { id } });
    if (!rule) throw new NotFoundException('Recurring rule not found');

    return this.prisma.classRecurringRule.update({
      where: { id },
      data: { is_active: false },
    });
  }

  // ── Cron: Generate sessions from recurring rules ──────────

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async generateRecurringSessions() {
    const result = await this.cronLock.withLock('cron:recurring_sessions', async () => {
    this.logger.log('Generating recurring class sessions...');

    const rules = await this.prisma.classRecurringRule.findMany({
      where: {
        is_active: true,
        OR: [
          { repeat_until: null },
          { repeat_until: { gte: new Date() } },
        ],
      },
      include: { template: true },
    });

    let created = 0;
    const daysAhead = 7; // Generate sessions for the next 7 days

    for (const rule of rules) {
      for (let dayOffset = 0; dayOffset < daysAhead; dayOffset++) {
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + dayOffset);
        const dayOfWeek = targetDate.getDay(); // 0=Sun, 1=Mon...

        if (!rule.days_of_week.includes(dayOfWeek)) continue;

        // Parse start_time "HH:mm"
        const [hours, minutes] = rule.start_time.split(':').map(Number);
        const startTime = new Date(targetDate);
        startTime.setHours(hours, minutes, 0, 0);

        // Skip if in the past
        if (startTime < new Date()) continue;

        // Check if session already exists for this slot
        const endTime = new Date(startTime.getTime() + rule.duration_minutes * 60000);
        const existing = await this.prisma.classSession.findFirst({
          where: {
            template_id: rule.template_id,
            branch_id: rule.branch_id,
            start_time: startTime,
          },
        });
        if (existing) continue;

        // Check trainer availability if specified
        if (rule.trainer_id) {
          const trainerConflict = await this.prisma.classSession.findFirst({
            where: {
              trainer_id: rule.trainer_id,
              status: { not: 'cancelled' },
              start_time: { lt: endTime },
              end_time: { gt: startTime },
            },
          });
          if (trainerConflict) continue; // Skip, don't block cron
        }

        // Check studio availability if specified
        if (rule.studio_id) {
          const studioConflict = await this.prisma.classSession.findFirst({
            where: {
              studio_id: rule.studio_id,
              status: { not: 'cancelled' },
              start_time: { lt: endTime },
              end_time: { gt: startTime },
            },
          });
          if (studioConflict) continue;
        }

        try {
          const session = await this.prisma.classSession.create({
            data: {
              template_id: rule.template_id,
              branch_id: rule.branch_id,
              trainer_id: rule.trainer_id || rule.template.created_by_id!,
              studio_id: rule.studio_id,
              name: rule.template.name,
              category: rule.template.category,
              start_time: startTime,
              end_time: endTime,
              capacity: rule.capacity ?? rule.template.default_capacity,
            },
          });

          // Auto-assign trainer
          if (rule.trainer_id) {
            await this.prisma.trainerAssignment.create({
              data: {
                trainer_id: rule.trainer_id,
                session_id: session.id,
                role: 'primary',
              },
            });
          }

          created++;
        } catch (error) {
          this.logger.error(`Failed to create recurring session: ${error.message}`);
        }
      }
    }

    this.logger.log(`Generated ${created} recurring sessions`);
    return { created };
    });
    if (!result) this.logger.debug('Recurring session generation skipped — another instance holds the lock');
    return result ?? { created: 0 };
  }

  // ── Trainer Schedule View ─────────────────────────────────

  async getTrainerSchedule(trainerId: string, dateFrom?: string, dateTo?: string) {
    const where: any = {
      trainer_id: trainerId,
      status: { not: 'cancelled' },
    };
    if (dateFrom || dateTo) {
      where.start_time = {};
      if (dateFrom) where.start_time.gte = new Date(dateFrom);
      if (dateTo) where.start_time.lte = new Date(dateTo);
    }

    return this.prisma.classSession.findMany({
      where,
      include: {
        branch: { select: { id: true, name: true } },
        studio: { select: { id: true, name: true } },
        template: { select: { id: true, name: true } },
        _count: { select: { bookings: true } },
      },
      orderBy: { start_time: 'asc' },
    });
  }

  // ── Room Schedule View ────────────────────────────────────

  async getRoomSchedule(studioId: string, dateFrom?: string, dateTo?: string) {
    const where: any = {
      studio_id: studioId,
      status: { not: 'cancelled' },
    };
    if (dateFrom || dateTo) {
      where.start_time = {};
      if (dateFrom) where.start_time.gte = new Date(dateFrom);
      if (dateTo) where.start_time.lte = new Date(dateTo);
    }

    return this.prisma.classSession.findMany({
      where,
      include: {
        branch: { select: { id: true, name: true } },
        trainer: { select: { id: true, full_name: true } },
        template: { select: { id: true, name: true } },
        _count: { select: { bookings: true } },
      },
      orderBy: { start_time: 'asc' },
    });
  }

  // ── Manual trigger for recurring session generation ───────

  async generateRecurringManually() {
    return this.generateRecurringSessions();
  }
}
