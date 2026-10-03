import type { Prisma, PrismaClient } from '@prisma/client';

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Set (or clear) a book's cover and keep gallery picture 0 in step with it.
 *
 * `Book.imageUrl` is what cards and order lines show; `BookImage` position 0 is
 * what the book page shows first. Updating one without the other makes the
 * card and the page disagree, so every server-side cover change goes here.
 */
export async function setBookCover(db: Db, bookId: string, url: string | null): Promise<void> {
  await db.book.update({ where: { id: bookId }, data: { imageUrl: url } });

  const first = await db.bookImage.findFirst({
    where: { bookId },
    orderBy: { position: 'asc' },
  });

  if (url === null) {
    // Drop the cover picture; the next volume of a series becomes the cover.
    if (first) await db.bookImage.delete({ where: { id: first.id } });
    const next = await db.bookImage.findFirst({ where: { bookId }, orderBy: { position: 'asc' } });
    if (next) await db.book.update({ where: { id: bookId }, data: { imageUrl: next.url } });
    return;
  }
  if (!first) {
    await db.bookImage.create({ data: { bookId, url, position: 0 } });
  } else if (first.url !== url) {
    await db.bookImage.update({ where: { id: first.id }, data: { url } });
  }
}
