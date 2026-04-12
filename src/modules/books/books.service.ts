import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { normalizeArabic } from '../../common/utils/normalize-arabic';

const bookInclude = {
  inventory: true,
  category: true,
  author: true,
  publisher: true,
};

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

    return this.prisma.book.findMany({
      where: { storeId: store.id },
      include: bookInclude,
    });
  }

  async findOne(storeSlug: string, id: string) {
    const store = await this.resolveStore(storeSlug);

    const book = await this.prisma.book.findFirst({
      where: { id, storeId: store.id },
      include: bookInclude,
    });

    if (!book) throw new NotFoundException('Book not found');

    return book;
  }

  async search(storeSlug: string, q: string) {
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
          { author: { name: { contains: trimmed, mode: 'insensitive' } } },
          { publisher: { name: { contains: trimmed, mode: 'insensitive' } } },
        ],
      },
      include: bookInclude,
      take: 20,
    });
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
      select: { id: true, categoryId: true, authorId: true, publisherId: true },
    });

    if (!book) throw new NotFoundException('Book not found');

    const orConditions: object[] = [
      { categoryId: book.categoryId },
    ];

    if (book.authorId) orConditions.push({ authorId: book.authorId });
    if (book.publisherId) orConditions.push({ publisherId: book.publisherId });

    return this.prisma.book.findMany({
      where: {
        storeId: store.id,
        id: { not: book.id },
        OR: orConditions,
      },
      include: bookInclude,
      take: 10,
    });
  }
}
