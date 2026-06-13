import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TenantPrisma } from '../prisma/tenant-prisma.accessor';
import { TenantTaskRunner } from '../prisma/tenant-task-runner';
import { randomBytes } from 'crypto';
import { CronLockService } from '../common/services/cron-lock.service';

/**
 * Nightly membership-lifecycle crons. These have no HTTP request, so they run
 * each gym's work inside `tasks.forEachTenant(...)`, which binds the tenant
 * client to one studio's physical schema at a time (Road B). Inside the callback
 * `this.tenant.client.*` is scoped to that gym; writes set `gym_id` from the
 * iteration context, never derived from anything client-supplied.
 */
@Injectable()
export class RenewalsService {
  private readonly logger = new Logger(RenewalsService.name);

  constructor(
    private tenant: TenantPrisma,
    private tasks: TenantTaskRunner,
    private cronLock: CronLockService,
  ) {}

  // ── Nightly: Expire memberships past end_date + grace ─────

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async handleMembershipExpiry() {
    const result = await this.cronLock.withLock('cron:membership_expiry', async () => {
      this.logger.log('Running membership expiry check...');
      const now = new Date();
      let expired = 0;

      await this.tasks.forEachTenant(async () => {
        // Expire memberships past their grace_end_date (or end_date if no grace)
        const expiredMemberships = await this.tenant.client.memberMembership.findMany({
          where: {
            status: 'active',
            end_date: { not: null },
            OR: [
              { grace_end_date: { not: null, lt: now } },
              { grace_end_date: null, end_date: { lt: now } },
            ],
          },
          include: { member: { select: { id: true } } },
        });
        if (expiredMemberships.length === 0) return;

        const ids = expiredMemberships.map((m) => m.id);
        await this.tenant.client.memberMembership.updateMany({
          where: { id: { in: ids } },
          data: { status: 'expired' },
        });

        // Update member statuses for those with no other active memberships
        const memberIds = [...new Set(expiredMemberships.map((m) => m.member_id))];
        for (const memberId of memberIds) {
          const activeCount = await this.tenant.client.memberMembership.count({
            where: { member_id: memberId, status: 'active' },
          });
          if (activeCount === 0) {
            await this.tenant.client.member.update({
              where: { id: memberId },
              data: { status: 'expired' },
            });
          }
        }
        expired += ids.length;
      });

      this.logger.log(`Expired ${expired} memberships`);
      return { expired };
    });
    if (!result) this.logger.debug('Membership expiry skipped — another instance holds the lock');
    return result ?? { expired: 0 };
  }

