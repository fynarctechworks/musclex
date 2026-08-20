/**
 * ────────────────────────────────────────────────────────────────
 * FRIENDS DEMO DATA
 * ────────────────────────────────────────────────────────────────
 *
 *   npx ts-node scripts/seed-friends.ts [--phone 9877000111 | --app-user <uuid>]
 *   npx ts-node scripts/seed-friends.ts --clean
 *
 * Gives one member a believable social graph so the friends screens can be
 * driven end to end: a feed with something in it, a request waiting to be
 * accepted, a routine in the inbox, and PRs that overlap theirs so the
 * comparison has real winners and losers rather than an empty list.
 *
 * Everything it writes lives in `public` and belongs to seeded accounts, so it
 * touches no gym schema and no real member's data.
 *
 * Idempotent: re-running updates the same seeded rows rather than piling up
 * duplicates. `--clean` removes every trace.
 *
 * REFUSES to run against a non-local database. This writes fake people with
 * fake phone numbers; on a real deployment they would be indistinguishable
 * from members and discoverable by anyone who guessed the number.
 */
import { PrismaClient as PublicClient } from '../node_modules/.prisma/client-public';

/** Seeded accounts are tagged by phone prefix so --clean can find them all. */
const PHONE_PREFIX = '99000000';

interface DemoFriend {
  phone: string;
  name: string;
  /** 'accepted' shows in the feed; 'incoming' leaves a request to accept. */
  relation: 'accepted' | 'incoming';
  sessions: { daysAgo: number; sets: number; exercises: string[]; volumeKg: number }[];
  /** Keyed on the lowercased exercise name, as the comparison matches. */
  prs: { exercise: string; kg: number; reps: number; daysAgo: number }[];
}

/**
 * PRs are chosen to straddle the member's own (Deadlift 110, Bench 80,
 * Archer Push Up 72.5, Back Squat 35): some ahead, some behind, one level, so
 * "N of M lifts where you are ahead" is not trivially 0 or all.
 */
const FRIENDS: DemoFriend[] = [
  {
    phone: `${PHONE_PREFIX}01`,
    name: 'Rahul Verma',
    relation: 'accepted',
    sessions: [
      { daysAgo: 0, sets: 14, exercises: ['Barbell Bench Press', 'Lever Shoulder Press', 'Cable Lateral Raise'], volumeKg: 5120 },
      { daysAgo: 2, sets: 18, exercises: ['Deadlift', 'Barbell Bent Over Row', 'Pull Up'], volumeKg: 7430 },
      { daysAgo: 5, sets: 12, exercises: ['Back Squat', 'Dumbbell Lunge'], volumeKg: 4260 },
    ],
    prs: [
      { exercise: 'deadlift', kg: 130, reps: 3, daysAgo: 12 },       // ahead of me
      { exercise: 'barbell bench press', kg: 72.5, reps: 5, daysAgo: 20 }, // behind me
      { exercise: 'back squat', kg: 35, reps: 10, daysAgo: 8 },      // level on weight
    ],
  },
  {
    phone: `${PHONE_PREFIX}02`,
    name: 'Priya Nair',
    relation: 'accepted',
    sessions: [
      { daysAgo: 1, sets: 16, exercises: ['Back Squat', 'Lever Lying Leg Curl', 'Dumbbell Lunge'], volumeKg: 6180 },
      { daysAgo: 4, sets: 9, exercises: ['Plank', 'Air Bike', 'Cross Body Crunch'], volumeKg: 0 },
    ],
    prs: [
      { exercise: 'back squat', kg: 60, reps: 8, daysAgo: 6 },       // ahead of me
      { exercise: 'archer push up', kg: 60, reps: 12, daysAgo: 15 }, // behind me
    ],
  },
  {
    phone: `${PHONE_PREFIX}03`,
    name: 'Arjun Menon',
    relation: 'accepted',
    sessions: [
      { daysAgo: 3, sets: 11, exercises: ['Barbell Bench Press', 'Dumbbell Bench Press'], volumeKg: 3890 },
    ],
    prs: [
      { exercise: 'barbell bench press', kg: 95, reps: 3, daysAgo: 30 }, // ahead of me
      { exercise: 'deadlift', kg: 100, reps: 5, daysAgo: 25 },           // behind me
    ],
  },
  {
    // No sessions or PRs: they have not accepted yet, so nothing of theirs
    // should be visible anywhere until the request is answered.
    phone: `${PHONE_PREFIX}04`,
    name: 'Sneha Iyer',
    relation: 'incoming',
    sessions: [],
    prs: [],
  },
];

