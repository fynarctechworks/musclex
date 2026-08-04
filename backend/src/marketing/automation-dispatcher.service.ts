import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OnEvent } from '@nestjs/event-emitter';
import { TenantPrisma } from '../prisma/tenant-prisma.accessor';
import { TenantTaskRunner } from '../prisma/tenant-task-runner';
import { PublicPrismaService } from '../prisma/public-prisma.service';
import { CronLockService } from '../common/services/cron-lock.service';
import { QueueService } from '../queue/queue.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { EmailService } from '../email/email.service';
import { PushService } from '../push/push.service';
import { MarketingService } from './marketing.service';
import { getTenantGymId } from '../common/tenant-context';

export const AUTOMATION_EVENTS = {
  LEAD_CREATED: 'lead.created',
} as const;

export interface LeadCreatedPayload {
  gymId: string;
  leadId: string;
  fullName: string;
  phone?: string | null;
  email?: string | null;
}

type WorkflowWithActions = {
  id: string;
  workflow_name: string;
  trigger_event: string;
  trigger_config: unknown;
  actions: Array<{
    id: string;
    action_type: string;
    delay_minutes: number;
    action_config: unknown;
    template: { content: string; subject: string | null; channel: string } | null;
  }>;
};

const DEFAULT_MESSAGES: Record<string, string> = {
  membership_expiring:
    'Hi {{member_name}}, your {{plan_name}} membership at {{gym_name}} expires on {{expiry_date}}. Renew today so you don’t lose access!',
  birthday:
    'Happy birthday, {{member_name}}! 🎉 Everyone at {{gym_name}} wishes you a great year ahead. Come celebrate with a workout!',
  lead_created:
    'Hi {{lead_name}}, thanks for your interest in {{gym_name}}! Our team will reach out shortly — reply here if you’d like to book a free trial.',
  class_reminder:
    'Hi {{member_name}}, reminder: {{class_name}} at {{gym_name}} starts {{starts_at}}. See you there!',
};

/**
 * The missing automation EXECUTOR. AutomationService only stores
 * AutomationWorkflow/WorkflowAction rows — nothing ever fired them. This
 * service is the trigger engine:
 *
 *   - daily cron (advisory-locked, per-tenant sweep):
 *       membership_expiring — memberships ending exactly `days_before_expiry`
 *                             days from today (exact-day window = built-in
 *                             once-per-membership idempotency)
 *       birthday            — members whose DOB month/day is today
 *   - events:
 *       lead_created        — emitted by LeadsService on lead creation
 *
 * Delivery: WhatsApp goes through WhatsAppService directly when Redis is off
 * (still real sends), or the notification queue (with per-action delay) when
 * on. Email uses EmailService. SMS requires the queue (Twilio processor).
 */
@Injectable()
export class AutomationDispatcherService {
  private readonly logger = new Logger(AutomationDispatcherService.name);

  constructor(
    private readonly tenant: TenantPrisma,
    private readonly tasks: TenantTaskRunner,
    private readonly pub: PublicPrismaService,
    private readonly cronLock: CronLockService,
    private readonly queue: QueueService,
    private readonly whatsapp: WhatsAppService,
    private readonly email: EmailService,
    private readonly push: PushService,
    private readonly marketing: MarketingService,
  ) {}

  /** 10:00 daily — after the analytics crons, before the gym's peak evening. */
  @Cron('0 10 * * *')
  async runDailyTriggers(): Promise<void> {
    await this.cronLock.withLock('cron:automation_daily', async () => {
      this.logger.log('Running daily automation triggers (membership_expiring, birthday)...');
      const summary = await this.tasks.forEachTenant(async () => {
        await this.fireMembershipExpiring();
        await this.fireBirthdays();
      });
      this.logger.log(`Automation daily sweep: ${summary.ok}/${summary.total} gyms ok, ${summary.failed} failed`);
    });
  }

