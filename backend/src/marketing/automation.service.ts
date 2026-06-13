import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TenantPrisma } from '../prisma/tenant-prisma.accessor';
import { Prisma } from '../../node_modules/.prisma/client-tenant';
import {
  CreateMessageTemplateDto,
  UpdateMessageTemplateDto,
  CreateAutomationWorkflowDto,
  UpdateAutomationWorkflowDto,
  CreateWorkflowActionDto,
  CreateReferralProgramDto,
  UpdateReferralProgramDto,
} from './dto';
import { getTenantGymId } from '../common/tenant-context';

@Injectable()
export class AutomationService {
  constructor(private readonly tenant: TenantPrisma) {}

  // ── Message Templates ─────────────────────────────────────────

  async createTemplate(dto: CreateMessageTemplateDto) {
    return this.tenant.client.messageTemplate.create({ data: { ...dto, gym_id: getTenantGymId()! } });
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

    return this.tenant.client.messageTemplate.findMany({
      where,
      orderBy: { template_name: 'asc' },
    });
  }

  async findOneTemplate(id: string) {
    const template = await this.tenant.client.messageTemplate.findUnique({ where: { id } });
    if (!template) throw new NotFoundException('Template not found');
    return template;
  }

  async updateTemplate(id: string, dto: UpdateMessageTemplateDto) {
    const template = await this.tenant.client.messageTemplate.findUnique({ where: { id } });
    if (!template) throw new NotFoundException('Template not found');
    return this.tenant.client.messageTemplate.update({ where: { id }, data: dto });
  }

