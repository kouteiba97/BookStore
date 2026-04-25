import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();
const APPLY = process.argv.includes('--apply');

const isGarbled = (title: string) => {
  const arabic = (title.match(/[؀-ۿ]/g) || []).length;
  const digits = (title.match(/[0-9٠-٩]/g) || []).length;
  const total = title.length || 1;
  const wordLens = title.split(/\s+/).filter(Boolean).map((w) => w.length);
  const avgWord = wordLens.length ? wordLens.reduce((a, b) => a + b, 0) / wordLens.length : 0;
  const tooManyShort =
    wordLens.filter((l) => l <= 2).length / Math.max(wordLens.length, 1);
  const arabicRatio = arabic / total;
  const digitRatio = digits / total;

  return (
    digitRatio > 0.15 ||
    tooManyShort > 0.6 ||
    avgWord < 2.5 ||
    /[!@#%^&*"\\\/]|0\s*0|1\s*1\s*1/.test(title) ||
    arabicRatio < 0.4
  );
};

(async () => {
  const all = await p.book.findMany({
    select: { id: true, title: true, imageUrl: true },
  });

  const garbled = all.filter((b) => isGarbled(b.title));

  if (!garbled.length) {
    console.log('No garbled titles found.');
    await p.$disconnect();
    return;
  }

  // Find books referenced by OrderItem (those have onDelete: Restrict, so we
  // can't delete them — clear title only).
  const referencedRaw = await p.orderItem.findMany({
    where: { bookId: { in: garbled.map((b) => b.id) } },
    select: { bookId: true },
  });
  const referenced = new Set(referencedRaw.map((r) => r.bookId));

  const toDelete = garbled.filter((b) => !referenced.has(b.id));
  const toClear = garbled.filter((b) => referenced.has(b.id));

  console.log(`Garbled: ${garbled.length}`);
  console.log(`To delete (no order references): ${toDelete.length}`);
  console.log(`To clear title (referenced by orders): ${toClear.length}`);
  console.log('');
  console.log('--- WILL DELETE ---');
  toDelete.forEach((b) => console.log(`  ${b.id}  ${JSON.stringify(b.title)}`));
  if (toClear.length) {
    console.log('--- WILL BLANK TITLE ---');
    toClear.forEach((b) => console.log(`  ${b.id}  ${JSON.stringify(b.title)}`));
  }

  if (!APPLY) {
    console.log('\nDry run. Re-run with --apply to execute.');
    await p.$disconnect();
    return;
  }

  await p.$transaction(async (tx) => {
    if (toDelete.length) {
      await tx.book.deleteMany({ where: { id: { in: toDelete.map((b) => b.id) } } });
    }
    for (const b of toClear) {
      await tx.book.update({ where: { id: b.id }, data: { title: 'بدون عنوان' } });
    }
  });

  console.log(`\nDone. Deleted ${toDelete.length}, blanked ${toClear.length}.`);
  await p.$disconnect();
})();
