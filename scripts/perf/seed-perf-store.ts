/**
 * Seeds a throwaway store with a realistic catalogue for load and isolation
 * testing. Never run against production.
 *
 *   npx ts-node scripts/perf/seed-perf-store.ts [count] [slug]
 *   npx ts-node scripts/perf/seed-perf-store.ts --drop [slug]
 *
 * Authors and publishers it creates carry the PERF_MARK prefix so --drop can
 * remove them again; categories reuse the existing ones.
 */
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { normalizeArabic } from '../../src/common/utils/normalize-arabic';

const PERF_MARK = 'perf·';
const prisma = new PrismaClient();

const WORDS = [
  'شرح', 'تفسير', 'القرآن', 'الكريم', 'صحيح', 'البخاري', 'مسلم', 'الفقه', 'أصول',
  'العقيدة', 'الطحاوية', 'المختصر', 'الجامع', 'الأحكام', 'السنن', 'الكبرى', 'رياض',
  'الصالحين', 'زاد', 'المعاد', 'فتح', 'الباري', 'المغني', 'البداية', 'النهاية',
  'الرسالة', 'الأم', 'الموطأ', 'المستدرك', 'الإتقان', 'علوم', 'البلاغة', 'النحو',
  'الواضح', 'منهج', 'السالكين', 'مدارج', 'إحياء', 'الدين', 'تاريخ', 'الإسلام',
];

const pick = <T>(a: T[], i: number) => a[i % a.length];

function title(i: number) {
  const n = 2 + (i % 4);
  const parts: string[] = [];
  for (let k = 0; k < n; k++) parts.push(pick(WORDS, i * 7 + k * 13 + (i >> 3)));
  return `${parts.join(' ')} ${i}`;
}

async function seed(count: number, slug: string) {
  if (await prisma.store.findUnique({ where: { slug } })) {
    throw new Error(`Store "${slug}" already exists — drop it first.`);
  }
  const store = await prisma.store.create({ data: { name: `Perf ${slug}`, slug } });

  const categories = await prisma.category.findMany({ select: { id: true } });
  if (!categories.length) throw new Error('No categories to attach books to.');

  const authors = Array.from({ length: Math.max(50, count / 6) | 0 }, (_, i) => ({
    id: randomUUID(),
    name: `${PERF_MARK}${slug} مؤلف ${i}`,
  }));
  const publishers = Array.from({ length: Math.max(20, count / 25) | 0 }, (_, i) => ({
    id: randomUUID(),
    name: `${PERF_MARK}${slug} دار ${i}`,
  }));
  await prisma.author.createMany({ data: authors });
  await prisma.publisher.createMany({ data: publishers });

  const statuses = ['available', 'on_request', 'rare'] as const;
  const CHUNK = 1000;
  for (let start = 0; start < count; start += CHUNK) {
    const books = [];
    const bookAuthors = [];
    const bookPublishers = [];
    const inventories = [];
    const images = [];
    for (let i = start; i < Math.min(count, start + CHUNK); i++) {
      const id = randomUUID();
      const t = title(i);
      const cover = i % 5 === 0 ? null : `https://example.com/covers/${slug}/${i}.jpg`;
      books.push({
        id,
        storeId: store.id,
        title: t,
        titleNormalized: normalizeArabic(t),
        description: i % 3 === 0 ? `نبذة عن ${t}` : null,
        year: 1990 + (i % 35),
        price: 500 + (i % 40) * 100,
        categoryId: pick(categories, i).id,
        imageUrl: cover,
      });
      bookAuthors.push({ bookId: id, authorId: pick(authors, i).id, position: 0 });
      if (i % 4 === 0) bookAuthors.push({ bookId: id, authorId: pick(authors, i + 1).id, position: 1 });
      bookPublishers.push({ bookId: id, publisherId: pick(publishers, i).id, position: 0 });
      inventories.push({ bookId: id, storeId: store.id, status: pick([...statuses], i), stock: i % 9 });
      if (cover) images.push({ bookId: id, url: cover, position: 0 });
    }
    await prisma.$transaction([
      prisma.book.createMany({ data: books }),
      prisma.bookAuthor.createMany({ data: bookAuthors }),
      prisma.bookPublisher.createMany({ data: bookPublishers }),
      prisma.inventory.createMany({ data: inventories }),
      prisma.bookImage.createMany({ data: images }),
    ]);
  }
  console.log(`Seeded store "${slug}" with ${count} books.`);
}

async function drop(slug: string) {
  const store = await prisma.store.findUnique({ where: { slug } });
  if (store) {
    await prisma.orderItem.deleteMany({ where: { order: { storeId: store.id } } });
    await prisma.store.delete({ where: { id: store.id } }); // cascades books
  }
  const a = await prisma.author.deleteMany({ where: { name: { startsWith: `${PERF_MARK}${slug} ` } } });
  const p = await prisma.publisher.deleteMany({ where: { name: { startsWith: `${PERF_MARK}${slug} ` } } });
  console.log(`Dropped store "${slug}" (${a.count} authors, ${p.count} publishers).`);
}

const args = process.argv.slice(2);
(args[0] === '--drop' ? drop(args[1] ?? 'perf') : seed(Number(args[0] ?? 5000), args[1] ?? 'perf'))
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
