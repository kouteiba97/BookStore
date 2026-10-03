import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
(async () => {
  const store = await prisma.store.findUniqueOrThrow({ where: { slug: process.argv[2] ?? 'perf' } });
  const q = process.argv[3] ?? 'فتح';
  const plan = await prisma.$queryRawUnsafe<any[]>(`
    EXPLAIN (ANALYZE, BUFFERS) SELECT b.id FROM "Book" b
    WHERE b."storeId" = $1 AND (
      b."titleNormalized" ILIKE $2 OR b.title ILIKE $2
      OR EXISTS (SELECT 1 FROM "BookAuthor" ba JOIN "Author" a ON a.id = ba."authorId" WHERE ba."bookId" = b.id AND a.name ILIKE $2)
      OR EXISTS (SELECT 1 FROM "BookPublisher" bp JOIN "Publisher" p ON p.id = bp."publisherId" WHERE bp."bookId" = b.id AND p.name ILIKE $2))
    LIMIT 20`, store.id, `%${q}%`);
  for (const r of plan) console.log(r['QUERY PLAN']);
  const ext = await prisma.$queryRawUnsafe<any[]>(`SELECT extname FROM pg_extension`);
  console.log('extensions:', ext.map((e) => e.extname).join(', '));
  await prisma.$disconnect();
})();
