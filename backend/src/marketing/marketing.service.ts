import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { TenantPrisma } from '../prisma/tenant-prisma.accessor';
import { getTenantGymId } from '../common/tenant-context';

@Injectable()
export class MarketingService {
  constructor(private readonly tenant: TenantPrisma) {}

  async findAll(query: {
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const { status, search, page = 1, limit = 50 } = query;
    const skip = (page - 1) * limit;
    const where: any = {};
    if (status) where.status = status;
    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    const [data, total] = await Promise.all([
      this.tenant.client.campaign.findMany({ where, skip, take: limit, orderBy: { created_at: 'desc' } }),
      this.tenant.client.campaign.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async findOne(id: string) {
    const campaign = await this.tenant.client.campaign.findUnique({
      where: { id },
      include: {
        created_by: { select: { id: true, full_name: true } },
        _count: { select: { audience: true } },
      },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    return campaign;
  }

  async create(data: {
    name: string;
    segment: string;
    segment_filters?: any;
    channels: string[];
    message_template: string;
    scheduled_at?: string;
    created_by_staff_id: string;
  }) {
    return this.tenant.client.campaign.create({
      data: {
        gym_id: getTenantGymId()!,
        name: data.name,
        segment: data.segment,
        segment_filters: data.segment_filters || {},
        channels: data.channels,
        message_template: data.message_template,
        scheduled_at: data.scheduled_at ? new Date(data.scheduled_at) : null,
        created_by_staff_id: data.created_by_staff_id,
        status: 'draft',
      },
    });
  }

  async update(id: string, data: any) {
    const existing = await this.findOne(id);
    if (existing.status === 'sent') throw new BadRequestException('Cannot update a sent campaign');
    return this.tenant.client.campaign.update({ where: { id }, data });
  }

  async remove(id: string) {
    const existing = await this.findOne(id);
    if (existing.status === 'sending' || existing.status === 'sent') {
      throw new BadRequestException('Cannot delete active campaign');
    }
    await this.tenant.client.campaign.delete({ where: { id } });
    return { success: true };
  }

  async sendCampaign(id: string) {
    const campaign = await this.findOne(id);
    if (campaign.status === 'sent') throw new BadRequestException('Already sent');

    // Build audience from segment
    const memberIds = await this.getSegmentMemberIds(campaign.segment, campaign.segment_filters as any);
    if (memberIds.length === 0) throw new BadRequestException('No members match the campaign segment');

    return this.tenant.client.$transaction(async (tx) => {
      // Create audience records
      await tx.campaignAudience.createMany({
        data: memberIds.map((member_id) => ({
          gym_id: getTenantGymId()!,
          campaign_id: id,
          member_id,
          status: 'sent',
          sent_at: new Date(),
        })),
        skipDuplicates: true,
      });

      return tx.campaign.update({
        where: { id },
        data: { status: 'sending', sent_count: memberIds.length },
      });
    });
  }

  async getCampaignAudience(campaignId: string, filters: {
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const { status, page = 1, limit = 50 } = filters;
    const skip = (page - 1) * limit;
    const where: any = { campaign_id: campaignId };
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      this.tenant.client.campaignAudience.findMany({
        where,
        skip,
        take: limit,
        include: { member: { select: { id: true, full_name: true, email: true, phone: true } } },
      }),
      this.tenant.client.campaignAudience.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async updateAudienceStatus(campaignId: string, memberId: string, status: string) {
    const record = await this.tenant.client.campaignAudience.findUnique({
      where: { campaign_id_member_id: { campaign_id: campaignId, member_id: memberId } },
    });
    if (!record) throw new NotFoundException('Audience record not found');

    const data: any = { status };
    if (status === 'opened') data.opened_at = new Date();
    if (status === 'clicked') data.clicked_at = new Date();

    return this.tenant.client.campaignAudience.update({
      where: { campaign_id_member_id: { campaign_id: campaignId, member_id: memberId } },
      data,
    });
  }

  async getCampaignAnalytics(campaignId: string) {
    const campaign = await this.findOne(campaignId);

    const audienceStats = await this.tenant.client.campaignAudience.groupBy({
      by: ['status'],
      where: { campaign_id: campaignId },
      _count: { id: true },
    });

    const statsMap: Record<string, number> = {};
    let totalAudience = 0;
    for (const s of audienceStats) {
      statsMap[s.status] = s._count.id;
      totalAudience += s._count.id;
    }

    const sent = statsMap['sent'] ?? 0;
    const delivered = statsMap['delivered'] ?? 0;
    const opened = statsMap['opened'] ?? 0;
    const clicked = statsMap['clicked'] ?? 0;
    const bounced = statsMap['bounced'] ?? 0;

    return {
      campaign_id: campaignId,
      campaign_name: campaign.name,
      total_audience: totalAudience,
      sent,
      delivered,
      opened,
      clicked,
      bounced,
      open_rate: totalAudience > 0 ? Math.round((opened / totalAudience) * 10000) / 100 : 0,
      click_rate: totalAudience > 0 ? Math.round((clicked / totalAudience) * 10000) / 100 : 0,
      bounce_rate: totalAudience > 0 ? Math.round((bounced / totalAudience) * 10000) / 100 : 0,
    };
  }

  private async getSegmentMemberIds(segment: string, filters?: any): Promise<string[]> {
    let where: any = { status: 'active' };

    switch (segment) {
      case 'all':
        break;
      case 'active':
        break;
      case 'expiring':
      case 'expiring_soon': {
        const d = new Date();
        d.setDate(d.getDate() + 30);
        where = { ...where, memberships: { some: { status: 'active', end_date: { lte: d } } } };
        break;
      }
      case 'expired':
        where = { ...where, memberships: { every: { status: 'expired' } } };
        break;
      case 'inactive': {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        where = { ...where, check_ins: { none: { checked_in_at: { gte: d } } } };
        break;
      }
      case 'new': {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        where = { ...where, created_at: { gte: d } };
        break;
      }
      case 'by_plan':
        if (filters?.plan_id) where = { ...where, memberships: { some: { plan_id: filters.plan_id, status: 'active' } } };
        break;
      case 'by_branch':
        if (filters?.branch_id) where.branch_id = filters.branch_id;
        break;
    }

    const members = await this.tenant.client.member.findMany({ where, select: { id: true } });
    return members.map((m) => m.id);
  }
}
