import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import {
  CreateMessageTemplateDto,
  UpdateMessageTemplateDto,
  CreateAutomationWorkflowDto,
  UpdateAutomationWorkflowDto,
  CreateWorkflowActionDto,
  CreateReferralProgramDto,
  UpdateReferralProgramDto,
} from './dto';

@Injectable()
export class AutomationService {
  constructor(private prisma: PrismaService) {}

  // ── Message Templates ─────────────────────────────────────────

  async createTemplate(dto: CreateMessageTemplateDto) {
    return this.prisma.messageTemplate.create({ data: dto });
  }

  async findAllTemplates(filters: {
    organization_id?: string;
    channel?: string;
    is_active?: boolean;
    search?: string;
  }) {
    const { organization_id, channel, is_active, search } = filters;
    const where: any = {};

    if (organization_id) where.organization_id = organization_id;
    if (channel) where.channel = channel;
    if (is_active !== undefined) where.is_active = is_active;
    if (search) {
      where.template_name = { contains: search, mode: 'insensitive' };
    }

    return this.prisma.messageTemplate.findMany({
      where,
      orderBy: { template_name: 'asc' },
    });
  }

  async findOneTemplate(id: string) {
    const template = await this.prisma.messageTemplate.findUnique({ where: { id } });
    if (!template) throw new NotFoundException('Template not found');
    return template;
  }

  async updateTemplate(id: string, dto: UpdateMessageTemplateDto) {
    const template = await this.prisma.messageTemplate.findUnique({ where: { id } });
    if (!template) throw new NotFoundException('Template not found');
    return this.prisma.messageTemplate.update({ where: { id }, data: dto });
  }

  async deleteTemplate(id: string) {
    const template = await this.prisma.messageTemplate.findUnique({ where: { id } });
    if (!template) throw new NotFoundException('Template not found');
    await this.prisma.messageTemplate.delete({ where: { id } });
    return { success: true };
  }

  // Render template with variable substitution
  renderTemplate(content: string, variables: Record<string, string>): string {
    let rendered = content;
    for (const [key, value] of Object.entries(variables)) {
      rendered = rendered.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }
    return rendered;
  }

  // ── Automation Workflows ──────────────────────────────────────

  async createWorkflow(dto: CreateAutomationWorkflowDto) {
    const { actions, ...workflowData } = dto;

    return this.prisma.automationWorkflow.create({
      data: {
        workflow_name: workflowData.workflow_name,
        trigger_event: workflowData.trigger_event,
        trigger_config: workflowData.trigger_config as Prisma.InputJsonValue ?? Prisma.JsonNull,
        organization_id: workflowData.organization_id,
        actions: actions?.length
          ? {
              create: actions.map((a, idx) => ({
                action_order: a.action_order ?? idx + 1,
                action_type: a.action_type,
                delay_minutes: a.delay_minutes ?? 0,
                template_id: a.template_id,
                action_config: a.action_config as Prisma.InputJsonValue ?? Prisma.JsonNull,
              })),
            }
          : undefined,
      },
      include: {
        actions: {
          orderBy: { action_order: 'asc' },
          include: { template: { select: { id: true, template_name: true, channel: true } } },
        },
      },
    });
  }

  async findAllWorkflows(filters: {
    organization_id?: string;
    trigger_event?: string;
    status?: string;
  }) {
    const { organization_id, trigger_event, status } = filters;
    const where: any = {};
    if (organization_id) where.organization_id = organization_id;
    if (trigger_event) where.trigger_event = trigger_event;
    if (status) where.status = status;

    return this.prisma.automationWorkflow.findMany({
      where,
      orderBy: { created_at: 'desc' },
      include: {
        _count: { select: { actions: true } },
      },
    });
  }

  async findOneWorkflow(id: string) {
    const workflow = await this.prisma.automationWorkflow.findUnique({
      where: { id },
      include: {
        actions: {
          orderBy: { action_order: 'asc' },
          include: { template: { select: { id: true, template_name: true, channel: true } } },
        },
      },
    });
    if (!workflow) throw new NotFoundException('Workflow not found');
    return workflow;
  }

  async updateWorkflow(id: string, dto: UpdateAutomationWorkflowDto) {
    const workflow = await this.prisma.automationWorkflow.findUnique({ where: { id } });
    if (!workflow) throw new NotFoundException('Workflow not found');
    return this.prisma.automationWorkflow.update({
      where: { id },
      data: {
        ...dto,
        trigger_config: dto.trigger_config as Prisma.InputJsonValue ?? undefined,
      },
      include: { _count: { select: { actions: true } } },
    });
  }

