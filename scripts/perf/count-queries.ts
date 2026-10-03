// Counts the SQL round trips Prisma makes for the main read paths.
//   npx ts-node scripts/perf/count-queries.ts <slug>
import { PrismaClient } from '@prisma/client';
import { bookCardInclude, bookInclude } from '../../src/common/utils/book-serializer';
const prisma = new PrismaClient({ log: [{ emit: 'event', level: 'query' }] });
let n = 0;
(prisma as any).$on('query', () => n++);
const measure = async (label: string, fn: () => Promise<unknown>) => {
  n = 0;
  await fn();
  console.log(`${label.padEnd(34)} ${n} queries`);
};
(async () => {
  const store = await prisma.store.findUniqueOrThrow({ where: { slug: process.argv[2] ?? 'elbayan' } });
  const one = await prisma.book.findFirstOrThrow({ where: { storeId: store.id } });
  await measure('list 16 cards (home)', () => prisma.book.findMany({ where: { storeId: store.id }, include: bookCardInclude as any, take: 16 }));
  await measure('book page (full include)', () => prisma.book.findFirst({ where: { id: one.id }, include: bookInclude as any }));
  await measure('admin list 25 (full include)', () => prisma.book.findMany({ where: { storeId: store.id }, include: bookInclude as any, take: 25 }));
  await prisma.$disconnect();
})();
