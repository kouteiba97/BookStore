import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { normalizeArabic } from '../../common/utils/normalize-arabic';
import {
  bookInclude,
  serializeBook,
  serializeBooks,
} from '../../common/utils/book-serializer';

@Injectable()
export class BooksService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveStore(storeSlug: string) {
    const store = await this.prisma.store.findUnique({
      where: { slug: storeSlug },
    });
    if (!store) throw new NotFoundException('Store not found');
    return store;
  }

  private isQueryValid(q: string): boolean {
    return q.trim().length >= 2;
  }

  async findAll(storeSlug: string) {
    const store = await this.resolveStore(storeSlug);

    const books = await this.prisma.book.findMany({
      where: { storeId: store.id },
      include: bookInclude as any,
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
        ],
      },
      include: bookInclude as any,
      take: 20,
    });
    return serializeBooks(books);
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
      this.prisma.category.findMany({
        where: { name: { contains: trimmed, mode: 'insensitive' } },
        select: { id: true, name: true },
        take: 5,
      }),

      this.prisma.author.findMany({
        where: { name: { contains: trimmed, mode: 'insensitive' } },
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

    return { categories, authors, books };
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
      include: bookInclude as any,
      take: 10,
    });
    return serializeBooks(books);
  }
}
