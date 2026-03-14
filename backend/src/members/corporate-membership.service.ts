import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCorporateAccountDto, AddCorporateMemberDto } from './dto/corporate.dto';

@Injectable()
export class CorporateMembershipService {
  constructor(private prisma: PrismaService) {}

  // ── Corporate Account CRUD ──────────────────────────────────

  async createAccount(dto: CreateCorporateAccountDto) {
    return this.prisma.corporateAccount.create({
      data: {
        organization_id: dto.organization_id || null,
        company_name: dto.company_name,
        contact_person: dto.contact_person,
        contact_email: dto.contact_email,
        contact_phone: dto.contact_phone,
        billing_cycle: dto.billing_cycle || 'monthly',
        discount_percent: dto.discount_percent ?? 0,
        max_members: dto.max_members,
      },
      include: {
        organization: { select: { id: true, name: true } },
        _count: { select: { members: true } },
      },
    });
  }

  async findAllAccounts(filters?: { organization_id?: string; status?: string }) {
    const where: any = {};
    if (filters?.organization_id) where.organization_id = filters.organization_id;
    if (filters?.status) where.status = filters.status;

    return this.prisma.corporateAccount.findMany({
      where,
      include: {
        organization: { select: { id: true, name: true } },
        _count: { select: { members: true } },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async findOneAccount(id: string) {
    const account = await this.prisma.corporateAccount.findUnique({
      where: { id },
      include: {
        organization: { select: { id: true, name: true } },
        members: {
          include: {
            member: { select: { id: true, full_name: true, member_code: true, phone: true, email: true } },
            membership: { select: { id: true, status: true, start_date: true, end_date: true } },
          },
        },
      },
    });
    if (!account) throw new NotFoundException('Corporate account not found');
    return account;
  }

  async updateAccount(id: string, data: Partial<CreateCorporateAccountDto> & { status?: string }) {
    await this.findOneAccount(id);
    const updateData: any = {};
    if (data.company_name !== undefined) updateData.company_name = data.company_name;
    if (data.contact_person !== undefined) updateData.contact_person = data.contact_person;
    if (data.contact_email !== undefined) updateData.contact_email = data.contact_email;
    if (data.contact_phone !== undefined) updateData.contact_phone = data.contact_phone;
    if (data.billing_cycle !== undefined) updateData.billing_cycle = data.billing_cycle;
    if (data.discount_percent !== undefined) updateData.discount_percent = data.discount_percent;
    if (data.max_members !== undefined) updateData.max_members = data.max_members;
    if (data.status !== undefined) updateData.status = data.status;

    return this.prisma.corporateAccount.update({
      where: { id },
      data: updateData,
      include: {
        organization: { select: { id: true, name: true } },
        _count: { select: { members: true } },
      },
    });
  }

  // ── Corporate Members ───────────────────────────────────────

  async addMember(accountId: string, dto: AddCorporateMemberDto) {
    const account = await this.prisma.corporateAccount.findUnique({
      where: { id: accountId },
      include: { _count: { select: { members: true } } },
    });
    if (!account) throw new NotFoundException('Corporate account not found');
    if (account.status !== 'active') {
      throw new BadRequestException('Corporate account is not active');
    }
    if (account.max_members && account._count.members >= account.max_members) {
      throw new BadRequestException(
        `Corporate account has reached the maximum of ${account.max_members} members`,
      );
    }

    const member = await this.prisma.member.findUnique({ where: { id: dto.member_id } });
    if (!member) throw new NotFoundException('Member not found');

    return this.prisma.corporateMember.create({
      data: {
        corporate_account_id: accountId,
        member_id: dto.member_id,
        membership_id: dto.membership_id,
        employee_id: dto.employee_id,
      },
      include: {
        member: { select: { id: true, full_name: true, member_code: true } },
        membership: { select: { id: true, status: true } },
      },
    });
  }

  async removeMember(accountId: string, memberId: string) {
    const link = await this.prisma.corporateMember.findFirst({
      where: { corporate_account_id: accountId, member_id: memberId },
    });
    if (!link) throw new NotFoundException('Corporate member link not found');

    await this.prisma.corporateMember.delete({ where: { id: link.id } });
    return { success: true };
  }

  async getAccountMembers(accountId: string) {
    await this.findOneAccount(accountId);
    return this.prisma.corporateMember.findMany({
      where: { corporate_account_id: accountId },
      include: {
        member: {
          select: { id: true, full_name: true, member_code: true, phone: true, email: true, status: true },
        },
        membership: {
          select: { id: true, status: true, start_date: true, end_date: true, plan: true },
        },
      },
    });
  }
}
