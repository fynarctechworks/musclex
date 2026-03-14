import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFamilyMembershipDto } from './dto/create-family-membership.dto';
import { AddFamilyMemberDto } from './dto/add-family-member.dto';

@Injectable()
export class FamilyMembershipService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateFamilyMembershipDto) {
    const [member, plan] = await Promise.all([
      this.prisma.member.findUnique({ where: { id: dto.primary_member_id } }),
      this.prisma.membershipPlan.findUnique({ where: { id: dto.plan_id } }),
    ]);
    if (!member) throw new NotFoundException('Primary member not found');
    if (!plan) throw new BadRequestException('Invalid plan');
    if (plan.plan_type !== 'family') {
      throw new BadRequestException('Plan must be of type "family"');
    }

    // Create the underlying membership
    const startDate = new Date();
    const endDate = plan.duration_days
      ? new Date(startDate.getTime() + plan.duration_days * 86400000)
      : null;

    const membership = await this.prisma.memberMembership.create({
      data: {
        member_id: dto.primary_member_id,
        plan_id: dto.plan_id,
        branch_id: dto.branch_id,
        start_date: startDate,
        end_date: endDate,
        status: 'active',
      },
    });

    const familyMembership = await this.prisma.familyMembership.create({
      data: {
        primary_member_id: dto.primary_member_id,
        membership_id: membership.id,
        plan_id: dto.plan_id,
        max_members: dto.max_members ?? 4,
      },
      include: {
        primary_member: { select: { id: true, full_name: true, member_code: true } },
        plan: true,
        members: { include: { member: { select: { id: true, full_name: true } } } },
      },
    });

    return familyMembership;
  }

  async findOne(id: string) {
    const family = await this.prisma.familyMembership.findUnique({
      where: { id },
      include: {
        primary_member: { select: { id: true, full_name: true, member_code: true, phone: true } },
        membership: { include: { plan: true } },
        plan: true,
        members: {
          include: { member: { select: { id: true, full_name: true, member_code: true, phone: true } } },
        },
      },
    });
    if (!family) throw new NotFoundException('Family membership not found');
    return family;
  }

  async findByMember(memberId: string) {
    return this.prisma.familyMembership.findMany({
      where: {
        OR: [
          { primary_member_id: memberId },
          { members: { some: { member_id: memberId } } },
        ],
      },
      include: {
        primary_member: { select: { id: true, full_name: true, member_code: true } },
        plan: true,
        members: { include: { member: { select: { id: true, full_name: true } } } },
        membership: { select: { id: true, status: true, end_date: true } },
      },
    });
  }

  async addMember(familyMembershipId: string, dto: AddFamilyMemberDto) {
    const family = await this.prisma.familyMembership.findUnique({
      where: { id: familyMembershipId },
      include: { members: true },
    });
    if (!family) throw new NotFoundException('Family membership not found');

    // Check max members (primary + linked)
    if (family.members.length + 1 >= family.max_members) {
      throw new BadRequestException(
        `Family membership has reached the maximum of ${family.max_members} members`,
      );
    }

    const member = await this.prisma.member.findUnique({ where: { id: dto.member_id } });
    if (!member) throw new NotFoundException('Member not found');

    return this.prisma.familyMember.create({
      data: {
        family_membership_id: familyMembershipId,
        member_id: dto.member_id,
        relation: dto.relation,
      },
      include: { member: { select: { id: true, full_name: true, member_code: true } } },
    });
  }

  async removeMember(familyMembershipId: string, memberId: string) {
    const link = await this.prisma.familyMember.findFirst({
      where: { family_membership_id: familyMembershipId, member_id: memberId },
    });
    if (!link) throw new NotFoundException('Family member link not found');

    await this.prisma.familyMember.delete({ where: { id: link.id } });
    return { success: true };
  }
}
