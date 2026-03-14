import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertMemberProfileDto } from './dto/upsert-member-profile.dto';
import { CreateBodyStatsDto } from './dto/create-body-stats.dto';

@Injectable()
export class MemberProfileService {
  constructor(private prisma: PrismaService) {}

  // ── Health Profile ────────────────────────────────────────────

  async getProfile(memberId: string) {
    const profile = await this.prisma.memberProfile.findUnique({
      where: { member_id: memberId },
      include: {
        member: {
          select: { id: true, full_name: true, member_code: true, date_of_birth: true, gender: true },
        },
      },
    });
    if (!profile) throw new NotFoundException('Member profile not found');
    return profile;
  }

  async upsertProfile(memberId: string, dto: UpsertMemberProfileDto) {
    const member = await this.prisma.member.findUnique({ where: { id: memberId } });
    if (!member) throw new NotFoundException('Member not found');

    return this.prisma.memberProfile.upsert({
      where: { member_id: memberId },
      update: {
        ...(dto.height !== undefined && { height: dto.height }),
        ...(dto.weight !== undefined && { weight: dto.weight }),
        ...(dto.body_fat_percentage !== undefined && { body_fat_percentage: dto.body_fat_percentage }),
        ...(dto.fitness_goal !== undefined && { fitness_goal: dto.fitness_goal }),
        ...(dto.medical_conditions !== undefined && { medical_conditions: dto.medical_conditions }),
        ...(dto.allergies !== undefined && { allergies: dto.allergies }),
        ...(dto.emergency_contact !== undefined && { emergency_contact: dto.emergency_contact }),
        ...(dto.emergency_phone !== undefined && { emergency_phone: dto.emergency_phone }),
        ...(dto.blood_group !== undefined && { blood_group: dto.blood_group }),
      },
      create: {
        member_id: memberId,
        height: dto.height,
        weight: dto.weight,
        body_fat_percentage: dto.body_fat_percentage,
        fitness_goal: dto.fitness_goal,
        medical_conditions: dto.medical_conditions ?? [],
        allergies: dto.allergies ?? [],
        emergency_contact: dto.emergency_contact,
        emergency_phone: dto.emergency_phone,
        blood_group: dto.blood_group,
      },
    });
  }

  // ── Body Stats (Progress Tracking) ────────────────────────────

  async getBodyStats(memberId: string, limit = 50) {
    return this.prisma.memberBodyStats.findMany({
      where: { member_id: memberId },
      orderBy: { recorded_at: 'desc' },
      take: limit,
    });
  }

  async createBodyStats(memberId: string, dto: CreateBodyStatsDto) {
    const member = await this.prisma.member.findUnique({ where: { id: memberId } });
    if (!member) throw new NotFoundException('Member not found');

    return this.prisma.memberBodyStats.create({
      data: {
        member_id: memberId,
        weight: dto.weight,
        body_fat: dto.body_fat,
        muscle_mass: dto.muscle_mass,
        bmi: dto.bmi,
        chest: dto.chest,
        waist: dto.waist,
        hips: dto.hips,
        recorded_at: dto.recorded_at ? new Date(dto.recorded_at) : new Date(),
      },
    });
  }

  async getProgressSummary(memberId: string) {
    const [latest, oldest, count] = await Promise.all([
      this.prisma.memberBodyStats.findFirst({
        where: { member_id: memberId },
        orderBy: { recorded_at: 'desc' },
      }),
      this.prisma.memberBodyStats.findFirst({
        where: { member_id: memberId },
        orderBy: { recorded_at: 'asc' },
      }),
      this.prisma.memberBodyStats.count({ where: { member_id: memberId } }),
    ]);

    if (!latest || !oldest || count < 2) {
      return { latest, changes: null, total_records: count };
    }

    return {
      latest,
      changes: {
        weight: latest.weight && oldest.weight
          ? Number(latest.weight) - Number(oldest.weight)
          : null,
        body_fat: latest.body_fat && oldest.body_fat
          ? Number(latest.body_fat) - Number(oldest.body_fat)
          : null,
        muscle_mass: latest.muscle_mass && oldest.muscle_mass
          ? Number(latest.muscle_mass) - Number(oldest.muscle_mass)
          : null,
        bmi: latest.bmi && oldest.bmi
          ? Number(latest.bmi) - Number(oldest.bmi)
          : null,
        period_days: Math.round(
          (latest.recorded_at.getTime() - oldest.recorded_at.getTime()) / 86400000,
        ),
      },
      total_records: count,
    };
  }
}
