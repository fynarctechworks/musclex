import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ClassesService {
  constructor(private prisma: PrismaService) {}

  async create(data: {
    branch_id: string;
    trainer_id: string;
    substitute_trainer_id?: string;
    name: string;
    category: string;
    room?: string;
    capacity: number;
    duration_minutes: number;
    starts_at: string;
    recurrence_rule?: string;
    recurrence_end_date?: string;
  }) {
    const startsAt = new Date(data.starts_at);
    const endsAt = new Date(startsAt.getTime() + data.duration_minutes * 60000);

    // Check for trainer double-booking
    const conflict = await this.prisma.class.findFirst({
      where: {
        trainer_id: data.trainer_id,
        status: { not: 'cancelled' },
        starts_at: { lt: endsAt },
        AND: {
          starts_at: {
            gte: new Date(startsAt.getTime() - data.duration_minutes * 60000),
          },
        },
      },
    });

    if (conflict) {
      throw new ConflictException(
        `Trainer is already booked for "${conflict.name}" at ${conflict.starts_at.toISOString()}`,
      );
    }

    return this.prisma.class.create({
      data: {
        branch_id: data.branch_id,
        trainer_id: data.trainer_id,
        substitute_trainer_id: data.substitute_trainer_id,
        name: data.name,
        category: data.category,
        room: data.room,
        capacity: data.capacity,
        duration_minutes: data.duration_minutes,
        starts_at: startsAt,
        recurrence_rule: data.recurrence_rule,
        recurrence_end_date: data.recurrence_end_date
          ? new Date(data.recurrence_end_date)
          : undefined,
      },
      include: {
        branch: { select: { id: true, name: true } },
        trainer: { select: { id: true, full_name: true } },
        substitute_trainer: { select: { id: true, full_name: true } },
      },
    });
  }

  async findAll(query: {
    branch_id?: string;
    trainer_id?: string;
    category?: string;
    date_from?: string;
    date_to?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const {
      branch_id,
      trainer_id,
      category,
      date_from,
      date_to,
      status,
      page = 1,
      limit = 50,
    } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (branch_id) where.branch_id = branch_id;
    if (trainer_id) where.trainer_id = trainer_id;
    if (category) where.category = category;
    if (status) where.status = status;
    if (date_from || date_to) {
      where.starts_at = {};
      if (date_from) where.starts_at.gte = new Date(date_from);
      if (date_to) where.starts_at.lte = new Date(date_to);
    }

    const [data, total] = await Promise.all([
      this.prisma.class.findMany({
        where,
        include: {
          branch: { select: { id: true, name: true } },
          trainer: { select: { id: true, full_name: true } },
          substitute_trainer: { select: { id: true, full_name: true } },
          _count: { select: { enrollments: true } },
        },
        skip,
        take: limit,
        orderBy: { starts_at: 'asc' },
      }),
      this.prisma.class.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findOne(id: string) {
    const classItem = await this.prisma.class.findUnique({
      where: { id },
      include: {
        branch: { select: { id: true, name: true } },
        trainer: { select: { id: true, full_name: true, specializations: true } },
        substitute_trainer: { select: { id: true, full_name: true } },
        enrollments: {
          include: {
            member: {
              select: { id: true, full_name: true, member_code: true, profile_photo_url: true },
            },
          },
          orderBy: [
            { status: 'asc' },
            { waitlist_position: 'asc' },
            { enrolled_at: 'asc' },
          ],
        },
      },
    });

    if (!classItem) throw new NotFoundException('Class not found');
    return classItem;
  }

  async update(
    id: string,
    data: {
      name?: string;
      category?: string;
      room?: string;
      capacity?: number;
      duration_minutes?: number;
      starts_at?: string;
      trainer_id?: string;
      substitute_trainer_id?: string;
      recurrence_rule?: string;
      recurrence_end_date?: string;
      status?: string;
    },
  ) {
    const existing = await this.prisma.class.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Class not found');

    // If trainer or time is changing, check for conflicts
    const trainerId = data.trainer_id || existing.trainer_id;
    const startsAt = data.starts_at ? new Date(data.starts_at) : existing.starts_at;
    const duration = data.duration_minutes || existing.duration_minutes;
    const endsAt = new Date(startsAt.getTime() + duration * 60000);

    if (data.trainer_id || data.starts_at || data.duration_minutes) {
      const conflict = await this.prisma.class.findFirst({
        where: {
          id: { not: id },
          trainer_id: trainerId,
          status: { not: 'cancelled' },
          starts_at: { lt: endsAt },
          AND: {
            starts_at: {
              gte: new Date(startsAt.getTime() - duration * 60000),
            },
          },
        },
      });

      if (conflict) {
        throw new ConflictException(
          `Trainer is already booked for "${conflict.name}" at ${conflict.starts_at.toISOString()}`,
        );
      }
    }

    return this.prisma.class.update({
      where: { id },
      data: {
        ...data,
        starts_at: data.starts_at ? new Date(data.starts_at) : undefined,
        recurrence_end_date: data.recurrence_end_date
          ? new Date(data.recurrence_end_date)
          : undefined,
      },
      include: {
        branch: { select: { id: true, name: true } },
        trainer: { select: { id: true, full_name: true } },
        substitute_trainer: { select: { id: true, full_name: true } },
      },
    });
  }

  async enroll(classId: string, memberId: string) {
    // Wrap entire enrollment in a transaction for atomicity
    return this.prisma.$transaction(async (tx) => {
      const classItem = await tx.class.findUnique({
        where: { id: classId },
      });
      if (!classItem) throw new NotFoundException('Class not found');

      // Check if already enrolled
      const existing = await tx.classEnrollment.findFirst({
        where: {
          class_id: classId,
          member_id: memberId,
          status: { in: ['enrolled', 'waitlisted'] },
        },
      });
      if (existing) {
        throw new BadRequestException(
          `Member is already ${existing.status} for this class`,
        );
      }

      // Atomic count inside transaction
      const enrolledCount = await tx.classEnrollment.count({
        where: { class_id: classId, status: 'enrolled' },
      });

      const isFull = enrolledCount >= classItem.capacity;

      if (isFull) {
        // Add to waitlist — atomic position calculation
        const maxPosition = await tx.classEnrollment.aggregate({
          where: { class_id: classId, status: 'waitlisted' },
          _max: { waitlist_position: true },
        });

        const nextPosition = (maxPosition._max.waitlist_position || 0) + 1;

        const enrollment = await tx.classEnrollment.create({
          data: {
            class_id: classId,
            member_id: memberId,
            status: 'waitlisted',
            waitlist_position: nextPosition,
          },
          include: {
            member: { select: { id: true, full_name: true, member_code: true } },
          },
        });

        return {
          ...enrollment,
          message: `Class is full. Added to waitlist at position ${nextPosition}.`,
        };
      }

      const enrollment = await tx.classEnrollment.create({
        data: {
          class_id: classId,
          member_id: memberId,
          status: 'enrolled',
        },
        include: {
          member: { select: { id: true, full_name: true, member_code: true } },
        },
      });

      return { ...enrollment, message: 'Successfully enrolled.' };
    });
  }

  async cancelEnrollment(classId: string, memberId: string) {
    const enrollment = await this.prisma.classEnrollment.findFirst({
      where: {
        class_id: classId,
        member_id: memberId,
        status: { in: ['enrolled', 'waitlisted'] },
      },
    });

    if (!enrollment) {
      throw new NotFoundException('Enrollment not found for this member');
    }

    const wasEnrolled = enrollment.status === 'enrolled';

    await this.prisma.classEnrollment.update({
      where: { id: enrollment.id },
      data: { status: 'cancelled', waitlist_position: null },
    });

    // If the cancelled member was enrolled (not waitlisted), promote the next waitlisted member
    let promoted = null;
    if (wasEnrolled) {
      const nextWaitlisted = await this.prisma.classEnrollment.findFirst({
        where: { class_id: classId, status: 'waitlisted' },
        orderBy: { waitlist_position: 'asc' },
      });

      if (nextWaitlisted) {
        promoted = await this.prisma.classEnrollment.update({
          where: { id: nextWaitlisted.id },
          data: { status: 'enrolled', waitlist_position: null },
          include: {
            member: { select: { id: true, full_name: true, member_code: true } },
          },
        });
      }
    }

    return {
      cancelled: true,
      promoted: promoted
        ? {
            enrollment_id: promoted.id,
            member_name: promoted.member.full_name,
          }
        : null,
    };
  }

  async promoteFromWaitlist(classId: string, enrollmentId: string) {
    const enrollment = await this.prisma.classEnrollment.findFirst({
      where: {
        id: enrollmentId,
        class_id: classId,
        status: 'waitlisted',
      },
    });

    if (!enrollment) {
      throw new NotFoundException('Waitlisted enrollment not found');
    }

    const updated = await this.prisma.classEnrollment.update({
      where: { id: enrollmentId },
      data: { status: 'enrolled', waitlist_position: null },
      include: {
        member: { select: { id: true, full_name: true, member_code: true } },
      },
    });

    return { ...updated, message: 'Promoted from waitlist to enrolled.' };
  }
}
