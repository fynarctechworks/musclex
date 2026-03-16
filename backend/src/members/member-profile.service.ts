import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertMemberProfileDto } from './dto/upsert-member-profile.dto';
import { CreateBodyStatsDto } from './dto/create-body-stats.dto';
import { UpdateBodyStatsDto } from './dto/update-body-stats.dto';
import { CreateProgressPhotoDto } from './dto/create-progress-photo.dto';

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
        arms: dto.arms,
        thighs: dto.thighs,
        calves: dto.calves,
        recorded_at: dto.recorded_at ? new Date(dto.recorded_at) : new Date(),
      },
    });
  }

  async updateBodyStats(statsId: string, dto: UpdateBodyStatsDto) {
    const stats = await this.prisma.memberBodyStats.findUnique({ where: { id: statsId } });
    if (!stats) throw new NotFoundException('Body stats record not found');

    return this.prisma.memberBodyStats.update({
      where: { id: statsId },
      data: {
        ...(dto.weight !== undefined && { weight: dto.weight }),
        ...(dto.body_fat !== undefined && { body_fat: dto.body_fat }),
        ...(dto.muscle_mass !== undefined && { muscle_mass: dto.muscle_mass }),
        ...(dto.bmi !== undefined && { bmi: dto.bmi }),
        ...(dto.chest !== undefined && { chest: dto.chest }),
        ...(dto.waist !== undefined && { waist: dto.waist }),
        ...(dto.hips !== undefined && { hips: dto.hips }),
        ...(dto.arms !== undefined && { arms: dto.arms }),
        ...(dto.thighs !== undefined && { thighs: dto.thighs }),
        ...(dto.calves !== undefined && { calves: dto.calves }),
        ...(dto.recorded_at && { recorded_at: new Date(dto.recorded_at) }),
      },
    });
  }

  async deleteBodyStats(statsId: string) {
    const stats = await this.prisma.memberBodyStats.findUnique({ where: { id: statsId } });
    if (!stats) throw new NotFoundException('Body stats record not found');
    await this.prisma.memberBodyStats.delete({ where: { id: statsId } });
    return { deleted: true };
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
        chest: latest.chest && oldest.chest
          ? Number(latest.chest) - Number(oldest.chest)
          : null,
        waist: latest.waist && oldest.waist
          ? Number(latest.waist) - Number(oldest.waist)
          : null,
        hips: latest.hips && oldest.hips
          ? Number(latest.hips) - Number(oldest.hips)
          : null,
        arms: latest.arms && oldest.arms
          ? Number(latest.arms) - Number(oldest.arms)
          : null,
        thighs: latest.thighs && oldest.thighs
          ? Number(latest.thighs) - Number(oldest.thighs)
          : null,
        calves: latest.calves && oldest.calves
          ? Number(latest.calves) - Number(oldest.calves)
          : null,
        period_days: Math.round(
          (latest.recorded_at.getTime() - oldest.recorded_at.getTime()) / 86400000,
        ),
      },
      total_records: count,
    };
  }

  // ── Progress Photos ───────────────────────────────────────────

  async getProgressPhotos(memberId: string) {
    return this.prisma.memberProgressPhoto.findMany({
      where: { member_id: memberId },
      orderBy: { taken_at: 'desc' },
    });
  }

  async createProgressPhoto(memberId: string, dto: CreateProgressPhotoDto) {
    const member = await this.prisma.member.findUnique({ where: { id: memberId } });
    if (!member) throw new NotFoundException('Member not found');

    return this.prisma.memberProgressPhoto.create({
      data: {
        member_id: memberId,
        photo_url: dto.photo_url,
        caption: dto.caption,
        photo_type: dto.photo_type ?? 'progress',
        taken_at: dto.taken_at ? new Date(dto.taken_at) : new Date(),
      },
    });
  }

  async deleteProgressPhoto(photoId: string) {
    const photo = await this.prisma.memberProgressPhoto.findUnique({ where: { id: photoId } });
    if (!photo) throw new NotFoundException('Progress photo not found');
    await this.prisma.memberProgressPhoto.delete({ where: { id: photoId } });
    return { deleted: true };
  }
}
