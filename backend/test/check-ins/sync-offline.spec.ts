import { CheckInsService } from '../../src/check-ins/check-ins.service';

/**
 * Regression cover for the offline-replay contract.
 *
 * The admin check-in page used to auto-sync by posting an EMPTY array and then
 * clearing its IndexedDB queue on success, so every check-in taken during an
 * outage was destroyed on reconnect. The client fix depends on three things
 * this service must guarantee, none of which had any test:
 *
 *   1. the real wall-clock time of the visit survives the replay,
 *   2. the client's row id is forwarded as the idempotency key,
 *   3. per-row outcomes come back so the client can drop exactly the rows the
 *      server decided on and KEEP the ones that merely failed in transit.
 */
describe('CheckInsService.syncOffline', () => {
  const makeService = (
    process: jest.Mock,
  ): { service: CheckInsService; process: jest.Mock } => {
    const orchestrator = { process } as unknown as never;
    const tenant = { client: {} } as unknown as never;
    const biometric = {} as unknown as never;
    return {
      service: new CheckInsService(tenant, orchestrator, biometric),
      process,
    };
  };

  const row = (over: Record<string, unknown> = {}) => ({
    member_id: '11111111-1111-4111-8111-111111111111',
    branch_id: '22222222-2222-4222-8222-222222222222',
    checkin_method: 'manual',
    checked_in_at: '2026-08-04T06:30:00.000Z',
    client_event_id: '33333333-3333-4333-8333-333333333333',
    ...over,
  });

  it('preserves the original check-in time instead of stamping "now"', async () => {
    const process = jest.fn().mockResolvedValue({ success: true });
    const { service } = makeService(process);

    await service.syncOffline('studio-1', [row()]);

    const input = process.mock.calls[0][0];
    expect(input.occurred_at).toEqual(new Date('2026-08-04T06:30:00.000Z'));
  });

  it('forwards the queued row id as the idempotency key', async () => {
    const process = jest.fn().mockResolvedValue({ success: true });
    const { service } = makeService(process);

    await service.syncOffline('studio-1', [row()]);

    expect(process.mock.calls[0][0].client_event_id).toBe(
      '33333333-3333-4333-8333-333333333333',
    );
  });

  it('marks a policy denial as decided, not retryable', async () => {
    // A frozen member will be denied every time — replaying that row forever
    // would wedge the queue, so the client must be told to drop it.
    const process = jest
      .fn()
      .mockResolvedValue({ success: false, failure_reason: 'membership_frozen' });
    const { service } = makeService(process);

    const res = await service.syncOffline('studio-1', [row()]);

    expect(res).toMatchObject({ synced: 0, failed: 1 });
    expect(res.results[0]).toMatchObject({
      ok: false,
      retryable: false,
      reason: 'membership_frozen',
    });
  });

  it('marks a thrown error as retryable so the client keeps the row', async () => {
    const process = jest.fn().mockRejectedValue(new Error('connection lost'));
    const { service } = makeService(process);

    const res = await service.syncOffline('studio-1', [row()]);

    expect(res.results[0]).toMatchObject({
      ok: false,
      retryable: true,
      reason: 'connection lost',
    });
  });

  it('reports each row independently so one failure cannot discard the rest', async () => {
    const process = jest
      .fn()
      .mockResolvedValueOnce({ success: true })
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ success: true });
    const { service } = makeService(process);

    const res = await service.syncOffline('studio-1', [
      row({ client_event_id: '33333333-3333-4333-8333-333333333331' }),
      row({ client_event_id: '33333333-3333-4333-8333-333333333332' }),
      row({ client_event_id: '33333333-3333-4333-8333-333333333333' }),
    ]);

    expect(res.synced).toBe(2);
    expect(res.failed).toBe(1);
    expect(res.results.map((r) => r.ok)).toEqual([true, false, true]);
    // The two that landed are droppable; the middle one must survive.
    expect(res.results.filter((r) => r.ok || !r.retryable)).toHaveLength(2);
  });
});
