import { Injectable, Logger } from '@nestjs/common';
import { TenantPrisma } from '../prisma/tenant-prisma.accessor';
import { getTenantGymId } from '../common/tenant-context';

/**
 * Known domain event types.
 * Each event is an immutable fact that happened in the system.
 */
export type DomainEventType =
  // Member lifecycle
  | 'MEMBER_CREATED'
  | 'MEMBER_ACTIVATED'
  | 'MEMBER_FROZEN'
  | 'MEMBER_UNFROZEN'
  | 'MEMBER_CANCELLED'
  | 'MEMBER_EXPIRED'
  // Staff lifecycle
  | 'STAFF_CREATED'
  | 'STAFF_DEACTIVATED'
  | 'STAFF_REACTIVATED'
  // Membership
  | 'MEMBERSHIP_ASSIGNED'
  | 'MEMBERSHIP_RENEWED'
  | 'MEMBERSHIP_FROZEN'
  | 'MEMBERSHIP_UNFROZEN'
  | 'MEMBERSHIP_CANCELLED'
  | 'MEMBERSHIP_EXPIRED'
  // Financial
  | 'PAYMENT_RECORDED'
  | 'PAYMENT_REFUNDED'
  | 'REVENUE_ADDED'
  // Operations
  | 'CHECK_IN_COMPLETED'
  | 'CLASS_BOOKED'
  | 'CLASS_CANCELLED'
  | 'WAITLIST_PROMOTED'
  // Branch lifecycle
  | 'BRANCH_INITIALIZED';

export type AggregateType =
  | 'member'
  | 'staff'
  | 'payment'
  | 'check_in'
  | 'membership'
  | 'class_booking'
  | 'branch';

export interface DomainEventInput {
  aggregate_type: AggregateType;
  aggregate_id: string;
  event_type: DomainEventType;
  payload: Record<string, unknown>;
  actor_id?: string;
  branch_id?: string | null;
}

/**
 * EventStoreService — Append-only domain event log.
 *
 * Rules:
 *   1. Events are ALWAYS written inside the same transaction as the entity mutation.
 *   2. Event writes NEVER fail silently — if the event can't be written, the mutation rolls back.
 *   3. Events are immutable — never update or delete.
 *   4. The projector is the ONLY thing that reads events to update derived state.
 */
@Injectable()
export class EventStoreService {
  private readonly logger = new Logger(EventStoreService.name);

  constructor(private readonly tenant: TenantPrisma) {}

  /**
   * Write a domain event inside a transaction.
   * The `tx` parameter MUST be a Prisma transaction client from `$transaction()`.
   *
   * This is the ONLY way to write events — ensuring atomicity with the entity mutation.
   */
  async emit(tx: any, event: DomainEventInput): Promise<{ id: string; version: bigint }> {
    const gymId = getTenantGymId();
    if (!gymId) {
      throw new Error('Cannot emit domain event without gym_id in tenant context');
    }

    const created = await tx.domainEvent.create({
      data: {
        gym_id: gymId,
        aggregate_type: event.aggregate_type,
        aggregate_id: event.aggregate_id,
        event_type: event.event_type,
        payload: event.payload,
        actor_id: event.actor_id,
        branch_id: event.branch_id,
        processed: false,
      },
      select: { id: true, version: true },
    });

    this.logger.debug(
      `Event emitted: ${event.event_type} on ${event.aggregate_type}:${event.aggregate_id} (event_id=${created.id})`,
    );

    return created;
  }

  /**
   * Emit multiple events in a single transaction.
   */
  async emitMany(tx: any, events: DomainEventInput[]): Promise<{ id: string; version: bigint }[]> {
    const results: { id: string; version: bigint }[] = [];
    for (const event of events) {
      results.push(await this.emit(tx, event));
    }
    return results;
  }

  /**
   * Get unprocessed events for the current gym, ordered by version.
   * Used by the projector.
   */
  async getUnprocessed(limit = 100): Promise<any[]> {
    const gymId = getTenantGymId();
    if (!gymId) return [];

    return this.tenant.client.domainEvent.findMany({
      where: { gym_id: gymId, processed: false },
      orderBy: { version: 'asc' },
      take: limit,
    });
  }

  /**
   * Get all events for a specific aggregate (event history).
   */
  async getHistory(aggregateType: AggregateType, aggregateId: string): Promise<any[]> {
    return this.tenant.client.domainEvent.findMany({
      where: { aggregate_type: aggregateType, aggregate_id: aggregateId },
      orderBy: { version: 'asc' },
    });
  }

  /**
   * Get events after a specific version (cursor-based replay).
   */
  async getAfterVersion(afterVersion: bigint, limit = 500): Promise<any[]> {
    const gymId = getTenantGymId();
    if (!gymId) return [];

    return this.tenant.client.domainEvent.findMany({
      where: {
        gym_id: gymId,
        version: { gt: afterVersion },
      },
      orderBy: { version: 'asc' },
      take: limit,
    });
  }
}
