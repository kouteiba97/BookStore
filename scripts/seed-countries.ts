/**
 * Seed the Arab countries so the "الدولة" picker suggests them as soon as you
 * type the first letter. Idempotent (upsert by unique name) — safe to re-run.
 *
 * Run:  npx ts-node scripts/seed-countries.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 22 Arab League states, common short Arabic names.
const COUNTRIES = [
  'الجزائر',
  'تونس',
  'المغرب',
  'ليبيا',
  'موريتانيا',
  'مصر',
  'السودان',
  'السعودية',
  'الإمارات',
  'قطر',
  'البحرين',
  'الكويت',
  'عُمان',
  'اليمن',
  'العراق',
  'سوريا',
  'لبنان',
  'الأردن',
  'فلسطين',
  'الصومال',
  'جيبوتي',
  'جزر القمر',
];

async function main() {
  let added = 0;
  let existed = 0;

  for (const name of COUNTRIES) {
    const existing = await prisma.country.findUnique({ where: { name } });
    if (existing) {
      existed++;
      continue;
    }
    await prisma.country.create({ data: { name } });
    added++;
  }

  console.log(`Countries seeded. added=${added} alreadyPresent=${existed} total=${COUNTRIES.length}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
