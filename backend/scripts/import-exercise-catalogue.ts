/**
 * ────────────────────────────────────────────────────────────────
 * EXERCISE CATALOGUE IMPORT
 * ────────────────────────────────────────────────────────────────
 *
 * Seeds a gym's exercise library from the ExerciseGymGifsDB metadata.
 *
 * WHY THIS EXISTS: a new gym opens to an EMPTY exercise library until staff
 * populate it by hand, which makes the member app look broken on day one. This
 * imports 1,323 classified exercises so a gym starts usable.
 *
 * WHAT IT IMPORTS — classification only:
 *   name, muscle_group (bodyPart), target_muscle (muscle), secondary_muscles,
 *   equipment, tracking_type (derived from category)
 *
 * WHAT IT DELIBERATELY DOES NOT IMPORT — media_url and instructions.
 * That dataset's own README states the GIFs were "extraídos de Internet", that
 * the author does not hold their copyright and "cannot grant rights over them
 * to third parties", and the repo carries no LICENSE. The instruction prose
 * came from the same scrape. Shipping either to paying gyms would distribute
 * content we have no right to.
 *
 * Those two columns are left NULL on purpose. A licensed set (ExerciseDB.io,
 * $299, whose field names match this schema one-for-one) drops straight into
 * them without touching anything imported here.
 *
 * Idempotent: matches on (gym_id, name) and updates classification rather than
 * inserting duplicates, so re-running after a dataset update is safe.
 *
 *   npx ts-node scripts/import-exercise-catalogue.ts <gymId> [--all-gyms]
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';

const DATASET = join(__dirname, '../../ExerciseGymGifsDB-main/api/en/exercises.json');

interface SourceExercise {
  name: string;
  muscle: string;
  bodyPart: string;
  equipment: string;
  category: string;
  secondaryMuscles?: string[];
}

/** Their bodyPart vocabulary onto ours. Both are 7 buckets and align 1:1. */
const MUSCLE_GROUP: Record<string, string> = {
  arms: 'arms',
  back: 'back',
  cardio: 'cardio',
  chest: 'chest',
  core: 'core',
  legs: 'legs',
  shoulders: 'shoulders',
};

/**
 * Their `muscle` is finer than our `muscle_group` but still coarser than the
 * heads our picker groups by: "delts" rather than front/side/rear. Where the
 * exercise NAME states the head, prefer it — that is the whole point of the
 * head-level split, and the name is the only place the data carries it.
 */
function targetMuscle(e: SourceExercise): string {
  const n = e.name.toLowerCase();
  if (e.muscle === 'delts') {
    if (/\b(front|anterior)\b/.test(n)) return 'front_delt';
    if (/\b(rear|reverse|posterior|bent[- ]over)\b/.test(n)) return 'rear_delt';
    if (/\b(lateral|side)\b/.test(n)) return 'side_delt';
    return 'front_delt'; // presses drive the anterior head
  }
  if (e.muscle === 'pectorals') {
    if (/\bincline\b/.test(n)) return 'upper_chest';
    if (/\bdecline\b/.test(n)) return 'lower_chest';
    return 'mid_chest';
  }
  if (e.muscle === 'spine') return 'spinal_erectors';
  if (e.muscle === 'upper-back') return 'traps';
  return e.muscle.replace(/-/g, '_');
}

/** Cardio and held stretches are timed; everything else is reps. */
const trackingType = (e: SourceExercise) =>
  e.category === 'cardio' || e.category === 'stretching' ? 'duration' : 'reps';

async function main() {
  const [gymArg, flag] = process.argv.slice(2);
  const allGyms = flag === '--all-gyms' || gymArg === '--all-gyms';
  if (!gymArg) {
    console.error('usage: import-exercise-catalogue.ts <gymId> | --all-gyms');
    process.exit(1);
  }

  const raw = JSON.parse(readFileSync(DATASET, 'utf8'));
  const source: SourceExercise[] = Array.isArray(raw) ? raw : raw.exercises;
  console.log(`dataset: ${source.length} exercises`);

  const prisma = new PrismaClient();
  const studios = allGyms
    ? await prisma.$queryRawUnsafe<{ id: string; schema_name: string; name: string }[]>(
        'SELECT id, schema_name, name FROM public.studios ORDER BY created_at',
      )
    : await prisma.$queryRawUnsafe<{ id: string; schema_name: string; name: string }[]>(
        'SELECT id, schema_name, name FROM public.studios WHERE id = $1::uuid',
        gymArg,
      );

  if (!studios.length) {
    console.error('no matching gym');
    process.exit(1);
  }

  for (const studio of studios) {
    let inserted = 0;
    let updated = 0;

    for (const e of source) {
      const group = MUSCLE_GROUP[e.bodyPart];
      if (!group) continue; // unknown bucket: skip rather than guess

      // Raw SQL because the catalogue lives in a per-gym schema and Prisma's
      // generated queries are schema-qualified to the tenant client's default.
      const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
        `SELECT id FROM "${studio.schema_name}".exercises WHERE gym_id = $1::uuid AND name = $2 LIMIT 1`,
        studio.id,
        e.name,
      );

      const secondary = (e.secondaryMuscles ?? []).map((m) => m.replace(/-/g, '_'));

      if (rows.length) {
        await prisma.$executeRawUnsafe(
          `UPDATE "${studio.schema_name}".exercises
             SET muscle_group = $2, target_muscle = $3, secondary_muscles = $4::text[],
                 equipment = $5, tracking_type = $6, updated_at = now()
           WHERE id = $1::uuid`,
          rows[0].id,
          group,
          targetMuscle(e),
          secondary,
          e.equipment,
          trackingType(e),
        );
        updated += 1;
      } else {
        await prisma.$executeRawUnsafe(
          `INSERT INTO "${studio.schema_name}".exercises
             (id, gym_id, name, muscle_group, target_muscle, secondary_muscles,
              equipment, tracking_type, is_active, created_at, updated_at)
           VALUES (gen_random_uuid(), $1::uuid, $2, $3, $4, $5::text[], $6, $7, true, now(), now())`,
          studio.id,
          e.name,
          group,
          targetMuscle(e),
          secondary,
          e.equipment,
          trackingType(e),
        );
        inserted += 1;
      }
    }

    console.log(`${studio.name}: +${inserted} new, ${updated} updated`);
  }

  await prisma.$disconnect();
  console.log('\nmedia_url and instructions left NULL — fill from a licensed set.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
