/**
 * ────────────────────────────────────────────────────────────────
 * EXPLORE LIBRARY SEED
 * ────────────────────────────────────────────────────────────────
 *
 *   npx ts-node scripts/seed-explore.ts [--verify <gymId>]
 *
 * The curated starter set every member sees. Idempotent: upserts on `slug`, so
 * editing a workout here and re-running updates it in place.
 *
 * Every exercise name below was checked against the imported library. A name
 * that does not resolve is not a crash — it is silently absent from the workout
 * for that member — so `--verify` re-checks them against a real gym rather than
 * trusting that they are still spelled right.
 */
import { PrismaClient as PublicClient, Prisma } from '../node_modules/.prisma/client-public';
import { PrismaClient } from '@prisma/client';

interface Entry {
  name: string;
  targetSets?: number;
  targetReps?: number;
  targetDurationSeconds?: number;
}

interface Workout {
  slug: string;
  title: string;
  description: string;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  durationMinutes: number;
  position: number;
  exercises: Entry[];
}

const WORKOUTS: Workout[] = [
  {
    slug: 'full-body-starter',
    title: 'Full Body Starter',
    description:
      'Three compound lifts that between them train almost everything. The best first programme for someone new to a gym floor.',
    category: 'full_body',
    difficulty: 'beginner',
    durationMinutes: 40,
    position: 0,
    exercises: [
      { name: 'Barbell Full Squat', targetSets: 3, targetReps: 8 },
      { name: 'Barbell Bench Press', targetSets: 3, targetReps: 8 },
      { name: 'Barbell Bent Over Row', targetSets: 3, targetReps: 10 },
    ],
  },
  {
    slug: 'full-body-strength',
    title: 'Full Body Strength',
    description:
      'Heavier and shorter. Five sets of five on the big three, with accessory work kept deliberately light.',
    category: 'full_body',
    difficulty: 'intermediate',
    durationMinutes: 55,
    position: 1,
    exercises: [
      { name: 'Barbell Full Squat', targetSets: 5, targetReps: 5 },
      { name: 'Barbell Deadlift', targetSets: 3, targetReps: 5 },
      { name: 'Barbell Bench Press', targetSets: 5, targetReps: 5 },
      { name: 'Pull Up', targetSets: 3, targetReps: 8 },
    ],
  },
  {
    slug: 'push-day',
    title: 'Push Day',
    description: 'Chest, shoulders and triceps. Presses first while you are fresh, raises after.',
    category: 'push',
    difficulty: 'intermediate',
    durationMinutes: 45,
    position: 0,
    exercises: [
      { name: 'Barbell Bench Press', targetSets: 4, targetReps: 8 },
      { name: 'Lever Shoulder Press', targetSets: 3, targetReps: 10 },
      { name: 'Dumbbell Bench Press', targetSets: 3, targetReps: 10 },
      { name: 'Cable Lateral Raise', targetSets: 3, targetReps: 15 },
    ],
  },
  {
    slug: 'pull-day',
    title: 'Pull Day',
    description: 'Back and biceps. A vertical pull and a horizontal pull, because they are not the same movement.',
    category: 'pull',
    difficulty: 'intermediate',
    durationMinutes: 45,
    position: 0,
    exercises: [
      { name: 'Barbell Deadlift', targetSets: 3, targetReps: 5 },
      { name: 'Pull Up', targetSets: 4, targetReps: 8 },
      { name: 'Barbell Bent Over Row', targetSets: 3, targetReps: 10 },
      { name: 'Dumbbell Biceps Curl', targetSets: 3, targetReps: 12 },
    ],
  },
  {
    slug: 'leg-day',
    title: 'Leg Day',
    description: 'Knee-dominant and hip-dominant work in the same session, so nothing gets skipped.',
    category: 'legs',
    difficulty: 'intermediate',
    durationMinutes: 50,
    position: 0,
    exercises: [
      { name: 'Barbell Full Squat', targetSets: 4, targetReps: 8 },
      { name: 'Lever Lying Leg Curl', targetSets: 3, targetReps: 12 },
      { name: 'Dumbbell Lunge', targetSets: 3, targetReps: 10 },
    ],
  },
  {
    slug: 'core-circuit',
    title: 'Core Circuit',
    description: 'Timed holds and controlled reps. Short, and harder than it looks written down.',
    category: 'core',
    difficulty: 'beginner',
    durationMinutes: 15,
    position: 0,
    exercises: [
      { name: 'Plank', targetSets: 3, targetDurationSeconds: 45 },
      { name: 'Air Bike', targetSets: 3, targetReps: 20 },
      { name: 'Cross Body Crunch', targetSets: 3, targetReps: 15 },
    ],
  },
  {
    slug: 'no-equipment-starter',
    title: 'No Equipment Starter',
    description: 'Nothing but the floor. For a busy gym, a hotel room, or a first week back.',
    category: 'bodyweight',
    difficulty: 'beginner',
    durationMinutes: 20,
    position: 0,
    exercises: [
      { name: 'Push Up', targetSets: 3, targetReps: 10 },
      { name: 'Split Squats', targetSets: 3, targetReps: 12 },
      { name: 'Plank', targetSets: 3, targetDurationSeconds: 30 },
      { name: 'Mountain Climber', targetSets: 3, targetDurationSeconds: 30 },
    ],
  },
  {
    slug: 'conditioning-15',
    title: '15-Minute Conditioning',
    description: 'Everything timed, minimal rest. Use it when you are short on time, not short on effort.',
    category: 'conditioning',
    difficulty: 'intermediate',
    durationMinutes: 15,
    position: 0,
    exercises: [
      { name: 'Burpee', targetSets: 4, targetDurationSeconds: 40 },
      { name: 'Mountain Climber', targetSets: 4, targetDurationSeconds: 40 },
      { name: 'Air Bike', targetSets: 4, targetDurationSeconds: 40 },
    ],
  },
];

