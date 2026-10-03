/**
 * Creates the 480 px "<name>.thumb.jpg" next to every stored cover that does
 * not have one yet (covers uploaded before thumbnails existed).
 *
 * Additive and idempotent: originals are never modified, existing thumbnails
 * are skipped, so it can be re-run at any time.
 *
 *   npx ts-node scripts/backfill-thumbnails.ts               # URLs from DATABASE_URL
 *   npx ts-node scripts/backfill-thumbnails.ts urls.json     # or from a JSON array
 *
 * Needs the R2_* variables (the same ones the API uses).
 */
import 'dotenv/config';
import { readFileSync } from 'fs';
import { PrismaClient } from '@prisma/client';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { makeThumb, thumbKey } from '../src/common/utils/cover-image';

const env = (k: string) => (process.env[k] ?? '').trim();
const base = env('R2_PUBLIC_BASE_URL').replace(/\/+$/, '');
const bucket = env('R2_BUCKET');
if (!base || !bucket || !env('R2_ACCOUNT_ID')) throw new Error('R2_* variables are required');

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${env('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: env('R2_ACCESS_KEY_ID'), secretAccessKey: env('R2_SECRET_ACCESS_KEY') },
});

async function urls(): Promise<string[]> {
  const file = process.argv[2];
  if (file) return JSON.parse(readFileSync(file, 'utf8'));
  const prisma = new PrismaClient();
  const [books, images] = await Promise.all([
    prisma.book.findMany({ where: { imageUrl: { startsWith: `${base}/covers/` } }, select: { imageUrl: true } }),
    prisma.bookImage.findMany({ where: { url: { startsWith: `${base}/covers/` } }, select: { url: true } }),
  ]);
  await prisma.$disconnect();
  return [...books.map((b) => b.imageUrl!), ...images.map((i) => i.url)];
}

(async () => {
  const all = [...new Set(await urls())].filter((u) => u.startsWith(`${base}/covers/`) && !u.endsWith('.thumb.jpg'));
  let made = 0, skipped = 0, failed = 0, savedFrom = 0, savedTo = 0;

  for (const url of all) {
    const key = url.slice(base.length + 1);
    const tKey = thumbKey(key);
    try {
      const head = await fetch(`${base}/${tKey}`, { method: 'HEAD' });
      if (head.ok) { skipped++; continue; }
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const original = Buffer.from(await res.arrayBuffer());
      const thumb = await makeThumb(original);
      await s3.send(new PutObjectCommand({
        Bucket: bucket, Key: tKey, Body: thumb, ContentType: 'image/jpeg',
        CacheControl: 'public, max-age=31536000, immutable',
      }));
      made++; savedFrom += original.length; savedTo += thumb.length;
    } catch (err) {
      failed++;
      console.warn(`skip ${key}: ${(err as Error).message}`);
    }
  }
  console.log(
    `${all.length} covers: ${made} thumbnails created, ${skipped} already present, ${failed} failed.` +
      (made ? ` Card image weight ${Math.round(savedFrom / 1024)} KB → ${Math.round(savedTo / 1024)} KB.` : ''),
  );
})();
