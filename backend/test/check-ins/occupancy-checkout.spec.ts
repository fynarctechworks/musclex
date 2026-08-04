import { CheckInsService } from '../../src/check-ins/check-ins.service';

/**
 * Occupancy must fall when someone leaves.
 *
 * The live head-count counted every successful check-in in a rolling 4h window
 * and never looked at check_out_at, while the "who's inside" list DID filter
 * it. So the tile and the list disagreed, and the kiosk's Check Out mode moved
 * neither. The 4h cutoff is only a fallback for members who never scan out; an
 * explicit check-out has to remove them immediately.
 */
describe('check-out → occupancy', () => {
  const openVisit = {
    id: 'ci-1',
    member_id: 'm-1',
    branch_id: 'b-1',
    status: 'success',
    checked_in_at: new Date('2026-08-04T06:00:00.000Z'),
    check_out_at: null,
  };

  const build = () => {
    const emitOccupancy = jest.fn().mockResolvedValue(undefined);
    const client = {
      member: { findFirst: jest.fn() },
      checkIn: {
        findFirst: jest.fn().mockResolvedValue(openVisit),
        update: jest.fn().mockResolvedValue({
          ...openVisit,
          gym_id: 'g-1',
          check_out_at: new Date('2026-08-04T07:00:00.000Z'),
          member: { full_name: 'A', member_code: 'M1', profile_photo_url: null },
          branch: { name: 'Main' },
        }),
        count: jest.fn(),
      },
    };
    const service = new CheckInsService(
      { client } as unknown as never,
      { process: jest.fn(), emitOccupancy } as unknown as never,
      {} as unknown as never,
    );
    return { service, client, emitOccupancy };
  };

  it('rebroadcasts occupancy after a check-out', async () => {
    const { service, emitOccupancy } = build();

    const res = await service.checkOut({ member_id: 'm-1', branch_id: 'b-1' });

    expect(res.success).toBe(true);
    expect(emitOccupancy).toHaveBeenCalledTimes(1);
    expect(emitOccupancy.mock.calls[0][1]).toBe('b-1');
  });

  it('does not fail the check-out when the broadcast throws', async () => {
    const { service, emitOccupancy } = build();
    emitOccupancy.mockRejectedValue(new Error('socket down'));

    // The member is physically leaving; a dead websocket must not block it.
    await expect(
      service.checkOut({ member_id: 'm-1', branch_id: 'b-1' }),
    ).resolves.toMatchObject({ success: true, duration_minutes: 60 });
  });

  it('does not rebroadcast when the visit was already closed', async () => {
    const { service, client, emitOccupancy } = build();
    client.checkIn.findFirst.mockResolvedValue({
      ...openVisit,
      check_out_at: new Date('2026-08-04T06:30:00.000Z'),
    });

    const res = await service.checkOut({ check_in_id: 'ci-1', branch_id: 'b-1' });

    expect(res).toMatchObject({ already_checked_out: true });
    expect(emitOccupancy).not.toHaveBeenCalled();
  });
});
