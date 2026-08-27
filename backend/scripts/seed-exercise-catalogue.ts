/**
 * ────────────────────────────────────────────────────────────────
 * SEED THE EXERCISE CATALOGUE INTO EVERY GYM
 * ────────────────────────────────────────────────────────────────
 *
 *   npx ts-node scripts/seed-exercise-catalogue.ts [--gym <id>] [--dry-run]
 *
 * Does exactly what `POST /exercises/seed-defaults` does once the backend is
 * deployed — same committed catalogue, same media URLs — but over a direct
 * Postgres connection, so illustrations can go live BEFORE a deploy.
 *
 * Needs DATABASE_URL (Supabase → Project Settings → Database → Connection
 * string → URI) and SUPABASE_URL, which is what the media origin is built
 * from. Put both in the gitignored `backend/.env.remote` and run with
 * `-r dotenv/config dotenv_config_path=.env.remote`.
 *
 * Idempotent, and safe on a gym that already has a curated library:
 *   - inserts only names the gym does not have
 *   - fills media ONLY where both columns are empty, so a gym's own uploaded
 *     illustration is never overwritten
 */
import { PrismaClient } from '@prisma/client';
import { EXERCISE_CATALOGUE } from '../src/plans/exercise-catalogue.data';

const CHUNK = 200;

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const gymId = args.includes('--gym') ? args[args.indexOf('--gym') + 1] : undefined;

  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
  if (!process.env.DATABASE_URL || !supabaseUrl) {
    console.error('DATABASE_URL and SUPABASE_URL are required');
    process.exit(1);
  }
  const base = `${supabaseUrl}/storage/v1/object/public/exercise-media`;

  const prisma = new PrismaClient();
  const studios = await prisma.$queryRawUnsafe<{ id: string; schema_name: string; name: string }[]>(
    gymId
      ? 'SELECT id, schema_name, name FROM public.studios WHERE id = $1::uuid'
      : 'SELECT id, schema_name, name FROM public.studios ORDER BY created_at',
    ...(gymId ? [gymId] : []),
  );
  if (!studios.length) {
    console.error('no matching gym');
    process.exit(1);
  }

  console.log(`catalogue: ${EXERCISE_CATALOGUE.length} exercises -> ${studios.length} gym(s)`);
  if (dryRun) console.log('DRY RUN — nothing will be written\n');

  for (const s of studios) {
    const existing = await prisma.$queryRawUnsafe<{ name: string }[]>(
      `SELECT name FROM "${s.schema_name}".exercises WHERE gym_id = $1::uuid`,
      s.id,
    );
    const have = new Set(existing.map((r) => r.name));
    const toCreate = EXERCISE_CATALOGUE.filter((e) => !have.has(e.name));

    if (dryRun) {
      console.log(`  ${s.name}: has ${have.size}, would insert ${toCreate.length}`);
      continue;
    }

    let inserted = 0;
    for (let i = 0; i < toCreate.length; i += CHUNK) {
      const batch = toCreate.slice(i, i + CHUNK);
      // Parameterised, not interpolated: exercise names contain apostrophes
      // ("Farmer's Walk"), and hand-quoting 1,323 of them into one statement
      // is exactly how an injection or a syntax error gets in.
      const values = batch
        .map((_, k) => {
          const b = k * 9;
          return `($${b + 1}::uuid,$${b + 2},$${b + 3},$${b + 4},$${b + 5}::text[],$${b + 6},$${b + 7},$${b + 8},$${b + 9})`;
        })
        .join(',');
      const params = batch.flatMap((e) => [
        s.id, e.name, e.muscle_group, e.target_muscle, e.secondary_muscles,
        e.equipment, e.tracking_type,
        e.media_path ? `${base}/${e.media_path}` : null,
        e.thumb_path ? `${base}/${e.thumb_path}` : null,
      ]);
      inserted += await prisma.$executeRawUnsafe(
        `INSERT INTO "${s.schema_name}".exercises
           (gym_id,name,muscle_group,target_muscle,secondary_muscles,equipment,tracking_type,media_url,thumb_url)
         VALUES ${values} ON CONFLICT DO NOTHING`,
        ...params,
      );
    }

    // Rows that predate illustrations: same movements, no pictures.
    const filled = await prisma.$executeRawUnsafe(
      `UPDATE "${s.schema_name}".exercises e SET
         media_url = $2 || '/' || c.media_path,
         thumb_url = $2 || '/' || c.thumb_path,
         updated_at = now()
       FROM (SELECT unnest($3::text[]) AS name,
                    unnest($4::text[]) AS media_path,
                    unnest($5::text[]) AS thumb_path) c
       WHERE e.gym_id = $1::uuid AND e.name = c.name
         AND e.media_url IS NULL AND e.thumb_url IS NULL`,
      s.id,
      base,
      EXERCISE_CATALOGUE.map((e) => e.name),
      EXERCISE_CATALOGUE.map((e) => e.media_path ?? ''),
      EXERCISE_CATALOGUE.map((e) => e.thumb_path ?? ''),
    );

    // Rows that predate muscle heads have target_muscle NULL, which makes them
    // invisible to the sub-muscle filter even though they show under a group.
    // Fill only where the gym never set one — an explicit choice is not ours to
    // overwrite. Rows whose name isn't in the catalogue keep their NULL.
    const heads = await prisma.$executeRawUnsafe(
      `UPDATE "${s.schema_name}".exercises e SET target_muscle = c.head, updated_at = now()
       FROM (SELECT unnest($2::text[]) AS name, unnest($3::text[]) AS head) c
       WHERE e.gym_id = $1::uuid AND e.name = c.name
         AND e.target_muscle IS NULL AND c.head <> ''`,
      s.id,
      EXERCISE_CATALOGUE.map((e) => e.name),
      EXERCISE_CATALOGUE.map((e) => e.target_muscle ?? ''),
    );

    const total = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*) AS n FROM "${s.schema_name}".exercises WHERE gym_id = $1::uuid`,
      s.id,
    );
    console.log(
      `  ${s.name}: +${inserted} inserted, ${filled} media + ${heads} heads back-filled, ${total[0].n} total`,
    );
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
