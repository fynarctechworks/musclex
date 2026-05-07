import { Injectable, Inject, forwardRef, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DashboardGateway } from '../dashboard/dashboard.gateway';
import { getTenantGymId } from '../common/tenant-context';
import { DEFAULT_CURRENCY } from '../common/defaults';
import { DomainEventType } from './event-store.service';

/**
 * EventProjector — Reads domain events and projects them into materialized views.
 *
 * This is the ONLY component that writes to dashboard_metrics.
 * No service directly mutates metrics — they write events, the projector does the rest.
 *
 * Processing modes:
 *   1. Inline (sync)  — called immediately after transaction commit for low-latency updates
 *   2. Catchup (async) — cron job or manual trigger to process any missed events
 *   3. Replay (full)   — rebuild all metrics from event history (disaster recovery)
 */
@Injectable()
export class EventProjectorService {
  private readonly logger = new Logger(EventProjectorService.name);

  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => DashboardGateway)) private dashboardGateway: DashboardGateway,
  ) {}

  // ── Inline Processing (called right after tx commit) ──────────

  /**
   * Process a single event synchronously.
   * Called immediately after the transaction that created the event commits.
   * This gives sub-second dashboard updates without async workers.
   */
  async processEvent(event: {
    id: string;
    gym_id: string;
    event_type: string;
    payload: any;
    branch_id?: string | null;
    version: bigint;
  }): Promise<void> {
    const delta = this.computeDelta(event.event_type as DomainEventType, event.payload);
    if (!delta) {
      // Mark processed even if no metrics impact (e.g. unknown event type)
      await this.markProcessed(event.id, event.gym_id);
      return;
    }

    await this.applyDelta(event.gym_id, event.branch_id, delta, event.id, event.version);

    // Push to WebSocket — the projector is the ONLY thing that pushes metrics updates
    this.dashboardGateway.pushMetricsUpdate(event.gym_id, {
      ...delta,
      _version: Number(event.version),
      _event_type: event.event_type,
    });

    // Push activity item for user-facing events
    const activity = this.toActivity(event.event_type as DomainEventType, event.payload);
    if (activity) {
      this.dashboardGateway.pushActivityItem(event.gym_id, {
        ...activity,
        timestamp: new Date(),
      });
    }
  }

  // ── Catchup Processing (process all unprocessed events) ───────

  /**
   * Process all unprocessed events for the current gym.
   * Run on a cron or manually via POST /dashboard/catchup.
   * Returns count of events processed.
   */
  async catchup(): Promise<number> {
    const gymId = getTenantGymId();
    if (!gymId) return 0;

    let processed = 0;
    let hasMore = true;

    while (hasMore) {
      const events = await this.prisma.domainEvent.findMany({
        where: { gym_id: gymId, processed: false },
        orderBy: { version: 'asc' },
        take: 100,
      });

      if (events.length === 0) {
        hasMore = false;
        break;
      }

      for (const event of events) {
        try {
          await this.processEvent(event);
          processed++;
        } catch (err) {
          this.logger.error(
            `Failed to process event ${event.id} (${event.event_type}): ${(err as Error).message}`,
          );
          // Stop processing — don't skip events (ordering matters)
          hasMore = false;
          break;
        }
      }
    }

    if (processed > 0) {
      this.logger.log(`Catchup complete: ${processed} events processed for gym ${gymId}`);
    }
    return processed;
  }

  // ── Full Replay (rebuild from scratch) ────────────────────────

  /**
   * Rebuild all metrics from the event store.
   * Zeroes out counters and replays every event from version 0.
   * Use for disaster recovery or when metrics drift is suspected.
   */
  async replay(): Promise<{ events_replayed: number }> {
    const gymId = getTenantGymId();
    if (!gymId) return { events_replayed: 0 };

    this.logger.warn(`Starting FULL REPLAY for gym ${gymId} — this will reset all metrics`);

    // Reset all metrics rows for this gym
    await this.prisma.dashboardMetrics.updateMany({
      where: { gym_id: gymId },
      data: {
        total_members: 0,
        active_members: 0,
        total_staff: 0,
        active_staff: 0,
        total_revenue: 0,
        monthly_revenue: 0,
        check_ins_today: 0,
        check_ins_month: 0,
        expiring_memberships: 0,
        version: 0,
        last_event_id: null,
      },
    });

    // Mark all events as unprocessed
    await this.prisma.domainEvent.updateMany({
      where: { gym_id: gymId },
      data: { processed: false },
    });

    // Reprocess everything
    const count = await this.catchup();

    // Push full snapshot to connected clients
    const snapshot = await this.prisma.dashboardMetrics.findFirst({
      where: { gym_id: gymId, branch_id: null },
    });
    if (snapshot) {
      this.dashboardGateway.pushFullSnapshot(gymId, snapshot);
    }

    this.logger.log(`Full replay complete: ${count} events replayed for gym ${gymId}`);
    return { events_replayed: count };
  }

  // ── Delta Computation ─────────────────────────────────────────

  /**
   * Compute the metrics delta for a given event type.
   * Returns null if event has no metrics impact.
   */
  private computeDelta(
    eventType: DomainEventType,
    payload: any,
  ): Record<string, number> | null {
    switch (eventType) {
      case 'MEMBER_CREATED':
        return {
          total_members: 1,
          ...(payload.status === 'active' ? { active_members: 1 } : {}),
        };

      case 'MEMBER_ACTIVATED':
        return { active_members: 1 };

      case 'MEMBER_CANCELLED':
        return {
          ...(payload.was_active ? { active_members: -1 } : {}),
        };

      case 'MEMBER_FROZEN':
        return { active_members: -1 };

      case 'MEMBER_UNFROZEN':
        return { active_members: 1 };

      case 'MEMBER_EXPIRED':
        return { active_members: -1 };

      case 'STAFF_CREATED':
        return { total_staff: 1, active_staff: 1 };

      case 'STAFF_DEACTIVATED':
        return { active_staff: -1 };

      case 'STAFF_REACTIVATED':
        return { active_staff: 1 };

      case 'PAYMENT_RECORDED':
        return {
          _revenue: payload.amount || 0,
        };

      case 'CHECK_IN_COMPLETED':
        return {
          check_ins_today: 1,
          check_ins_month: 1,
        };

      case 'MEMBERSHIP_ASSIGNED':
      case 'MEMBERSHIP_RENEWED':
        return {}; // member count already handled by MEMBER_CREATED/ACTIVATED

      case 'MEMBERSHIP_CANCELLED':
      case 'MEMBERSHIP_EXPIRED':
        return { expiring_memberships: -1 };

      default:
        return null;
    }
  }

  /**
   * Convert event to activity feed item.
   */
  private toActivity(
    eventType: DomainEventType,
    payload: any,
  ): { type: string; message: string; member_name?: string } | null {
    switch (eventType) {
      case 'MEMBER_CREATED':
        return {
          type: 'member_created',
          message: `New member ${payload.full_name || ''} (${payload.member_code || ''}) added`,
          member_name: payload.full_name,
        };
      case 'STAFF_CREATED':
        return {
          type: 'staff_created',
          message: `New staff ${payload.full_name || ''} (${payload.role || ''}) added`,
        };
      case 'CHECK_IN_COMPLETED':
        return {
          type: 'check_in',
          message: `${payload.member_name || 'Member'} checked in via ${payload.method || 'unknown'}`,
          member_name: payload.member_name,
        };
      case 'PAYMENT_RECORDED':
        return {
          type: 'payment',
          message: `Payment of ${payload.currency || DEFAULT_CURRENCY} ${payload.amount || 0} recorded`,
        };
      default:
        return null;
    }
  }

  // ── Apply Delta to Metrics ────────────────────────────────────

  private async applyDelta(
    gymId: string,
    branchId: string | null | undefined,
    delta: Record<string, number>,
    eventId: string,
    eventVersion: bigint,
  ) {
    const revenueAmount = delta._revenue;
    delete delta._revenue;

    // Build the Prisma update data with increments (clamped via DB CHECK constraints)
    const updateData: Record<string, any> = {
      version: { increment: 1 },
      last_event_id: eventId,
    };

    for (const [field, value] of Object.entries(delta)) {
      if (value > 0) {
        updateData[field] = { increment: value };
      } else if (value < 0) {
        updateData[field] = { decrement: Math.abs(value) };
      }
    }

    // Revenue needs special handling (Decimal field)
    if (revenueAmount && revenueAmount > 0) {
      const currentMonth = new Date().toISOString().slice(0, 7);
      updateData.total_revenue = { increment: revenueAmount };
      updateData.monthly_revenue = { increment: revenueAmount };
      updateData.revenue_month = currentMonth;
    }

    // Ensure gym-wide row exists then update
    await this.ensureAndUpdate(gymId, null, updateData, eventId);

    // Ensure branch-level row exists then update
    if (branchId) {
      await this.ensureAndUpdate(gymId, branchId, updateData, eventId);
    }

    // Mark event as processed
    await this.markProcessed(eventId, gymId);
  }

  private async ensureAndUpdate(
    gymId: string,
    branchId: string | null,
    updateData: Record<string, any>,
    eventId: string,
  ) {
    // Upsert: create if missing, update if exists
    try {
      await this.prisma.dashboardMetrics.upsert({
        where: {
          gym_id_branch_id: { gym_id: gymId, branch_id: branchId as any },
        },
        create: {
          gym_id: gymId,
          branch_id: branchId,
          version: 1,
          last_event_id: eventId,
        },
        update: updateData,
      });
    } catch (e: any) {
      // If upsert fails on unique constraint race, retry with plain update
      if (e.code === 'P2002') {
        await this.prisma.dashboardMetrics.updateMany({
          where: { gym_id: gymId, branch_id: branchId },
          data: updateData,
        });
      } else {
        throw e;
      }
    }
  }

  private async markProcessed(eventId: string, gymId: string) {
    await this.prisma.domainEvent.update({
      where: { id: eventId },
      data: { processed: true },
    });
  }
}