  async deleteTemplate(id: string) {
    const template = await this.tenant.client.messageTemplate.findUnique({ where: { id } });
    if (!template) throw new NotFoundException('Template not found');
    await this.tenant.client.messageTemplate.delete({ where: { id } });
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

  // ── Default seed pack: 5 essential templates ──────────────────
  private static readonly DEFAULT_TEMPLATES = [
    {
      key: 'welcome_member',
      template_name: 'Welcome — New Member',
      channel: 'whatsapp',
      subject: undefined,
      content:
        "Hi {{name}}! 👋 Welcome to {{gym_name}}. Your member ID is *{{member_code}}* and your {{plan_name}} membership runs until {{expiry_date}}. We're excited to have you — see you at the gym!",
      variables: ['name', 'gym_name', 'member_code', 'plan_name', 'expiry_date'],
    },
    {
      key: 'membership_expiring',
      template_name: 'Membership Expiring Soon',
      channel: 'whatsapp',
      subject: undefined,
      content:
        "Hi {{name}}, your {{plan_name}} membership at {{gym_name}} expires on *{{expiry_date}}*. Renew now to keep training without a break — reply to this message and we'll help you out.",
      variables: ['name', 'plan_name', 'gym_name', 'expiry_date'],
    },
    {
      key: 'membership_renewed',
      template_name: 'Renewal Confirmation',
      channel: 'whatsapp',
      subject: undefined,
      content:
        "Thanks for renewing, {{name}}! 💪 Your {{plan_name}} membership is active until *{{expiry_date}}*. Receipt: {{invoice_number}}. Keep crushing it!",
      variables: ['name', 'plan_name', 'expiry_date', 'invoice_number'],
    },
    {
      key: 'birthday',
      template_name: 'Happy Birthday',
      channel: 'whatsapp',
      subject: undefined,
      content:
        "Happy birthday, {{name}}! 🎉 Wishing you a year full of strength, energy and PRs. From everyone at {{gym_name}}.",
      variables: ['name', 'gym_name'],
    },
    {
      key: 'payment_failed',
      template_name: 'Payment Failed',
      channel: 'whatsapp',
      subject: undefined,
      content:
        "Hi {{name}}, we couldn't process your payment for {{plan_name}} ({{currency}} {{amount}}). Please update your payment method or reach out to us so we can sort it out.",
      variables: ['name', 'plan_name', 'currency', 'amount'],
    },
  ];

  /**
   * Seed essential templates for the gym (idempotent — skips ones that already
   * exist by template_name). Returns the templates keyed by their seed `key`.
   */
  async seedDefaultTemplates() {
    const gymId = getTenantGymId()!;
    const existing = await this.tenant.client.messageTemplate.findMany({
      where: { template_name: { in: AutomationService.DEFAULT_TEMPLATES.map((t) => t.template_name) } },
    });
    const existingByName = new Map(existing.map((t) => [t.template_name, t]));

    const result: Record<string, { id: string; template_name: string; channel: string; created: boolean }> = {};
    for (const def of AutomationService.DEFAULT_TEMPLATES) {
      const found = existingByName.get(def.template_name);
      if (found) {
        result[def.key] = {
          id: found.id,
          template_name: found.template_name,
          channel: found.channel,
          created: false,
        };
        continue;
      }
      const created = await this.tenant.client.messageTemplate.create({
        data: {
          gym_id: gymId,
          template_name: def.template_name,
          channel: def.channel,
          subject: def.subject,
          content: def.content,
          variables: def.variables,
        },
      });
      result[def.key] = {
        id: created.id,
        template_name: created.template_name,
        channel: created.channel,
        created: true,
      };
    }
    return { templates: result };
  }

  // ── Default workflow pack ─────────────────────────────────────
  private static readonly DEFAULT_WORKFLOWS: Array<{
    workflow_name: string;
    trigger_event: string;
    template_key: string;
    action_type: 'send_whatsapp';
  }> = [
    {
      workflow_name: 'Welcome new members',
      trigger_event: 'member_registered',
      template_key: 'welcome_member',
      action_type: 'send_whatsapp',
    },
    {
      workflow_name: 'Membership expiry reminder',
      trigger_event: 'membership_expiring',
      template_key: 'membership_expiring',
      action_type: 'send_whatsapp',
    },
    {
      workflow_name: 'Thank members for renewing',
      trigger_event: 'member_renewed',
      template_key: 'membership_renewed',
      action_type: 'send_whatsapp',
    },
  ];

  /**
   * Seed essential workflows wired to seeded templates (idempotent — skips
   * workflows whose trigger_event already exists for this gym).
   */
  async seedDefaultWorkflows() {
    const gymId = getTenantGymId()!;
    const seeded = await this.seedDefaultTemplates();
    const templates = seeded.templates;

    const triggers = AutomationService.DEFAULT_WORKFLOWS.map((w) => w.trigger_event);
    const existing = await this.tenant.client.automationWorkflow.findMany({
      where: { trigger_event: { in: triggers } },
    });
    const existingByTrigger = new Map(existing.map((w) => [w.trigger_event, w]));

    const result: Array<{ id: string; trigger_event: string; created: boolean }> = [];
    for (const def of AutomationService.DEFAULT_WORKFLOWS) {
      const found = existingByTrigger.get(def.trigger_event);
      if (found) {
        result.push({ id: found.id, trigger_event: found.trigger_event, created: false });
        continue;
      }
      const tpl = templates[def.template_key];
      if (!tpl) continue;
      const created = await this.tenant.client.automationWorkflow.create({
        data: {
          gym_id: gymId,
          workflow_name: def.workflow_name,
          trigger_event: def.trigger_event,
          status: 'active',
          actions: {
            create: [
              {
                gym_id: gymId,
                action_order: 1,
                action_type: def.action_type,
                delay_minutes: 0,
                template_id: tpl.id,
              },
            ],
          },
        },
      });
      result.push({ id: created.id, trigger_event: created.trigger_event, created: true });
    }
    return { workflows: result };
  }

  // ── Automation Workflows ──────────────────────────────────────

  async createWorkflow(dto: CreateAutomationWorkflowDto) {
    const { actions, ...workflowData } = dto;

    return this.tenant.client.automationWorkflow.create({
      data: {
        gym_id: getTenantGymId()!,
        workflow_name: workflowData.workflow_name,
        trigger_event: workflowData.trigger_event,
        trigger_config: workflowData.trigger_config as Prisma.InputJsonValue ?? Prisma.JsonNull,
        organization_id: workflowData.organization_id,
        actions: actions?.length
          ? {
              create: actions.map((a, idx) => ({
                gym_id: getTenantGymId()!,
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

    return this.tenant.client.automationWorkflow.findMany({
      where,
      orderBy: { created_at: 'desc' },
      include: {
        _count: { select: { actions: true } },
        actions: {
          orderBy: { action_order: 'asc' },
          include: { template: { select: { id: true, template_name: true, channel: true } } },
        },
      },
    });
  }

  async findOneWorkflow(id: string) {
    const workflow = await this.tenant.client.automationWorkflow.findUnique({
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
    const workflow = await this.tenant.client.automationWorkflow.findUnique({ where: { id } });
    if (!workflow) throw new NotFoundException('Workflow not found');
    return this.tenant.client.automationWorkflow.update({
      where: { id },
      data: {
        ...dto,
        trigger_config: dto.trigger_config as Prisma.InputJsonValue ?? undefined,
      },
      include: { _count: { select: { actions: true } } },
    });
  }

  async addWorkflowAction(workflowId: string, dto: CreateWorkflowActionDto) {
    const workflow = await this.tenant.client.automationWorkflow.findUnique({ where: { id: workflowId } });
    if (!workflow) throw new NotFoundException('Workflow not found');

    // Auto-set action_order if not provided
    if (!dto.action_order) {
      const maxOrder = await this.tenant.client.workflowAction.aggregate({
        where: { workflow_id: workflowId },
        _max: { action_order: true },
      });
      dto.action_order = (maxOrder._max.action_order ?? 0) + 1;
    }

    return this.tenant.client.workflowAction.create({
      data: {
        gym_id: getTenantGymId()!,
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
    const action = await this.tenant.client.workflowAction.findUnique({ where: { id: actionId } });
    if (!action) throw new NotFoundException('Workflow action not found');
    await this.tenant.client.workflowAction.delete({ where: { id: actionId } });
    return { success: true };
  }

  async deleteWorkflow(id: string) {
    const workflow = await this.tenant.client.automationWorkflow.findUnique({ where: { id } });
    if (!workflow) throw new NotFoundException('Workflow not found');
    await this.tenant.client.automationWorkflow.delete({ where: { id } });
    return { success: true };
  }

  // ── Referral Programs ─────────────────────────────────────────

  async createReferralProgram(dto: CreateReferralProgramDto) {
    return this.tenant.client.referralProgram.create({ data: { ...dto, gym_id: getTenantGymId()! } });
  }

  async findAllReferralPrograms(filters: {
    organization_id?: string;
    status?: string;
  }) {
    const where: any = {};
    if (filters.organization_id) where.organization_id = filters.organization_id;
    if (filters.status) where.status = filters.status;

    return this.tenant.client.referralProgram.findMany({
      where,
      orderBy: { created_at: 'desc' },
    });
  }

  async findOneReferralProgram(id: string) {
    const program = await this.tenant.client.referralProgram.findUnique({ where: { id } });
    if (!program) throw new NotFoundException('Referral program not found');
    return program;
  }

  async updateReferralProgram(id: string, dto: UpdateReferralProgramDto) {
    const program = await this.tenant.client.referralProgram.findUnique({ where: { id } });
    if (!program) throw new NotFoundException('Referral program not found');
    return this.tenant.client.referralProgram.update({ where: { id }, data: dto });
  }

  async getReferralStats(organizationId?: string) {
    const where: any = {};
    if (organizationId) where.referrer = { organization_id: organizationId };

    const [total, byStatus] = await Promise.all([
      this.tenant.client.memberReferral.count({ where }),
      this.tenant.client.memberReferral.groupBy({
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
    return this.tenant.client.pushNotification.create({
      data: {
        gym_id: getTenantGymId()!,
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
      this.tenant.client.pushNotification.findMany({
        where: { member_id: memberId },
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      this.tenant.client.pushNotification.count({ where: { member_id: memberId } }),
    ]);
    return { data, total, page, limit };
  }

  async markNotificationRead(id: string) {
    const notif = await this.tenant.client.pushNotification.findUnique({ where: { id } });
    if (!notif) throw new NotFoundException('Notification not found');
    return this.tenant.client.pushNotification.update({
      where: { id },
      data: { read_at: new Date() },
    });
  }
}
