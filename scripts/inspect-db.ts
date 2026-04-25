import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
(async () => {
  const stores = await p.store.findMany();
  const books = await p.book.count();
  const inv = await p.inventory.count();
  console.log('stores:', stores);
  console.log('books:', books);
  console.log('inventory:', inv);
  await p.$disconnect();
})();
