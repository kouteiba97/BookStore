/**
 * One-time migration: move book covers stored on local disk (Book.imageUrl
 * like "/covers/<file>") into Cloudflare R2, then rewrite imageUrl to the
 * public R2 URL.
 *
 * Run:  npx ts-node scripts/migrate-covers-to-r2.ts
 *
 * Idempotent: books whose imageUrl already points at R2_PUBLIC_BASE_URL are
 * skipped, so it's safe to re-run.
 */
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const {
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET,
  R2_PUBLIC_BASE_URL,
} = process.env;

function requireEnv() {
  const missing = [
    'R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY',
    'R2_BUCKET', 'R2_PUBLIC_BASE_URL',
  ].filter((k) => !process.env[k]);
  if (missing.length) {
    console.error(`Missing env vars: ${missing.join(', ')}`);
    process.exit(1);
  }
}

function contentType(ext: string): string {
  switch (ext.toLowerCase()) {
    case '.png': return 'image/png';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    default: return 'application/octet-stream';
  }
}

async function main() {
  requireEnv();

  const publicBase = R2_PUBLIC_BASE_URL!.replace(/\/+$/, '');
  const coversDir = path.join(process.cwd(), 'public', 'covers');

  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID!,
      secretAccessKey: R2_SECRET_ACCESS_KEY!,
    },
  });

  const prisma = new PrismaClient();

  // Only local-disk covers need migrating.
  const books = await prisma.book.findMany({
    where: { imageUrl: { startsWith: '/covers/' } },
    select: { id: true, imageUrl: true },
  });

  console.log(`Found ${books.length} local covers to migrate.`);
  let uploaded = 0, missing = 0, failed = 0;

  for (const book of books) {
    const filename = book.imageUrl!.replace(/^\/covers\//, '');
    const localPath = path.join(coversDir, filename);

    if (!fs.existsSync(localPath)) {
      console.warn(`  ✗ file missing on disk: ${filename}`);
      missing++;
      continue;
    }

    try {
      const key = `covers/${filename}`;
      await s3.send(new PutObjectCommand({
        Bucket: R2_BUCKET!,
        Key: key,
        Body: fs.readFileSync(localPath),
        ContentType: contentType(path.extname(filename)),
        CacheControl: 'public, max-age=31536000, immutable',
      }));

      await prisma.book.update({
        where: { id: book.id },
        data: { imageUrl: `${publicBase}/${key}` },
      });
      uploaded++;
      if (uploaded % 20 === 0) console.log(`  ...${uploaded} uploaded`);
    } catch (err) {
      console.error(`  ✗ failed ${filename}:`, (err as Error).message);
      failed++;
    }
  }

  console.log(`\nDone. uploaded=${uploaded} missing=${missing} failed=${failed}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
