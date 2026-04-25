import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

(async () => {
  const books = await p.book.findMany({
    select: { id: true, title: true, imageUrl: true, author: { select: { name: true } } },
    take: 200,
  });

  const score = (t: string) => {
    const arabic = (t.match(/[؀-ۿ]/g) || []).length;
    const digits = (t.match(/[0-9٠-٩]/g) || []).length;
    const spaces = (t.match(/\s/g) || []).length;
    const total = t.length || 1;
    const wordLens = t.split(/\s+/).filter(Boolean).map((w) => w.length);
    const avgWord = wordLens.length ? wordLens.reduce((a, b) => a + b, 0) / wordLens.length : 0;
    const tooManyShort = wordLens.filter((l) => l <= 2).length / Math.max(wordLens.length, 1);
    return {
      arabicRatio: arabic / total,
      digitRatio: digits / total,
      spaceRatio: spaces / total,
      avgWord,
      tooManyShort,
    };
  };

  let bad = 0;
  const samples: any[] = [];
  for (const b of books) {
    const s = score(b.title);
    const isBad =
      s.digitRatio > 0.15 ||
      s.tooManyShort > 0.6 ||
      s.avgWord < 2.5 ||
      /[!@#%^&*"\\\/]|0\s*0|1\s*1\s*1/.test(b.title);
    if (isBad) {
      bad++;
      if (samples.length < 10) samples.push({ id: b.id, title: b.title, image: b.imageUrl, author: b.author?.name, score: s });
    }
  }
  console.log(`Total scanned: ${books.length}`);
  console.log(`Likely garbled: ${bad}`);
  console.log('Samples:');
  samples.forEach((s) => console.log(JSON.stringify(s, null, 2)));
  await p.$disconnect();
})();
