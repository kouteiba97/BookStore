import { Prisma, PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { normalizeArabic } from '../utils/normalize-arabic';

type Db = PrismaClient | Prisma.TransactionClient;

export interface TitleRef {
  title: string;
  author?: string | null;
}

/**
 * Book ids for a list of titles (+ optional author), creating a minimal book
 * for any title the store does not have yet — a purchase or a sales history
 * line must always point at a book.
 *
 * Matching: same normalised title, and the same primary author when one is
 * given; without an author, the title alone (first match).
 */
export async function findOrCreateBooks(
  db: Db,
  storeId: string,
  refs: TitleRef[],
  opts: { importJobId?: string | null } = {},
): Promise<{ ids: Map<string, string>; created: number }> {
  const key = (r: TitleRef) => `${normalizeArabic(r.title)}::${r.author ? normalizeArabic(r.author) : ''}`;
  const wanted = new Map<string, TitleRef>();
  for (const r of refs) if (r.title?.trim()) wanted.set(key(r), { title: r.title.trim(), author: r.author?.trim() || null });

  const titles = [...new Set([...wanted.values()].map((r) => normalizeArabic(r.title)))];
  const existing = titles.length
    ? await db.book.findMany({
        where: { storeId, titleNormalized: { in: titles } },
        select: {
          id: true,
          titleNormalized: true,
          authors: { select: { author: { select: { name: true } } }, orderBy: { position: 'asc' }, take: 1 },
        },
        orderBy: { createdAt: 'asc' },
      })
    : [];

  const ids = new Map<string, string>();
  const toCreate: { k: string; ref: TitleRef }[] = [];
  for (const [k, ref] of wanted) {
    const t = normalizeArabic(ref.title);
    const a = ref.author ? normalizeArabic(ref.author) : null;
    const hit =
      existing.find((b) => b.titleNormalized === t && (!a || (b.authors[0] && normalizeArabic(b.authors[0].author.name) === a))) ??
      (a ? undefined : existing.find((b) => b.titleNormalized === t));
    if (hit) ids.set(k, hit.id);
    else toCreate.push({ k, ref });
  }

  if (toCreate.length) {
    const fallback = await db.category.upsert({ where: { name: 'غير مصنف' }, create: { name: 'غير مصنف' }, update: {} });
    const authorNames = [...new Set(toCreate.map((c) => c.ref.author).filter((x): x is string => !!x))];
    if (authorNames.length) await db.author.createMany({ data: authorNames.map((name) => ({ name })), skipDuplicates: true });
    const authors = authorNames.length
      ? new Map((await db.author.findMany({ where: { name: { in: authorNames } }, select: { id: true, name: true } })).map((a) => [a.name, a.id]))
      : new Map<string, string>();

    const rows = toCreate.map((c) => ({ ...c, id: randomUUID() }));
    await db.book.createMany({
      data: rows.map((r) => ({
        id: r.id,
        storeId,
        title: r.ref.title.slice(0, 500),
        titleNormalized: normalizeArabic(r.ref.title),
        categoryId: fallback.id,
        importJobId: opts.importJobId ?? null,
      })),
    });
    const links = rows.filter((r) => r.ref.author && authors.get(r.ref.author!));
    if (links.length) {
      await db.bookAuthor.createMany({ data: links.map((r) => ({ bookId: r.id, authorId: authors.get(r.ref.author!)!, position: 0 })) });
    }
    for (const r of rows) ids.set(r.k, r.id);
  }

  return { ids, created: toCreate.length };
}

export function titleKey(r: TitleRef): string {
  return `${normalizeArabic(r.title.trim())}::${r.author?.trim() ? normalizeArabic(r.author.trim()) : ''}`;
}
