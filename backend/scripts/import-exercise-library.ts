/**
 * ────────────────────────────────────────────────────────────────
 * EXERCISE LIBRARY IMPORTER
 * ────────────────────────────────────────────────────────────────
 *
 * Seeds a gym's exercise catalogue from the ExerciseGymGifsDB dataset
 * (1,323 exercises with GIFs, body part, target muscle, equipment,
 * secondary muscles and instructions).
 *
 * Solves the cold-start problem: a new gym currently opens to an EMPTY
 * picker until staff catalogue everything by hand, which makes the app look
 * broken on day one.
 *
 *   npx ts-node scripts/import-exercise-library.ts <gymId> [--dry]
 *
 * Idempotent: matches on (gym_id, name) and updates rather than duplicating,
 * so re-running after a dataset refresh is safe. Never deletes: an exercise a
 * gym added or edited by hand is left alone if it is not in the dataset.
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'node:fs';
import * as path from 'node:path';

const DATASET = path.resolve(__dirname, '../../ExerciseGymGifsDB-main/api/en/exercises.json');

interface Source {
  id: string;
  slug: string;
  name: string;
  muscle: string;
  bodyPart: string;
  equipment: string;
  category: string;
  secondaryMuscles: string[];
  instructions: string[];
  gifUrl: string;
  thumbUrl: string;
}

/** Dataset bodyPart -> our coarse muscle_group bucket. */
const BODY_PART: Record<string, string> = {
  arms: 'arms',
  back: 'back',
  cardio: 'cardio',
  chest: 'chest',
  core: 'core',
  legs: 'legs',
  shoulders: 'shoulders',
};

/** Dataset muscle -> our target_muscle keys, where they differ. */
const MUSCLE: Record<string, string> = {
  pectorals: 'mid_chest',
  spine: 'spinal_erectors',
  'upper-back': 'traps',
  'levator-scapulae': 'traps',
  'serratus-anterior': 'abs',
  cardiovascular: 'cardio',
};

/**
 * The dataset calls every shoulder exercise "delts" and every chest exercise
 * "pectorals" — it has no notion of which HEAD a movement drives. That split is
 * the whole point of our grouped picker, so derive it from the exercise name.
 *
 * This is a HEURISTIC on names, not data from the source. It is deliberately
 * conservative: anything it cannot place confidently keeps the dataset's coarse
 * value rather than guessing, because a wrong head is worse than a general one.
 */
function refineTarget(muscle: string, name: string): string {
  const n = name.toLowerCase();

  if (muscle === 'delts') {
    if (/(rear|reverse|posterior|face pull|bent[- ]over lateral)/.test(n)) return 'rear_delt';
    if (/(lateral raise|side raise|lateral-raise|upright row)/.test(n)) return 'side_delt';
    if (/(front raise|anterior|shoulder press|overhead press|military press|arnold)/.test(n))
      return 'front_delt';
    return 'front_delt'; // pressing dominates the remainder
  }

  if (muscle === 'pectorals') {
    if (/(incline|upper)/.test(n)) return 'upper_chest';
    if (/(decline|lower|dip)/.test(n)) return 'lower_chest';
    return 'mid_chest';
  }

  return MUSCLE[muscle] ?? muscle;
}

async function main() {
  const [gymId, ...flags] = process.argv.slice(2);
  const dry = flags.includes('--dry');
  if (!gymId) {
    console.error('usage: import-exercise-library <gymId> [--dry]');
    process.exit(1);
  }
  if (!fs.existsSync(DATASET)) {
    console.error(`dataset not found at ${DATASET}`);
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const studio = await prisma.$queryRawUnsafe<{ schema_name: string }[]>(
    'SELECT schema_name FROM public.studios WHERE id = $1::uuid',
    gymId,
  );
  const schema = studio[0]?.schema_name;
  if (!schema) {
    console.error(`no studio for gym ${gymId}`);
    process.exit(1);
  }

  const { exercises } = JSON.parse(fs.readFileSync(DATASET, 'utf8')) as { exercises: Source[] };
  console.log(`${exercises.length} exercises in dataset -> ${schema}`);

  // Counted from the table rather than from which branch each row took: the
  // branch counters disagreed with reality on a first run and an importer that
  // misreports what it changed is worse than one that reports nothing.
  const countRows = async () => {
    const r = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*)::bigint AS n FROM "${schema}".exercises WHERE gym_id = $1::uuid`,
      gymId,
    );
    return Number(r[0]?.n ?? 0);
  };
  const before = await countRows();


  for (const e of exercises) {
    const muscleGroup = BODY_PART[e.bodyPart] ?? null;
    const target = refineTarget(e.muscle, e.name);
    const instructions = e.instructions?.join('\n') || null;
    const secondary = e.secondaryMuscles ?? [];

    if (dry) continue;

    // Raw SQL: the tenant schema is not in the Prisma client's search path here,
    // and this runs outside the request-scoped tenant context. gym_id is bound
    // explicitly on every statement so a row can never land in another gym.
    const existing = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM "${schema}".exercises WHERE gym_id = $1::uuid AND lower(name) = lower($2) LIMIT 1`,
      gymId,
      e.name,
    );

    if (existing[0]) {
      await prisma.$executeRawUnsafe(
        `UPDATE "${schema}".exercises
           SET muscle_group = $3, target_muscle = $4, secondary_muscles = $5::text[],
               equipment = $6, media_url = $7, thumb_url = $8,
               instructions = COALESCE(instructions, $9), updated_at = now()
         WHERE id = $1::uuid AND gym_id = $2::uuid`,
        existing[0].id, gymId, muscleGroup, target, secondary,
        e.equipment, e.gifUrl, e.thumbUrl, instructions,
      );
    } else {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "${schema}".exercises
           (id, gym_id, name, muscle_group, target_muscle, secondary_muscles,
            tracking_type, equipment, media_url, thumb_url, instructions,
            is_active, created_at, updated_at)
         VALUES (gen_random_uuid(), $1::uuid, $2, $3, $4, $5::text[], $6, $7, $8, $9, $10, true, now(), now())`,
        gymId, e.name, muscleGroup, target, secondary,
        // Cardio is the one category that is reliably time-based.
        e.bodyPart === 'cardio' ? 'duration' : 'reps',
        e.equipment, e.gifUrl, e.thumbUrl, instructions,
      );
    }
  }

  const after = dry ? before : await countRows();
  console.log(
    dry
      ? `(dry run) ${exercises.length} would be imported`
      : `rows ${before} -> ${after} (+${after - before} new, ${exercises.length - (after - before)} matched existing)`,
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
