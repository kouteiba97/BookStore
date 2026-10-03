import { Injectable, NotFoundException } from '@nestjs/common';
import { InventoryStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { StoreResolver } from '../../../common/tenant/store-resolver.service';
import { normalizeArabic } from '../../../common/utils/normalize-arabic';
import { thumbUrlFor } from '../../../common/utils/cover-image';

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storeResolver: StoreResolver,
  ) {}

  async list(opts: {
    search?: string;
    status?: InventoryStatus;
    lowStock?: boolean;
    take: number;
  }) {
    const storeId = await this.storeResolver.getStoreId();
    const { search, status, lowStock, take } = opts;
    const q = search?.trim();

    // Status and "low stock" both constrain the inventory row; AND them rather
    // than letting one object key silently overwrite the other.
    const inventoryFilters: Prisma.InventoryWhereInput[] = [];
    if (status) inventoryFilters.push({ status });
    if (lowStock) inventoryFilters.push({ OR: [{ stock: { lte: 3 } }, { status: 'rare' }] });

    const where: Prisma.BookWhereInput = {
      storeId,
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: 'insensitive' } },
              { titleNormalized: { contains: normalizeArabic(q), mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(inventoryFilters.length ? { inventory: { is: { AND: inventoryFilters } } } : {}),
    };

    const [books, total] = await Promise.all([
      this.prisma.book.findMany({
        where,
        include: {
          inventory: true,
          category: { select: { id: true, name: true } },
          authors: {
            select: { author: { select: { id: true, name: true } } },
            orderBy: { position: 'asc' },
          },
          // Carry the academic links so the client can edit them from the stock view.
          subjects: { include: { subject: { select: { id: true, name: true } } } },
        },
        orderBy: { title: 'asc' },
        take,
      }),
      this.prisma.book.count({ where }),
    ]);

    // Flatten the author join rows, and keep a primary `author` so the stock
    // table (which renders a single name per row) keeps working.
    return {
      total,
      books: books.map((book) => {
        const authors = book.authors.map((r) => r.author);
        return { ...book, authors, author: authors[0] ?? null, thumbUrl: thumbUrlFor(book.imageUrl) };
      }),
    };
  }

  async upsert(
    bookId: string,
    dto: { status: 'available' | 'on_request' | 'rare'; stock?: number | null },
  ) {
    const storeId = await this.storeResolver.getStoreId();
    const book = await this.prisma.book.findFirst({
      where: { id: bookId, storeId },
    });
    if (!book) throw new NotFoundException('Book not found');

    return this.prisma.inventory.upsert({
      where: { bookId },
      create: {
        bookId,
        storeId,
        status: dto.status,
        stock: dto.stock ?? null,
      },
      update: {
        status: dto.status,
        stock: dto.stock ?? null,
      },
    });
  }
}