  async addWorkflowAction(workflowId: string, dto: CreateWorkflowActionDto) {
    const workflow = await this.prisma.automationWorkflow.findUnique({ where: { id: workflowId } });
    if (!workflow) throw new NotFoundException('Workflow not found');

    // Auto-set action_order if not provided
    if (!dto.action_order) {
      const maxOrder = await this.prisma.workflowAction.aggregate({
        where: { workflow_id: workflowId },
        _max: { action_order: true },
      });
      dto.action_order = (maxOrder._max.action_order ?? 0) + 1;
    }

    return this.prisma.workflowAction.create({
      data: {
        workflow_id: workflowId,
        action_order: dto.action_order,
        action_type: dto.action_type,
        delay_minutes: dto.delay_minutes,
        template_id: dto.template_id,
        action_config: dto.action_config as Prisma.InputJsonValue ?? Prisma.JsonNull,
      },
      include: { template: { select: { id: true, template_name: true, channel: true } } },
    });
  }

  async removeWorkflowAction(actionId: string) {
    const action = await this.prisma.workflowAction.findUnique({ where: { id: actionId } });
    if (!action) throw new NotFoundException('Workflow action not found');
    await this.prisma.workflowAction.delete({ where: { id: actionId } });
    return { success: true };
  }

  async deleteWorkflow(id: string) {
    const workflow = await this.prisma.automationWorkflow.findUnique({ where: { id } });
    if (!workflow) throw new NotFoundException('Workflow not found');
    await this.prisma.automationWorkflow.delete({ where: { id } });
    return { success: true };
  }

  // ── Referral Programs ─────────────────────────────────────────

  async createReferralProgram(dto: CreateReferralProgramDto) {
    return this.prisma.referralProgram.create({ data: dto });
  }

  async findAllReferralPrograms(filters: {
    organization_id?: string;
    status?: string;
  }) {
    const where: any = {};
    if (filters.organization_id) where.organization_id = filters.organization_id;
    if (filters.status) where.status = filters.status;

    return this.prisma.referralProgram.findMany({
      where,
      orderBy: { created_at: 'desc' },
    });
  }

  async findOneReferralProgram(id: string) {
    const program = await this.prisma.referralProgram.findUnique({ where: { id } });
    if (!program) throw new NotFoundException('Referral program not found');
    return program;
  }

  async updateReferralProgram(id: string, dto: UpdateReferralProgramDto) {
    const program = await this.prisma.referralProgram.findUnique({ where: { id } });
    if (!program) throw new NotFoundException('Referral program not found');
    return this.prisma.referralProgram.update({ where: { id }, data: dto });
  }

  async getReferralStats(organizationId?: string) {
    const where: any = {};
    if (organizationId) where.referrer = { organization_id: organizationId };

    const [total, byStatus] = await Promise.all([
      this.prisma.memberReferral.count({ where }),
      this.prisma.memberReferral.groupBy({
        by: ['reward_status'],
        where,
        _count: { id: true },
      }),
    ]);

    const statusMap: Record<string, number> = {};
    for (const s of byStatus) statusMap[s.reward_status] = s._count.id;

    return {
      total_referrals: total,
      by_status: statusMap,
      pending: statusMap['pending'] ?? 0,
      awarded: statusMap['awarded'] ?? 0,
      expired: statusMap['expired'] ?? 0,
    };
  }

  // ── Push Notifications ────────────────────────────────────────

  async sendPushNotification(data: {
    member_id: string;
    title: string;
    message: string;
    data?: Record<string, unknown>;
  }) {
    return this.prisma.pushNotification.create({
      data: {
        member_id: data.member_id,
        title: data.title,
        message: data.message,
        data: data.data as Prisma.InputJsonValue ?? Prisma.JsonNull,
        status: 'sent',
        sent_at: new Date(),
      },
    });
  }

  async getMemberNotifications(memberId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.pushNotification.findMany({
        where: { member_id: memberId },
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.pushNotification.count({ where: { member_id: memberId } }),
    ]);
    return { data, total, page, limit };
  }

  async markNotificationRead(id: string) {
    const notif = await this.prisma.pushNotification.findUnique({ where: { id } });
    if (!notif) throw new NotFoundException('Notification not found');
    return this.prisma.pushNotification.update({
      where: { id },
      data: { read_at: new Date() },
    });
  }
}
