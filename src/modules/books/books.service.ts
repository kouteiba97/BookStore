import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StoreResolver } from '../../common/tenant/store-resolver.service';
import { normalizeArabic } from '../../common/utils/normalize-arabic';
import {
  bookCardInclude,
  bookInclude,
  serializeBook,
  serializeBooks,
} from '../../common/utils/book-serializer';
import { thumbUrlFor } from '../../common/utils/cover-image';

/** Upper bound for an explicit ?limit= on the catalogue list. */
const MAX_LIST_LIMIT = 100;

@Injectable()
export class BooksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stores: StoreResolver,
  ) {}

  private resolveStore(storeSlug: string) {
    return this.stores.bySlug(storeSlug);
  }

  private isQueryValid(q: string): boolean {
    return q.trim().length >= 2;
  }

  /**
   * The catalogue as cards, newest first. `limit` is what the home page uses
   * (it shows 16); without it the whole catalogue is returned, as the mobile
   * store app and the sitemap expect, but in the slim card shape.
   */
  async findAll(storeSlug: string, limit?: number, categoryId?: string) {
    const store = await this.resolveStore(storeSlug);

    const take =
      limit && limit > 0 ? Math.min(Math.floor(limit), MAX_LIST_LIMIT) : undefined;

    const books = await this.prisma.book.findMany({
      where: { storeId: store.id, ...(categoryId ? { categoryId } : {}) },
      include: bookCardInclude as any,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      ...(take ? { take } : {}),
    });
    return serializeBooks(books);
  }

  async findOne(storeSlug: string, id: string) {
    const store = await this.resolveStore(storeSlug);

    const book = await this.prisma.book.findFirst({
      where: { id, storeId: store.id },
      include: bookInclude as any,
    });

    if (!book) throw new NotFoundException('Book not found');

    return serializeBook(book);
  }

  async search(storeSlug: string, q: string) {
    const trimmed = q.trim();
    if (!this.isQueryValid(trimmed)) return [];

    const store = await this.resolveStore(storeSlug);
    const normalized = normalizeArabic(trimmed);

    const books = await this.prisma.book.findMany({
      where: {
        storeId: store.id,
        OR: [
          { titleNormalized: { contains: normalized, mode: 'insensitive' } },
          { title: { contains: trimmed, mode: 'insensitive' } },
          // Match against any author / publisher of the book.
          {
            authors: {
              some: {
                author: { name: { contains: trimmed, mode: 'insensitive' } },
              },
            },
          },
          {
            publishers: {
              some: {
                publisher: { name: { contains: trimmed, mode: 'insensitive' } },
              },
            },
          },
          // "فقه" should find the books filed under the فقه category too.
          { category: { name: { contains: trimmed, mode: 'insensitive' } } },
        ],
      },
      include: bookCardInclude as any,
      take: 40,
    });
    return serializeBooks(books);
  }

  /**
   * The categories this store actually has books in, with how many — what the
   * home page offers to browse. Empty categories are never shown.
   */
  async categories(storeSlug: string) {
    const store = await this.resolveStore(storeSlug);
    const counts = await this.prisma.book.groupBy({
      by: ['categoryId'],
      where: { storeId: store.id },
      _count: { _all: true },
    });
    if (!counts.length) return [];
    const cats = await this.prisma.category.findMany({
      where: { id: { in: counts.map((c) => c.categoryId) } },
      select: { id: true, name: true },
    });
    const n = new Map(counts.map((c) => [c.categoryId, c._count._all]));
    return cats
      .map((c) => ({ ...c, bookCount: n.get(c.id) ?? 0 }))
      .sort((a, b) => b.bookCount - a.bookCount || a.name.localeCompare(b.name, 'ar'));
  }

  async autocomplete(storeSlug: string, q: string) {
    const trimmed = q.trim();
    if (!this.isQueryValid(trimmed)) return [];

    const store = await this.resolveStore(storeSlug);
    const normalized = normalizeArabic(trimmed);

    return this.prisma.book.findMany({
      where: {
        storeId: store.id,
        OR: [
          { titleNormalized: { contains: normalized, mode: 'insensitive' } },
          { title: { contains: trimmed, mode: 'insensitive' } },
        ],
      },
      select: { id: true, title: true },
      take: 10,
    });
  }

  async suggestions(storeSlug: string, q: string) {
    const trimmed = q.trim();
    if (!this.isQueryValid(trimmed)) {
      return { categories: [], authors: [], books: [] };
    }

    const store = await this.resolveStore(storeSlug);
    const normalized = normalizeArabic(trimmed);

    const [categories, authors, books] = await Promise.all([
      // Categories and authors are shared reference data; suggest only those
      // that actually have a book in this store.
      this.prisma.category.findMany({
        where: {
          name: { contains: trimmed, mode: 'insensitive' },
          books: { some: { storeId: store.id } },
        },
        select: { id: true, name: true },
        take: 5,
      }),

      this.prisma.author.findMany({
        where: {
          name: { contains: trimmed, mode: 'insensitive' },
          books: { some: { book: { storeId: store.id } } },
        },
        select: { id: true, name: true },
        take: 5,
      }),

      this.prisma.book.findMany({
        where: {
          storeId: store.id,
          OR: [
            { titleNormalized: { contains: normalized, mode: 'insensitive' } },
            { title: { contains: trimmed, mode: 'insensitive' } },
          ],
        },
        select: { id: true, title: true, imageUrl: true },
        take: 5,
      }),
    ]);

    return {
      categories,
      authors,
      books: books.map((b) => ({ ...b, thumbUrl: thumbUrlFor(b.imageUrl) })),
    };
  }

  async recommendations(storeSlug: string, bookId: string) {
    const store = await this.resolveStore(storeSlug);

    const book = await this.prisma.book.findFirst({
      where: { id: bookId, storeId: store.id },
      select: {
        id: true,
        categoryId: true,
        authors: { select: { authorId: true } },
        publishers: { select: { publisherId: true } },
      },
    });

    if (!book) throw new NotFoundException('Book not found');

    const authorIds = book.authors.map((a) => a.authorId);
    const publisherIds = book.publishers.map((p) => p.publisherId);

    // Recommend anything sharing the category, or ANY author / publisher.
    const orConditions: any[] = [{ categoryId: book.categoryId }];

    if (authorIds.length) {
      orConditions.push({ authors: { some: { authorId: { in: authorIds } } } });
    }
    if (publisherIds.length) {
      orConditions.push({
        publishers: { some: { publisherId: { in: publisherIds } } },
      });
    }

    const books = await this.prisma.book.findMany({
      where: {
        storeId: store.id,
        id: { not: book.id },
        OR: orConditions,
      },
      include: bookCardInclude as any,
      take: 10,
    });
    return serializeBooks(books);
  }
}