  /**
   * Hourly — class reminders. Runs every hour (not daily) because the reminder
   * horizon is measured in HOURS before the class, so a once-a-day sweep would
   * miss most sessions. Each run notifies only classes whose start falls inside
   * the hour-wide window exactly `hours_before` from now, which gives each
   * enrolment exactly one reminder without needing a "reminded_at" column.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async runClassReminders(): Promise<void> {
    await this.cronLock.withLock('cron:class_reminders', async () => {
      const summary = await this.tasks.forEachTenant(async () => {
        await this.fireClassReminders();
      });
      this.logger.log(
        `Class reminder sweep: ${summary.ok}/${summary.total} gyms ok, ${summary.failed} failed`,
      );
    });
  }

  /**
   * Every 5 minutes — dispatch campaigns whose scheduled time has arrived.
   * `Campaign.scheduled_at` was stored and filterable in the UI but nothing
   * ever sent it, so "schedule for later" silently did nothing.
   */
  @Cron('*/5 * * * *')
  async runScheduledCampaigns(): Promise<void> {
    await this.cronLock.withLock('cron:scheduled_campaigns', async () => {
      let due = 0;
      let sent = 0;
      let failed = 0;
      const summary = await this.tasks.forEachTenant(async () => {
        const r = await this.marketing.dispatchDueCampaigns();
        due += r.due;
        sent += r.sent;
        failed += r.failed;
      });
      if (due > 0) {
        this.logger.log(
          `Scheduled campaigns: ${sent} sent, ${failed} failed of ${due} due ` +
            `(${summary.ok}/${summary.total} gyms)`,
        );
      }
    });
  }

  @OnEvent(AUTOMATION_EVENTS.LEAD_CREATED, { async: true })
  async onLeadCreated(payload: LeadCreatedPayload): Promise<void> {
    try {
      await this.tasks.runForGym(payload.gymId, async () => {
        const workflows = await this.activeWorkflows('lead_created');
        if (workflows.length === 0) return;
        const gymName = await this.gymName(payload.gymId);
        for (const workflow of workflows) {
          await this.executeActions(workflow, {
            to: { phone: payload.phone, email: payload.email, memberId: undefined },
            vars: {
              lead_name: payload.fullName,
              member_name: payload.fullName,
              gym_name: gymName,
            },
            defaultMessage: DEFAULT_MESSAGES.lead_created,
            triggerType: 'automation:lead_created',
          });
        }
      });
    } catch (e) {
      this.logger.error(`lead_created automation failed for gym ${payload.gymId}: ${(e as Error).message}`);
    }
  }

  // ────────────────────────────────────────────────────────────────
  // Cron triggers (run inside a tenant context set by forEachTenant)
  // ────────────────────────────────────────────────────────────────

  private async fireMembershipExpiring(): Promise<void> {
    const workflows = await this.activeWorkflows('membership_expiring');
    if (workflows.length === 0) return;
    const gymName = await this.gymName(getTenantGymId()!);

    for (const workflow of workflows) {
      const cfg = (workflow.trigger_config ?? {}) as Record<string, unknown>;
      const daysBefore = Number(cfg.days_before_expiry ?? cfg.days_before ?? 3) || 3;

      // Exact-day window: only memberships ending exactly `daysBefore` days
      // from today match, so each membership is notified once per horizon.
      const target = new Date();
      target.setHours(0, 0, 0, 0);
      target.setDate(target.getDate() + daysBefore);
      const nextDay = new Date(target);
      nextDay.setDate(nextDay.getDate() + 1);

      const expiring = await this.tenant.client.memberMembership.findMany({
        where: { status: 'active', end_date: { gte: target, lt: nextDay } },
        include: {
          member: { select: { id: true, full_name: true, phone: true, email: true, status: true } },
          plan: { select: { name: true } },
        },
      });

      for (const membership of expiring) {
        if (membership.member.status !== 'active') continue;
        await this.executeActions(workflow, {
          to: {
            phone: membership.member.phone,
            email: membership.member.email,
            memberId: membership.member.id,
          },
          vars: {
            member_name: membership.member.full_name,
            plan_name: membership.plan.name,
            expiry_date: membership.end_date
              ? membership.end_date.toISOString().slice(0, 10)
              : '',
            gym_name: gymName,
            days_left: String(daysBefore),
          },
          defaultMessage: DEFAULT_MESSAGES.membership_expiring,
          triggerType: 'automation:membership_expiring',
        });
      }
    }
  }