async function main() {
  const verifyGym = process.argv.includes('--verify')
    ? process.argv[process.argv.indexOf('--verify') + 1]
    : undefined;

  const pub = new PublicClient();
  for (const w of WORKOUTS) {
    await pub.exploreWorkout.upsert({
      where: { slug: w.slug },
      create: {
        slug: w.slug,
        title: w.title,
        description: w.description,
        category: w.category,
        difficulty: w.difficulty,
        duration_minutes: w.durationMinutes,
        exercises: w.exercises as unknown as Prisma.InputJsonValue,
        position: w.position,
        is_published: true,
      },
      update: {
        title: w.title,
        description: w.description,
        category: w.category,
        difficulty: w.difficulty,
        duration_minutes: w.durationMinutes,
        exercises: w.exercises as unknown as Prisma.InputJsonValue,
        position: w.position,
        is_published: true,
      },
    });
  }
  console.log(`seeded ${WORKOUTS.length} Explore workouts`);

  if (verifyGym) {
    // A misspelled name is silently absent for every member, so check the
    // names actually resolve rather than assuming they still do.
    const prisma = new PrismaClient();
    const studio = await prisma.$queryRawUnsafe<{ schema_name: string }[]>(
      'SELECT schema_name FROM public.studios WHERE id = $1::uuid',
      verifyGym,
    );
    const schema = studio[0]?.schema_name;
    if (!schema) {
      console.error(`no studio for ${verifyGym}`);
    } else {
      let bad = 0;
      for (const w of WORKOUTS) {
        for (const e of w.exercises) {
          const hit = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
            `SELECT count(*)::bigint AS n FROM "${schema}".exercises WHERE lower(name) = lower($1)`,
            e.name,
          );
          if (Number(hit[0]?.n ?? 0) === 0) {
            console.error(`  MISSING in ${schema}: "${e.name}" (${w.slug})`);
            bad += 1;
          }
        }
      }
      console.log(bad ? `${bad} unresolved exercise names` : 'all exercise names resolve');
    }
    await prisma.$disconnect();
  }

  await pub.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
