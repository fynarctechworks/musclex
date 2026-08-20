/**
 * ────────────────────────────────────────────────────────────────
 * EXERCISE MEDIA UPLOADER
 * ────────────────────────────────────────────────────────────────
 *
 * Moves the exercise GIFs and thumbnails from the local dataset into OUR
 * storage, then rewrites every exercise row to point at our URLs.
 *
 *   npx ts-node scripts/upload-exercise-media.ts [--rewrite-only] [--gym <id>]
 *
 * WHY not just use the dataset's CDN links: they resolve to a third party's
 * GitHub repo via jsDelivr. That makes a core part of the product — the picture
 * on every exercise — depend on someone else's repository staying public and
 * unchanged, leaks our members' IP addresses to a CDN we do not control, and
 * breaks entirely for a gym behind a restrictive network. The files are already
 * on disk; there is no reason to borrow them at runtime.
 *
 * Media is gym-AGNOSTIC: the same GIF serves every gym, so it uploads once to a
 * shared public bucket rather than per tenant. These are reference illustrations,
 * not member data — a public bucket is correct here, and avoids re-signing URLs
 * for assets that never need protecting.
 *
 * Idempotent: skips files already present, and the rewrite is a plain UPDATE.
 */
import { createClient } from '@supabase/supabase-js';
import { PrismaClient } from '@prisma/client';
import * as fs from 'node:fs';
import * as path from 'node:path';

const ROOT = path.resolve(__dirname, '../../ExerciseGymGifsDB-main');
const BUCKET = 'exercise-media';
const CONCURRENCY = 12;

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

/** Every .gif/.thumb.webp under the muscle folders, as repo-relative paths. */
function collect(): string[] {
  const out: string[] = [];
  for (const dir of fs.readdirSync(ROOT, { withFileTypes: true })) {
    if (!dir.isDirectory() || ['api', 'scripts', 'node_modules'].includes(dir.name)) continue;
    for (const f of fs.readdirSync(path.join(ROOT, dir.name))) {
      if (f.endsWith('.gif') || f.endsWith('.thumb.webp')) out.push(`${dir.name}/${f}`);
    }
  }
  return out;
}

async function ensureBucket() {
  const { data: buckets } = await supabase.storage.listBuckets();
  if (buckets?.some((b) => b.name === BUCKET)) return;
  const { error } = await supabase.storage.createBucket(BUCKET, {
    public: true,
    // Largest GIF in the set is comfortably under this.
    fileSizeLimit: 8 * 1024 * 1024,
    allowedMimeTypes: ['image/gif', 'image/webp'],
  });
  if (error && !/already exists/i.test(error.message)) throw error;
  console.log(`created public bucket ${BUCKET}`);
}

async function uploadAll(files: string[]) {
  let done = 0;
  let skipped = 0;
  let failed = 0;
  let i = 0;

  async function worker() {
    for (;;) {
      const idx = i++;
      if (idx >= files.length) return;
      const rel = files[idx];
      const buf = fs.readFileSync(path.join(ROOT, rel));
      const { error } = await supabase.storage.from(BUCKET).upload(rel, buf, {
        contentType: rel.endsWith('.gif') ? 'image/gif' : 'image/webp',
        // Reference art never changes for a given slug; let clients cache hard.
        cacheControl: '31536000',
        upsert: false,
      });
      if (error) {
        if (/exists/i.test(error.message)) skipped += 1;
        else {
          failed += 1;
          if (failed <= 3) console.error(`  ${rel}: ${error.message}`);
        }
      } else done += 1;

      const seen = done + skipped + failed;
      if (seen % 200 === 0) console.log(`  ${seen}/${files.length}`);
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return { done, skipped, failed };
}

/** Point every exercise row at our storage instead of the dataset's CDN. */
async function rewrite(gymId?: string) {
  const prisma = new PrismaClient();
  const base = supabase.storage.from(BUCKET).getPublicUrl('').data.publicUrl.replace(/\/$/, '');

  const studios = await prisma.$queryRawUnsafe<{ id: string; schema_name: string }[]>(
    gymId
      ? 'SELECT id, schema_name FROM public.studios WHERE id = $1::uuid'
      : 'SELECT id, schema_name FROM public.studios',
    ...(gymId ? [gymId] : []),
  );

  let total = 0;
  for (const s of studios) {
    // Swap only the CDN prefix, leaving the muscle/slug path intact — and only
    // for rows that actually point at it, so a gym's own uploaded media is
    // never touched.
    const n = await prisma.$executeRawUnsafe(
      `UPDATE "${s.schema_name}".exercises
         SET media_url = $2 || '/' || regexp_replace(media_url, '^.*ExerciseGymGifsDB@main/', ''),
             thumb_url = $2 || '/' || regexp_replace(thumb_url, '^.*ExerciseGymGifsDB@main/', ''),
             updated_at = now()
       WHERE gym_id = $1::uuid AND media_url LIKE '%ExerciseGymGifsDB@main/%'`,
      s.id,
      base,
    );
    if (n) console.log(`  ${s.schema_name}: ${n} rows`);
    total += n;
  }
  await prisma.$disconnect();
  return total;
}

async function main() {
  const args = process.argv.slice(2);
  const rewriteOnly = args.includes('--rewrite-only');
  const gymId = args.includes('--gym') ? args[args.indexOf('--gym') + 1] : undefined;

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
    process.exit(1);
  }

  if (!rewriteOnly) {
    await ensureBucket();
    const files = collect();
    console.log(`${files.length} media files -> ${BUCKET}`);
    const r = await uploadAll(files);
    console.log(`uploaded ${r.done}, already present ${r.skipped}, failed ${r.failed}`);
    if (r.failed) {
      console.error('refusing to rewrite URLs while uploads are failing');
      process.exit(1);
    }
  }

  const rows = await rewrite(gymId);
  console.log(`rewrote ${rows} exercise rows to self-hosted URLs`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
