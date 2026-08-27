import { MemberRoutineScheduleService } from './member-routine-schedule.service';

/**
 * ────────────────────────────────────────────────────────────────
 * ROUTINE SCHEDULE
 * ────────────────────────────────────────────────────────────────
 *
 * Two things here are worth pinning because they are wrong SILENTLY: the
 * weekday a member's day resolves to, and whether yesterday counts as missed.
 * Neither throws when it is wrong — the member is simply shown the wrong
 * workout, or nagged about a session they actually did.
 */

const MEMBER = { memberId: 'm1', tenantId: 'g1', appUserId: 'a1', isGymMember: true } as any;

const routineRow = (id: string, name: string, exercises = 4) => ({
  routine: { id, name, _count: { exercises } },
});

/** A prisma double whose schedule is a plain weekday -> routine map. */
function prismaWith(opts: {
  schedule?: Record<number, { id: string; name: string }>;
  offsetDays?: number;
  logs?: { routine_id: string; logged_at: Date }[];
}) {
  const schedule = opts.schedule ?? {};
  const logs = opts.logs ?? [];
  return {
    member: {
      findFirst: jest.fn().mockResolvedValue({ schedule_offset_days: opts.offsetDays ?? 0 }),
      update: jest.fn().mockResolvedValue({}),
    },
    memberRoutineSchedule: {
      findFirst: jest.fn().mockImplementation(({ where }: any) => {
        // `hasSchedule` asks without a weekday; a day lookup asks with one.
        if (where.weekday === undefined) {
          const any = Object.keys(schedule)[0];
          return Promise.resolve(any === undefined ? null : { id: 'row' });
        }
        const hit = schedule[where.weekday];
        return Promise.resolve(hit ? routineRow(hit.id, hit.name) : null);
      }),
      findMany: jest.fn().mockResolvedValue(
        Object.entries(schedule).map(([weekday, r]) => ({
          weekday: Number(weekday),
          ...routineRow(r.id, r.name),
        })),
      ),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    memberRoutine: {
      findFirst: jest.fn().mockResolvedValue({ id: 'r-own' }),
    },
    workoutLog: {
      findFirst: jest.fn().mockImplementation(({ where }: any) => {
        const hit = logs.find(
          (l) =>
            l.routine_id === where.routine_id &&
            l.logged_at >= where.logged_at.gte &&
            l.logged_at < where.logged_at.lt,
        );
        return Promise.resolve(hit ? { id: 'log' } : null);
      }),
    },
  };
}

const make = (prisma: any) =>
  new MemberRoutineScheduleService({ client: prisma } as any);

describe('what to train today', () => {
  afterEach(() => jest.useRealTimers());

  it('is nothing set up — not a rest day — when there is no schedule at all', async () => {
    const plan = await make(prismaWith({})).getTodayPlan(MEMBER);
    // The distinction the old card could not make. "Unscheduled" invites the
    // member to build a week; "rest day" would be a lie about a week they
    // never made.
    expect(plan).toEqual({ routine: null, restDay: false, unscheduled: true });
  });

  it('is a rest day when a schedule exists but this weekday is empty', async () => {
    // Wed 2026-08-26 12:00Z. Only Monday (1) is scheduled.
    jest.useFakeTimers().setSystemTime(new Date('2026-08-26T12:00:00Z'));
    const plan = await make(
      prismaWith({ schedule: { 1: { id: 'r-mon', name: 'Push' } } }),
    ).getTodayPlan(MEMBER);
    expect(plan).toEqual({ routine: null, restDay: true, unscheduled: false });
  });

  it('is the routine scheduled for the member\'s own weekday', async () => {
    // Wednesday = 3.
    jest.useFakeTimers().setSystemTime(new Date('2026-08-26T12:00:00Z'));
    const plan = await make(
      prismaWith({ schedule: { 3: { id: 'r-wed', name: 'Legs' } } }),
    ).getTodayPlan(MEMBER);
    expect(plan.routine).toEqual({ routineId: 'r-wed', name: 'Legs', exerciseCount: 4 });
  });

  /*
    The timezone case. 01:30 on Thursday in IST is 20:00 on WEDNESDAY in UTC —
    so a server reading its own clock would show Wednesday's workout to someone
    for whom it is already Thursday. The member's day is the only one that
    matters here.
  */
  it("uses the member's weekday, not the server's", async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-26T20:00:00Z')); // Wed 20:00Z
    const prisma = prismaWith({
      schedule: { 3: { id: 'r-wed', name: 'Legs' }, 4: { id: 'r-thu', name: 'Pull' } },
    });
    const svc = make(prisma);

    const utc = await svc.getTodayPlan(MEMBER, 0);
    expect(utc.routine?.name).toBe('Legs'); // still Wednesday in UTC

    const ist = await svc.getTodayPlan(MEMBER, 330); // 01:30 Thursday in IST
    expect(ist.routine?.name).toBe('Pull');
  });
});

