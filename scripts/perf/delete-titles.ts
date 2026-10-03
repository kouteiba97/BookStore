// Deletes this store's books whose exact title is in the given JSON array (test clean-up).
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
(async () => {
  const store = await prisma.store.findUniqueOrThrow({ where: { slug: process.argv[2] } });
  const titles: string[] = JSON.parse(process.argv[3]);
  const r = await prisma.book.deleteMany({ where: { storeId: store.id, title: { in: titles }, orderItems: { none: {} } } });
  console.log(`deleted ${r.count}`);
  await prisma.$disconnect();
})();
