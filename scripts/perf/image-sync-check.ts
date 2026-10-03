// Prepares ./images fixtures for an image-sync run on a store, or reports/cleans after it.
//   prepare <slug> | report <slug> <bookId> | clean
import { PrismaClient } from '@prisma/client';
import { mkdirSync, rmSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { randomBytes } from 'crypto';
import * as path from 'path';
const prisma = new PrismaClient();
const dir = path.join(process.cwd(), 'images');
const jpg = (kb: number) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), randomBytes(kb * 1024)]);
(async () => {
  const [cmd, slug, bookId] = process.argv.slice(2);
  if (cmd === 'prepare') {
    const store = await prisma.store.findUniqueOrThrow({ where: { slug } });
    const target = await prisma.book.findFirstOrThrow({ where: { storeId: store.id, imageUrl: { startsWith: '/covers/perf-test/' } }, select: { id: true, title: true } });
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, `${target.title}.jpg`), jpg(40));                 // exact match
    writeFileSync(path.join(dir, 'كتاب_جديد_للاختبار_المزامنة.jpg'), jpg(40));      // new title …
    writeFileSync(path.join(dir, 'كتاب-جديد-للاختبار-المزامنة.jpg'), jpg(41));      // … same title again
    writeFileSync(path.join(dir, 'غلاف ضخم جدا للاختبار.jpg'), jpg(16 * 1024));      // 16 MB
    console.log(JSON.stringify({ bookId: target.id }));
  } else if (cmd === 'report') {
    const store = await prisma.store.findUniqueOrThrow({ where: { slug } });
    const book = await prisma.book.findUniqueOrThrow({ where: { id: bookId }, select: { imageUrl: true, images: { orderBy: { position: 'asc' }, select: { url: true } } } });
    const created = await prisma.book.findMany({ where: { storeId: store.id, titleNormalized: { contains: 'كتاب جديد للاختبار' } }, select: { id: true, title: true } });
    const huge = await prisma.book.count({ where: { storeId: store.id, title: { contains: 'غلاف ضخم' } } });
    const covers = existsSync('public/covers') ? readdirSync('public/covers').filter((f) => f.startsWith('sync-')).length : 0;
    console.log(JSON.stringify({ cover: book.imageUrl, gallery: book.images.map((i) => i.url), createdForNewTitle: created.length, hugeBooks: huge, syncFilesWritten: covers }, null, 1));
    await prisma.book.deleteMany({ where: { id: { in: created.map((c) => c.id) } } });
  } else if (cmd === 'clean') {
    rmSync(dir, { recursive: true, force: true });
    for (const f of existsSync('public/covers') ? readdirSync('public/covers') : []) if (f.startsWith('sync-')) rmSync(path.join('public/covers', f));
    console.log('cleaned');
  }
  await prisma.$disconnect();
})();