  /**
   * Reminders for classes starting ~`hours_before` from now (default 24).
   *
   * Covers BOTH class systems: the legacy `Class`/`ClassEnrollment` pair the
   * member app books against, and the newer `ClassSession`/`ClassBooking`
   * stack used by the sessions admin UI. Waitlisted members are skipped —
   * they don't have a seat to be reminded about.
   */
  private async fireClassReminders(): Promise<void> {
    const workflows = await this.activeWorkflows('class_reminder');
    if (workflows.length === 0) return;
    const gymName = await this.gymName(getTenantGymId()!);

    for (const workflow of workflows) {
      const cfg = (workflow.trigger_config ?? {}) as Record<string, unknown>;
      const hoursBefore = Number(cfg.hours_before ?? 24) || 24;

      // One-hour-wide window exactly `hoursBefore` out. The cron runs hourly,
      // so consecutive runs cover disjoint windows → one reminder per booking.
      const from = new Date(Date.now() + hoursBefore * 3600_000);
      from.setMinutes(0, 0, 0);
      const to = new Date(from.getTime() + 3600_000);

      // ── Legacy Class / ClassEnrollment (what the member app books) ──
      const classes = await this.tenant.client.class.findMany({
        where: { starts_at: { gte: from, lt: to }, status: 'scheduled' },
        select: {
          id: true,
          name: true,
          starts_at: true,
          enrollments: {
            where: { status: 'enrolled' },
            select: {
              member: {
                select: { id: true, full_name: true, phone: true, email: true, status: true },
              },
            },
          },
        },
      });

      for (const cls of classes) {
        for (const enrolment of cls.enrollments) {
          const m = enrolment.member;
          if (!m || m.status !== 'active') continue;
          await this.executeActions(workflow, {
            to: { phone: m.phone, email: m.email, memberId: m.id },
            vars: {
              member_name: m.full_name,
              class_name: cls.name,
              starts_at: this.formatWhen(cls.starts_at),
              gym_name: gymName,
            },
            defaultMessage: DEFAULT_MESSAGES.class_reminder,
            triggerType: 'automation:class_reminder',
          });
        }
      }

      // ── ClassSession / ClassBooking (sessions + templates stack) ──
      const sessions = await this.tenant.client.classSession.findMany({
        where: { start_time: { gte: from, lt: to }, status: 'scheduled' },
        select: {
          id: true,
          start_time: true,
          // Denormalized on the session — always present, unlike template.
          name: true,
          bookings: {
            where: { booking_status: 'booked' },
            select: {
              member: {
                select: { id: true, full_name: true, phone: true, email: true, status: true },
              },
            },
          },
        },
      });

      for (const session of sessions) {
        for (const booking of session.bookings) {
          const m = booking.member;
          if (!m || m.status !== 'active') continue;
          await this.executeActions(workflow, {
            to: { phone: m.phone, email: m.email, memberId: m.id },
            vars: {
              member_name: m.full_name,
              class_name: session.name,
              starts_at: this.formatWhen(session.start_time),
              gym_name: gymName,
            },
            defaultMessage: DEFAULT_MESSAGES.class_reminder,
            triggerType: 'automation:class_reminder',
          });
        }
      }
    }
  }