/** A routine waiting in the inbox, so that screen is testable too. */
const SENT_ROUTINE = {
  from: `${PHONE_PREFIX}01`,
  name: "Rahul's Push Day",
  exercises: [
    { name: 'Barbell Bench Press', position: 0, targetRepsPerSet: [12, 10, 8], targetWeightPerSet: [50, 60, 70] },
    { name: 'Lever Shoulder Press', position: 1, targetSets: 3, targetReps: 10 },
    { name: 'Cable Lateral Raise', position: 2, targetSets: 3, targetReps: 15 },
  ],
};

const ago = (days: number) => new Date(Date.now() - days * 86_400_000);

function assertLocal(): void {
  const url = process.env.DATABASE_URL ?? '';
  const local = /localhost|127\.0\.0\.1/.test(url);
  if (!local) {
    console.error(
      'REFUSING: DATABASE_URL is not local.\n' +
        'This seeds fake people with fake phone numbers. On a real deployment they\n' +
        'would be indistinguishable from members and discoverable by phone search.',
    );
    process.exit(1);
  }
}

async function main() {
  assertLocal();
  const pub = new PublicClient();
  const clean = process.argv.includes('--clean');

  const phoneArg = process.argv.includes('--phone')
    ? process.argv[process.argv.indexOf('--phone') + 1]
    : '9877000111';
  const appUserArg = process.argv.includes('--app-user')
    ? process.argv[process.argv.indexOf('--app-user') + 1]
    : undefined;

  if (clean) {
    const seeded = await pub.appUser.findMany({
      where: { phone: { startsWith: PHONE_PREFIX } },
      select: { id: true },
    });
    const ids = seeded.map((s) => s.id);
    // Order matters only for readability: the FKs cascade from app_users.
    await pub.friendRoutineShare.deleteMany({
      where: { OR: [{ from_app_user_id: { in: ids } }, { to_app_user_id: { in: ids } }] },
    });
    await pub.sharedRoutine.deleteMany({ where: { name: { startsWith: "Rahul's" } } });
    await pub.appUser.deleteMany({ where: { id: { in: ids } } });
    console.log(`removed ${ids.length} seeded friends and everything attached to them`);
    return;
  }

  // Resolve "me".
  //
  // A phone can match MORE THAN ONE app_user: the column is documented as E.164
  // and unique, but rows exist both with and without a country code, so the
  // same human has two identities depending on how the number was submitted.
  // Seeding the wrong one is invisible — the app just shows an empty screen —
  // so when it is ambiguous this refuses rather than guessing, and --app-user
  // settles it. Pass the id the APP is signed in as, which is not necessarily
  // the most recently created.
  let me: { id: string; phone: string };
  if (appUserArg) {
    const found = await pub.appUser.findUnique({
      where: { id: appUserArg },
      select: { id: true, phone: true },
    });
    if (!found) {
      console.error(`No app_user with id ${appUserArg}.`);
      process.exit(1);
    }
    me = found;
  } else {
    const candidates = await pub.appUser.findMany({
      where: { phone: { endsWith: phoneArg } },
      select: { id: true, phone: true, last_active_at: true },
      orderBy: { last_active_at: 'desc' },
    });
    if (candidates.length === 0) {
      console.error(`No app_user found for phone ending ${phoneArg}.`);
      process.exit(1);
    }
    if (candidates.length > 1) {
      console.error(
        `Ambiguous: ${candidates.length} app_users match phone ending ${phoneArg}.\n` +
          candidates
            .map((c) => `  --app-user ${c.id}   phone ${c.phone}  last active ${c.last_active_at ?? 'never'}`)
            .join('\n') +
          '\n\nRe-run with --app-user <id> for the account the app is signed in as.',
      );
      process.exit(1);
    }
    me = candidates[0];
  }
  console.log(`me: ${me.id} (${me.phone})`);

  let sessionCount = 0;
  let prCount = 0;

  for (const f of FRIENDS) {
    const friend = await pub.appUser.upsert({
      where: { phone: f.phone },
      create: {
        phone: f.phone,
        full_name: f.name,
        // Seeded friends share by definition — otherwise there is nothing to
        // look at, which is the opposite of what demo data is for.
        share_sessions: true,
        share_prs: true,
      },
      update: { full_name: f.name, share_sessions: true, share_prs: true },
    });

    // Friendship. 'incoming' means THEY asked ME, so the request lands in my
    // list waiting to be accepted.
    const pair =
      f.relation === 'incoming'
        ? { requester_id: friend.id, addressee_id: me.id, status: 'pending' }
        : { requester_id: me.id, addressee_id: friend.id, status: 'accepted' };

    const existing = await pub.friendship.findFirst({
      where: {
        OR: [
          { requester_id: me.id, addressee_id: friend.id },
          { requester_id: friend.id, addressee_id: me.id },
        ],
      },
      select: { id: true },
    });
    if (existing) {
      await pub.friendship.update({
        where: { id: existing.id },
        data: { ...pair, responded_at: pair.status === 'accepted' ? new Date() : null },
      });
    } else {
      await pub.friendship.create({
        data: { ...pair, responded_at: pair.status === 'accepted' ? new Date() : null },
      });
    }

    // Sessions — replaced wholesale so re-running does not accumulate.
    await pub.appUserSession.deleteMany({ where: { app_user_id: friend.id } });
    for (const s of f.sessions) {
      await pub.appUserSession.create({
        data: {
          app_user_id: friend.id,
          performed_at: ago(s.daysAgo),
          set_count: s.sets,
          exercise_count: s.exercises.length,
          total_volume_kg: s.volumeKg > 0 ? s.volumeKg.toFixed(2) : null,
          exercise_names: s.exercises,
          duration_seconds: 45 * 60 + s.sets * 30,
        },
      });
      sessionCount++;
    }

    for (const p of f.prs) {
      await pub.appUserPr.upsert({
        where: {
          app_user_id_exercise_name: { app_user_id: friend.id, exercise_name: p.exercise },
        },
        create: {
          app_user_id: friend.id,
          exercise_name: p.exercise,
          weight_kg: p.kg.toFixed(2),
          reps: p.reps,
          achieved_at: ago(p.daysAgo),
        },
        update: { weight_kg: p.kg.toFixed(2), reps: p.reps, achieved_at: ago(p.daysAgo) },
      });
      prCount++;
    }

    console.log(
      `  ${f.name.padEnd(14)} ${f.relation.padEnd(9)} ${f.sessions.length} sessions, ${f.prs.length} PRs`,
    );
  }

  // A routine sitting in my inbox.
  const sender = await pub.appUser.findUnique({ where: { phone: SENT_ROUTINE.from } });
  if (sender) {
    const token = `demo${PHONE_PREFIX}`;
    await pub.sharedRoutine.upsert({
      where: { token },
      create: { token, name: SENT_ROUTINE.name, exercises: SENT_ROUTINE.exercises },
      update: { name: SENT_ROUTINE.name, exercises: SENT_ROUTINE.exercises },
    });
    const had = await pub.friendRoutineShare.findFirst({ where: { token, to_app_user_id: me.id } });
    if (!had) {
      await pub.friendRoutineShare.create({
        data: {
          from_app_user_id: sender.id,
          to_app_user_id: me.id,
          token,
          routine_name: SENT_ROUTINE.name,
        },
      });
    }
    console.log(`  routine in inbox: "${SENT_ROUTINE.name}"`);
  }

  console.log(
    `\nseeded ${FRIENDS.length} friends, ${sessionCount} sessions, ${prCount} PRs.\n` +
      'Note: YOUR sharing switches are untouched — turn them on in the app to\n' +
      'publish your own workouts, or the comparison will show only their side.',
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