  // ── Nightly: Flag expiring-soon memberships ───────────────

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleExpiringSoonAlert() {
    const result = await this.cronLock.withLock('cron:expiring_soon', async () => {
      this.logger.log('Running expiring-soon flagging...');
      const now = new Date();
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 86400000);
      let flagged = 0;

      await this.tasks.forEachTenant(async () => {
        const expiringSoon = await this.tenant.client.memberMembership.findMany({
          where: {
            status: 'active',
            end_date: { gte: now, lte: sevenDaysFromNow },
          },
          include: { member: { select: { id: true, status: true } } },
        });

        // Update member status to expiring_soon (only if currently active)
        const memberIds = [...new Set(
          expiringSoon
            .filter((m) => m.member.status === 'active')
            .map((m) => m.member_id),
        )];

        if (memberIds.length > 0) {
          await this.tenant.client.member.updateMany({
            where: { id: { in: memberIds }, status: 'active' },
            data: { status: 'expiring_soon' },
          });
          flagged += memberIds.length;
        }
      });

      this.logger.log(`Flagged ${flagged} members as expiring_soon`);
      return { flagged };
    });
    if (!result) this.logger.debug('Expiring-soon check skipped — another instance holds the lock');
    return result ?? { flagged: 0 };
  }

  // ── Nightly: Auto-renew eligible memberships ──────────────

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handleAutoRenewals() {
    const result = await this.cronLock.withLock('cron:auto_renewals', async () => {
      this.logger.log('Running auto-renewal processing...');
      const now = new Date();
      let renewed = 0;
      let failed = 0;

      await this.tasks.forEachTenant(async ({ gymId }) => {
        // Find auto-renew memberships that have expired (past end_date, within grace)
        const candidates = await this.tenant.client.memberMembership.findMany({
          where: {
            status: 'active',
            auto_renew: true,
            end_date: { lt: now },
            OR: [{ grace_end_date: { gte: now } }, { grace_end_date: null }],
          },
          include: { plan: true, member: { select: { id: true } } },
        });

        for (const membership of candidates) {
          try {
            const plan = membership.plan;

            // All writes are already scoped to this gym's schema by forEachTenant.
            await this.tenant.client.$transaction(async (tx) => {
              await tx.memberMembership.update({
                where: { id: membership.id },
                data: { status: 'renewed' },
              });

              const startDate = new Date();
              const endDate = plan.duration_days
                ? new Date(startDate.getTime() + plan.duration_days * 86400000)
                : null;
              const graceEndDate = endDate && plan.grace_period_days > 0
                ? new Date(endDate.getTime() + plan.grace_period_days * 86400000)
                : null;

              const newMembership = await tx.memberMembership.create({
                data: {
                  gym_id: gymId,
                  member_id: membership.member_id,
                  plan_id: plan.id,
                  branch_id: membership.branch_id,
                  start_date: startDate,
                  end_date: endDate,
                  classes_remaining: plan.total_classes,
                  remaining_visits: plan.max_visits,
                  grace_end_date: graceEndDate,
                  status: 'active',
                  auto_renew: true,
                },
              });

              const receiptNumber = `RCP-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${randomBytes(4).toString('hex').toUpperCase()}`;
              await tx.payment.create({
                data: {
                  gym_id: gymId,
                  member_id: membership.member_id,
                  membership_id: newMembership.id,
                  branch_id: membership.branch_id,
                  amount: plan.price,
                  payment_method: 'bank_transfer',
                  status: 'pending',
                  receipt_number: receiptNumber,
                },
              });
            });

            renewed++;
          } catch (error) {
            this.logger.error(`Failed to auto-renew membership ${membership.id}: ${(error as Error).message}`);
            failed++;
          }
        }
      });

      this.logger.log(`Auto-renewal complete: ${renewed} renewed, ${failed} failed`);
      return { renewed, failed };
    });
    if (!result) this.logger.debug('Auto-renewal skipped — another instance holds the lock');
    return result ?? { renewed: 0, failed: 0 };
  }

  // ── Nightly: Auto-unfreeze memberships past freeze_end_date ─

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async handleAutoUnfreeze() {
    const result = await this.cronLock.withLock('cron:auto_unfreeze', async () => {
      this.logger.log('Running auto-unfreeze check...');
      const now = new Date();
      let unfrozen = 0;

      await this.tasks.forEachTenant(async () => {
        const toUnfreeze = await this.tenant.client.memberMembership.findMany({
          where: {
            status: 'frozen',
            freeze_end_date: { not: null, lte: now },
          },
          include: { member: { select: { id: true } } },
        });

        for (const membership of toUnfreeze) {
          const freezeStart = membership.freeze_start_date;
          const frozenDays = freezeStart
            ? Math.ceil((now.getTime() - freezeStart.getTime()) / 86400000)
            : 0;

          const newEndDate = membership.end_date && frozenDays > 0
            ? new Date(membership.end_date.getTime() + frozenDays * 86400000)
            : membership.end_date;

          const newGraceEndDate = membership.grace_end_date && frozenDays > 0
            ? new Date(membership.grace_end_date.getTime() + frozenDays * 86400000)
            : membership.grace_end_date;

          await this.tenant.client.membershipFreeze.updateMany({
            where: { membership_id: membership.id, status: 'active' },
            data: { end_date: now, days_frozen: frozenDays, status: 'completed' },
          });

          await this.tenant.client.memberMembership.update({
            where: { id: membership.id },
            data: {
              status: 'active',
              end_date: newEndDate,
              grace_end_date: newGraceEndDate,
              freeze_start_date: null,
              freeze_end_date: null,
              freeze_reason: null,
            },
          });

          await this.tenant.client.member.update({
            where: { id: membership.member_id },
            data: { status: 'active' },
          });

          unfrozen++;
        }
      });

      this.logger.log(`Auto-unfroze ${unfrozen} memberships`);
      return { unfrozen };
    });
    if (!result) this.logger.debug('Auto-unfreeze skipped — another instance holds the lock');
    return result ?? { unfrozen: 0 };
  }

  // ── Manual triggers (for testing/admin) ─────────

  async runExpiryManually() {
    return this.handleMembershipExpiry();
  }

  async runAutoRenewManually() {
    return this.handleAutoRenewals();
  }
}
