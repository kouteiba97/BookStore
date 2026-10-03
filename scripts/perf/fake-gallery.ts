// Gives the first N books of a store a 3-picture gallery of ~500 KB local files
// (JPEG-signed filler) under public/covers/perf-test, or removes it with --drop.
import { PrismaClient } from '@prisma/client';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { randomBytes } from 'crypto';
import * as path from 'path';
const prisma = new PrismaClient();
const dir = path.join(process.cwd(), 'public', 'covers', 'perf-test');
(async () => {
  const store = await prisma.store.findUniqueOrThrow({ where: { slug: process.argv[2] } });
  if (process.argv[3] === '--drop') {
    rmSync(dir, { recursive: true, force: true });
    console.log('removed files');
  } else {
    const n = Number(process.argv[3] ?? 200);
    mkdirSync(dir, { recursive: true });
    const books = await prisma.book.findMany({ where: { storeId: store.id }, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], take: n, select: { id: true } });
    for (const [i, b] of books.entries()) {
      const urls = [0, 1, 2].map((k) => {
        const f = `${i}-${k}.jpg`;
        writeFileSync(path.join(dir, f), Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), randomBytes(500 * 1024)]));
        return `/covers/perf-test/${f}`;
      });
      await prisma.bookImage.deleteMany({ where: { bookId: b.id } });
      await prisma.bookImage.createMany({ data: urls.map((url, position) => ({ bookId: b.id, url, position })) });
      await prisma.book.update({ where: { id: b.id }, data: { imageUrl: urls[0] } });
    }
    console.log(`gallery for ${books.length} books, ${books.length * 3} files`);
  }
  await prisma.$disconnect();
})();
