import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const fields = [
  'شريعة',
  'أصول الدين',
  'فقه وأصوله',
  'الحديث وعلومه',
  'العقيدة',
  'التفسير وعلوم القرآن',
  'الدعوة والثقافة الإسلامية',
];

const years = ['سنة أولى', 'سنة ثانية', 'سنة ثالثة', 'ماستر'];

async function main() {
  console.log('Seeding academic data...');

  for (const name of fields) {
    const field = await prisma.field.upsert({
      where: { name },
      update: {},
      create: { name },
    });

    for (const yearName of years) {
      const exists = await prisma.academicYear.findFirst({
        where: { name: yearName, fieldId: field.id },
      });

      if (!exists) {
        await prisma.academicYear.create({
          data: { name: yearName, fieldId: field.id },
        });
      }
    }

    console.log(`  ✓ ${name}`);
  }

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
