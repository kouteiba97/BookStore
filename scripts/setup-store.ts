/**
 * Set the production store identity (slug/name/phone) on the single store row.
 * Updates the first store if one exists, otherwise creates it. Idempotent.
 *
 * Run:  npx ts-node scripts/setup-store.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const STORE = {
  slug: 'elbayan',
  name: 'مكتبة البيان',
  phone: '+213777887762',
};

async function main() {
  const existing = await prisma.store.findFirst({ orderBy: { createdAt: 'asc' } });

  const store = existing
    ? await prisma.store.update({ where: { id: existing.id }, data: STORE })
    : await prisma.store.create({ data: STORE });

  console.log(`Store ready: slug=${store.slug} name=${store.name} phone=${store.phone}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
