/**
 * Set a store's pack (platform owner only).
 *
 *   npx ts-node scripts/set-plan.ts <store-slug> <starter|pro|business>
 *   npx ts-node scripts/set-plan.ts --list
 *
 * Uses DATABASE_URL. The running API picks the change up within a minute.
 */
import { PrismaClient } from '@prisma/client';
import { PLAN_KEYS, PLANS } from '../src/common/plan/plans';

const prisma = new PrismaClient();

(async () => {
  const [slug, plan] = process.argv.slice(2);
  if (slug === '--list' || !slug) {
    const stores = await prisma.store.findMany({ select: { slug: true, name: true, plan: true }, orderBy: { createdAt: 'asc' } });
    for (const s of stores) console.log(`${s.slug.padEnd(20)} ${s.plan.padEnd(10)} ${s.name}`);
    if (!slug) console.log('\nUsage: npx ts-node scripts/set-plan.ts <store-slug> <starter|pro|business>');
    return;
  }
  if (!(PLAN_KEYS as readonly string[]).includes(plan)) {
    throw new Error(`Unknown plan "${plan}". Use one of: ${PLAN_KEYS.join(', ')}`);
  }
  const store = await prisma.store.update({ where: { slug }, data: { plan } });
  console.log(`Store "${store.slug}" is now on "${plan}" (${PLANS[plan as keyof typeof PLANS].label}).`);
})()
  .catch((e) => {
    console.error(e.message ?? e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
