import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { StoreResolver } from '../store-resolver.service';

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storeResolver: StoreResolver,
  ) {}

  async list(opts: { search?: string; status?: string; lowStock?: boolean }) {
    const storeId = await this.storeResolver.getStoreId();
    const { search, status, lowStock } = opts;

    const where: Prisma.BookWhereInput = {
      storeId,
      ...(search?.trim()
        ? { title: { contains: search, mode: 'insensitive' } }
        : {}),
      ...(status
        ? { inventory: { is: { status: status as any } } }
        : {}),
      ...(lowStock
        ? {
            inventory: {
              is: {
                OR: [{ stock: { lte: 3 } }, { status: 'rare' }],
              },
            },
          }
        : {}),
    };

    const books = await this.prisma.book.findMany({
      where,
      include: {
        inventory: true,
        category: { select: { id: true, name: true } },
        author: { select: { id: true, name: true } },
      },
      orderBy: { title: 'asc' },
    });

    return books;
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
