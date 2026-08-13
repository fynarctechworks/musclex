import { SubscriptionPolicyService } from './subscription-policy.service';

/**
 * Ledger semantics for scheduled plan changes: the LATEST event among
 * plan_change_scheduled / plan_change_unscheduled / renewed / plan_changed
 * decides whether a change is pending. A newer renewal or applied change
 * supersedes an earlier schedule automatically.
 */
describe('SubscriptionPolicyService scheduled plan changes', () => {
  const makeService = (latestEvent: unknown) => {
    const pub = {
      subscriptionEvent: {
        findFirst: jest.fn().mockResolvedValue(latestEvent),
        create: jest.fn().mockResolvedValue({}),
      },
    };
    const svc = new SubscriptionPolicyService(pub as any, {} as any);
    return { svc, pub };
  };

  const scheduledEvent = {
    event_type: 'plan_change_scheduled',
    plan_name: 'starter',
    billing_cycle: 'monthly',
    period_end: new Date('2026-07-31T00:00:00.000Z'),
    created_at: new Date('2026-07-10T00:00:00.000Z'),
    metadata: { previous_plan: 'pro' },
  };

  it('returns the pending change when the latest event is a schedule', async () => {
    const { svc } = makeService(scheduledEvent);
    const pending = await svc.getScheduledPlanChange('studio-1');
    expect(pending).toEqual({
      target_plan: 'starter',
      target_cycle: 'monthly',
      effective_at: new Date('2026-07-31T00:00:00.000Z'),
      scheduled_at: new Date('2026-07-10T00:00:00.000Z'),
      previous_plan: 'pro',
    });
  });

  it.each(['renewed', 'plan_changed', 'plan_change_unscheduled'])(
    'returns null when a newer %s event supersedes the schedule',
    async (eventType) => {
      const { svc } = makeService({ ...scheduledEvent, event_type: eventType });
      expect(await svc.getScheduledPlanChange('studio-1')).toBeNull();
    },
  );

  it('returns null when there is no relevant ledger history', async () => {
    const { svc } = makeService(null);
    expect(await svc.getScheduledPlanChange('studio-1')).toBeNull();
  });

  it('returns null for a malformed schedule without an effective date', async () => {
    const { svc } = makeService({ ...scheduledEvent, period_end: null });
    expect(await svc.getScheduledPlanChange('studio-1')).toBeNull();
  });

  it('stores effective_at in period_end so the cron can range-query due changes', async () => {
    const { svc, pub } = makeService(null);
    const effective = new Date('2026-07-31T00:00:00.000Z');
    await svc.schedulePlanChange({
      studio_id: 'studio-1',
      actor_id: 'user-1',
      target_plan: 'starter',
      target_cycle: 'monthly',
      effective_at: effective,
      previous_plan: 'pro',
      previous_cycle: 'monthly',
    });
    expect(pub.subscriptionEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        event_type: 'plan_change_scheduled',
        plan_name: 'starter',
        billing_cycle: 'monthly',
        period_end: effective,
      }),
    });
  });

  it('cancelScheduledPlanChange is a no-op returning null when nothing is pending', async () => {
    const { svc, pub } = makeService(null);
    expect(await svc.cancelScheduledPlanChange('studio-1', 'user-1')).toBeNull();
    expect(pub.subscriptionEvent.create).not.toHaveBeenCalled();
  });

  it('cancelScheduledPlanChange appends an unschedule event when a change is pending', async () => {
    const { svc, pub } = makeService(scheduledEvent);
    const cancelled = await svc.cancelScheduledPlanChange('studio-1', 'user-1');
    expect(cancelled).toEqual({
      target_plan: 'starter',
      target_cycle: 'monthly',
      effective_at: new Date('2026-07-31T00:00:00.000Z'),
    });
    expect(pub.subscriptionEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ event_type: 'plan_change_unscheduled' }),
    });
  });
});
