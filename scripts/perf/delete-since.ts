// Deletes a store's books created after an ISO timestamp (test clean-up).
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
(async () => {
  const store = await prisma.store.findUniqueOrThrow({ where: { slug: process.argv[2] } });
  const r = await prisma.book.deleteMany({ where: { storeId: store.id, createdAt: { gt: new Date(process.argv[3]) } } });
  console.log(`deleted ${r.count}`);
  await prisma.$disconnect();
})();
