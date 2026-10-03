import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
(async () => {
  const store = await prisma.store.findUniqueOrThrow({ where: { slug: process.argv[2] } });
  const books = await prisma.book.count({ where: { storeId: store.id } });
  const noInv = await prisma.book.count({ where: { storeId: store.id, inventory: null } });
  const dup = await prisma.$queryRawUnsafe<any[]>(`SELECT COUNT(*)::int AS n FROM (SELECT "titleNormalized" FROM "Book" WHERE "storeId"=$1 GROUP BY "titleNormalized" HAVING COUNT(*)>1) d`, store.id);
  console.log(JSON.stringify({ books, withoutInventory: noInv, duplicateTitles: dup[0].n }));
  await prisma.$disconnect();
})();