describe('the offset, which is what makes shifting reversible', () => {
  afterEach(() => jest.useRealTimers());

  it('shows yesterday\'s slot today when the member is one day behind', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-26T12:00:00Z')); // Wednesday
    const plan = await make(
      prismaWith({
        schedule: { 2: { id: 'r-tue', name: 'Pull' }, 3: { id: 'r-wed', name: 'Legs' } },
        offsetDays: 1,
      }),
    ).getTodayPlan(MEMBER);
    // A day behind: Wednesday resolves to what Tuesday held.
    expect(plan.routine?.name).toBe('Pull');
  });

  it('wraps without going negative', async () => {
    // Sunday (0) with an offset of 1 must resolve to Saturday (6), not -1 —
    // JavaScript's % returns a negative here and would match no row at all,
    // silently turning every Sunday into a rest day.
    jest.useFakeTimers().setSystemTime(new Date('2026-08-30T12:00:00Z')); // Sunday
    const plan = await make(
      prismaWith({ schedule: { 6: { id: 'r-sat', name: 'Saturday session' } }, offsetDays: 1 }),
    ).getTodayPlan(MEMBER);
    expect(plan.routine?.name).toBe('Saturday session');
  });

  it('advances the offset when a missed session is resumed', async () => {
    const prisma = prismaWith({ offsetDays: 2 });
    const res = await make(prisma).resumeMissed(MEMBER);
    expect(res.offsetDays).toBe(3);
    expect(prisma.member.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { schedule_offset_days: 3 } }),
    );
  });

  it('wraps the offset at a week rather than counting up forever', async () => {
    // Beyond a week the member has not "slipped a few days", they have stopped
    // following the schedule; an unbounded counter would wander their week.
    const res = await make(prismaWith({ offsetDays: 6 })).resumeMissed(MEMBER);
    expect(res.offsetDays).toBe(0);
  });

  it('resets to the week the member actually chose', async () => {
    const prisma = prismaWith({ offsetDays: 4 });
    const res = await make(prisma).resetShift(MEMBER);
    expect(res.offsetDays).toBe(0);
    expect(prisma.member.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { schedule_offset_days: 0 } }),
    );
  });

  it('leaves the week alone when the member skips instead', async () => {
    const prisma = prismaWith({ offsetDays: 2 });
    const res = await make(prisma).skipMissed(MEMBER);
    expect(res.offsetDays).toBe(2);
    expect(prisma.member.update).not.toHaveBeenCalled();
  });
});

describe('the missed-day prompt', () => {
  afterEach(() => jest.useRealTimers());

  it('says nothing when yesterday was a rest day', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-26T12:00:00Z')); // Wed; Tue = 2
    const missed = await make(
      prismaWith({ schedule: { 3: { id: 'r-wed', name: 'Legs' } } }),
    ).getMissedYesterday(MEMBER);
    expect(missed).toBeNull();
  });

  it('reports yesterday\'s routine when it was planned and not done', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-26T12:00:00Z')); // Wednesday
    const missed = await make(
      prismaWith({ schedule: { 2: { id: 'r-tue', name: 'Pull' } } }),
    ).getMissedYesterday(MEMBER);
    expect(missed).toEqual({
      routine: { routineId: 'r-tue', name: 'Pull', exerciseCount: 4 },
      date: '2026-08-25',
      weekdayName: 'Tuesday',
    });
  });

  it('says nothing when that routine was actually logged yesterday', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-26T12:00:00Z'));
    const missed = await make(
      prismaWith({
        schedule: { 2: { id: 'r-tue', name: 'Pull' } },
        logs: [{ routine_id: 'r-tue', logged_at: new Date('2026-08-25T18:00:00Z') }],
      }),
    ).getMissedYesterday(MEMBER);
    expect(missed).toBeNull();
  });

  /*
    Provenance is the whole reason workout_logs gained routine_id. Without it
    the only answerable question was "did they train at all yesterday", and an
    ad-hoc swim would have counted as leg day — then shifted a whole week's
    plan on the strength of it.
  */
  it('still reports missed when yesterday\'s session was a DIFFERENT routine', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-26T12:00:00Z'));
    const missed = await make(
      prismaWith({
        schedule: { 2: { id: 'r-tue', name: 'Pull' } },
        logs: [{ routine_id: 'r-other', logged_at: new Date('2026-08-25T18:00:00Z') }],
      }),
    ).getMissedYesterday(MEMBER);
    expect(missed?.routine.name).toBe('Pull');
  });
});

describe('editing the week', () => {
  it('refuses to schedule a routine the member does not own', async () => {
    const prisma = prismaWith({});
    // The id arrives from the client; without this gate a member could schedule
    // — and so read the name and exercise count of — someone else's routine.
    prisma.memberRoutine.findFirst = jest.fn().mockResolvedValue(null);
    await expect(make(prisma).setDay(MEMBER, 1, 'not-mine')).rejects.toThrow(/not found/i);
    expect(prisma.memberRoutineSchedule.create).not.toHaveBeenCalled();
  });

  it('rejects a weekday outside 0-6', async () => {
    await expect(make(prismaWith({})).setDay(MEMBER, 9 as any, 'r-own')).rejects.toThrow(
      /weekday/i,
    );
  });

  it('clears the day when given a null routine — that is a rest day', async () => {
    const prisma = prismaWith({});
    await make(prisma).setDay(MEMBER, 3, null);
    expect(prisma.memberRoutineSchedule.deleteMany).toHaveBeenCalledWith({
      where: { member_id: 'm1', weekday: 3 },
    });
  });

  it('stamps the gym on a newly scheduled day', async () => {
    const prisma = prismaWith({});
    prisma.memberRoutineSchedule.findFirst = jest.fn().mockResolvedValue(null);
    await make(prisma).setDay(MEMBER, 1, 'r-own');
    expect(prisma.memberRoutineSchedule.create).toHaveBeenCalledWith({
      data: { gym_id: 'g1', member_id: 'm1', routine_id: 'r-own', weekday: 1 },
    });
  });

  it('returns all seven days, with the empty ones null', async () => {
    const week = await make(
      prismaWith({ schedule: { 1: { id: 'r-mon', name: 'Push' } }, offsetDays: 0 }),
    ).getSchedule(MEMBER);
    expect(week.days).toHaveLength(7);
    expect(week.days[1].routine?.name).toBe('Push');
    expect(week.days[0].routine).toBeNull();
  });
});