  /** Human-friendly "Mon 14 Apr, 6:30 pm" for reminder copy. */
  private formatWhen(d: Date | null): string {
    if (!d) return 'soon';
    return d.toLocaleString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  private async fireBirthdays(): Promise<void> {
    const workflows = await this.activeWorkflows('birthday');
    if (workflows.length === 0) return;
    const gymName = await this.gymName(getTenantGymId()!);

    const today = new Date();
    const candidates = await this.tenant.client.member.findMany({
      where: { status: 'active', date_of_birth: { not: null } },
      select: { id: true, full_name: true, phone: true, email: true, date_of_birth: true },
    });
    const birthdayMembers = candidates.filter(
      (m) =>
        m.date_of_birth &&
        m.date_of_birth.getUTCMonth() === today.getUTCMonth() &&
        m.date_of_birth.getUTCDate() === today.getUTCDate(),
    );

    for (const workflow of workflows) {
      for (const member of birthdayMembers) {
        await this.executeActions(workflow, {
          to: { phone: member.phone, email: member.email, memberId: member.id },
          vars: { member_name: member.full_name, gym_name: gymName },
          defaultMessage: DEFAULT_MESSAGES.birthday,
          triggerType: 'automation:birthday',
        });
      }
    }
  }

  // ────────────────────────────────────────────────────────────────

  private async activeWorkflows(triggerEvent: string): Promise<WorkflowWithActions[]> {
    return this.tenant.client.automationWorkflow.findMany({
      where: { trigger_event: triggerEvent, status: 'active' },
      include: {
        actions: {
          orderBy: { action_order: 'asc' },
          include: { template: { select: { content: true, subject: true, channel: true } } },
        },
      },
    }) as unknown as Promise<WorkflowWithActions[]>;
  }

  private async executeActions(
    workflow: WorkflowWithActions,
    ctx: {
      to: { phone?: string | null; email?: string | null; memberId?: string };
      vars: Record<string, string>;
      defaultMessage: string;
      triggerType: string;
    },
  ): Promise<void> {
    for (const action of workflow.actions) {
      const cfg = (action.action_config ?? {}) as Record<string, unknown>;
      const content =
        action.template?.content ??
        (typeof cfg.message === 'string' ? cfg.message : ctx.defaultMessage);
      const message = this.render(content, ctx.vars);

      try {
        switch (action.action_type) {
          case 'send_whatsapp': {
            if (!ctx.to.phone) break;
            if (this.queue.isRedisEnabled) {
              await this.queue.enqueueNotification(
                {
                  type: 'whatsapp',
                  to: ctx.to.phone,
                  message,
                  gymId: getTenantGymId() ?? undefined,
                  memberId: ctx.to.memberId,
                  triggerType: ctx.triggerType,
                },
                action.delay_minutes > 0 ? { delay: action.delay_minutes * 60_000 } : undefined,
              );
            } else {
              await this.whatsapp.sendText({
                to: ctx.to.phone,
                text: message,
                memberId: ctx.to.memberId,
                triggerType: ctx.triggerType,
              });
            }
            break;
          }
          case 'send_email': {
            if (!ctx.to.email) break;
            const subject = this.render(
              action.template?.subject ?? workflow.workflow_name,
              ctx.vars,
            );
            await this.email.sendRaw({
              to: ctx.to.email,
              subject,
              html: `<p>${message.replace(/\n/g, '<br/>')}</p>`,
              text: message,
            });
            break;
          }
          case 'send_sms': {
            if (!ctx.to.phone) break;
            if (!this.queue.isRedisEnabled) {
              this.logger.warn('send_sms action skipped — SMS delivery requires the Redis queue');
              break;
            }
            await this.queue.enqueueNotification(
              {
                type: 'sms',
                to: ctx.to.phone,
                message,
                gymId: getTenantGymId() ?? undefined,
                memberId: ctx.to.memberId,
                triggerType: ctx.triggerType,
              },
              action.delay_minutes > 0 ? { delay: action.delay_minutes * 60_000 } : undefined,
            );
            break;
          }
          case 'send_push': {
            if (!ctx.to.memberId) break;
            await this.push.sendToMember(
              ctx.to.memberId,
              { title: workflow.workflow_name, body: message, data: { source: 'automation' } },
              { category: 'reminders' },
            );
            break;
          }
          default:
            // assign_task / update_status — not executable yet.
            this.logger.debug(`Automation action ${action.action_type} not executable — skipped`);
        }
      } catch (e) {
        this.logger.warn(
          `Automation action ${action.action_type} (workflow ${workflow.id}) failed: ${(e as Error).message}`,
        );
      }
    }
  }

  private async gymName(gymId: string): Promise<string> {
    try {
      const studio = await this.pub.studio.findUnique({ where: { id: gymId }, select: { name: true } });
      return studio?.name ?? 'your gym';
    } catch {
      return 'your gym';
    }
  }

  private render(template: string, vars: Record<string, string>): string {
    // The seeded templates use {{name}} while triggers supply {{member_name}};
    // alias them so a seeded template never ships a literal "{{name}}" to a
    // member. Any placeholder still unresolved after substitution is stripped
    // rather than sent as raw braces.
    const all: Record<string, string> = {
      ...vars,
      name: vars.name ?? vars.member_name ?? vars.lead_name ?? '',
    };

    let out = template;
    for (const [key, value] of Object.entries(all)) {
      out = out.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), value ?? '');
    }
    return out.replace(/{{\s*[\w.]+\s*}}/g, '').replace(/\s{2,}/g, ' ').trim();
  }
}
