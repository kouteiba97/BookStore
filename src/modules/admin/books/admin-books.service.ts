import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { StoreResolver } from '../store-resolver.service';
import { normalizeArabic } from '../../../common/utils/normalize-arabic';
import { UpsertBookDto } from './dto/upsert-book.dto';

const bookInclude = {
  inventory: true,
  category: true,
  author: true,
  publisher: true,
  country: true,
  subjects: { include: { subject: true } },
};

@Injectable()
export class AdminBooksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storeResolver: StoreResolver,
  ) {}

  async list(opts: {
    search?: string;
    categoryId?: string;
    inventoryStatus?: string;
    page: number;
    pageSize: number;
  }) {
    const storeId = await this.storeResolver.getStoreId();
    const { search, categoryId, inventoryStatus, page, pageSize } = opts;

    const where: any = {
      storeId,
      ...(categoryId ? { categoryId } : {}),
      ...(inventoryStatus
        ? { inventory: { is: { status: inventoryStatus as any } } }
        : {}),
      ...(search?.trim()
        ? {
            OR: [
              {
                titleNormalized: {
                  contains: normalizeArabic(search),
                  mode: 'insensitive' as const,
                },
              },
              { title: { contains: search, mode: 'insensitive' as const } },
              {
                author: {
                  name: { contains: search, mode: 'insensitive' as const },
                },
              },
            ],
          }
        : {}),
    };

    const [books, total] = await Promise.all([
      this.prisma.book.findMany({
        where,
        include: bookInclude,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.book.count({ where }),
    ]);

    return { books, total, page, pageSize };
  }

  async get(id: string) {
    const storeId = await this.storeResolver.getStoreId();
    const book = await this.prisma.book.findFirst({
      where: { id, storeId },
      include: bookInclude,
    });
    if (!book) throw new NotFoundException('Book not found');
    return book;
  }

  async create(dto: UpsertBookDto) {
    const storeId = await this.storeResolver.getStoreId();
    await this.assertCategory(dto.categoryId);

    const book = await this.prisma.book.create({
      data: {
        storeId,
        title: dto.title,
        titleNormalized: normalizeArabic(dto.title),
        description: dto.description ?? null,
        year: dto.year ?? null,
        price: dto.price ?? null,
        imageUrl: dto.imageUrl ?? null,
        categoryId: dto.categoryId,
        authorId: dto.authorId ?? null,
        publisherId: dto.publisherId ?? null,
        countryId: dto.countryId ?? null,
        ...(dto.inventory
          ? {
              inventory: {
                create: {
                  storeId,
                  status: dto.inventory.status,
                  stock: dto.inventory.stock ?? null,
                },
              },
            }
          : {}),
        ...(dto.subjectIds?.length
          ? {
              subjects: {
                create: dto.subjectIds.map((subjectId) => ({ subjectId })),
              },
            }
          : {}),
      },
      include: bookInclude,
    });

    return book;
  }

  async update(id: string, dto: UpsertBookDto) {
    const storeId = await this.storeResolver.getStoreId();
    const existing = await this.prisma.book.findFirst({
      where: { id, storeId },
    });
    if (!existing) throw new NotFoundException('Book not found');

    await this.assertCategory(dto.categoryId);

    return this.prisma.$transaction(async (tx) => {
      await tx.book.update({
        where: { id },
        data: {
          title: dto.title,
          titleNormalized: normalizeArabic(dto.title),
          description: dto.description ?? null,
          year: dto.year ?? null,
          price: dto.price ?? null,
          imageUrl: dto.imageUrl ?? null,
          categoryId: dto.categoryId,
          authorId: dto.authorId ?? null,
          publisherId: dto.publisherId ?? null,
          countryId: dto.countryId ?? null,
        },
      });

      // Inventory upsert (or remove)
      if (dto.inventory) {
        await tx.inventory.upsert({
          where: { bookId: id },
          create: {
            bookId: id,
            storeId,
            status: dto.inventory.status,
            stock: dto.inventory.stock ?? null,
          },
          update: {
            status: dto.inventory.status,
            stock: dto.inventory.stock ?? null,
          },
        });
      } else if (dto.inventory === null) {
        await tx.inventory.deleteMany({ where: { bookId: id } });
      }

      // Subjects: replace set if provided
      if (Array.isArray(dto.subjectIds)) {
        await tx.bookOnSubject.deleteMany({ where: { bookId: id } });
        if (dto.subjectIds.length) {
          await tx.bookOnSubject.createMany({
            data: dto.subjectIds.map((subjectId) => ({
              bookId: id,
              subjectId,
            })),
          });
        }
      }

      return tx.book.findUnique({
        where: { id },
        include: bookInclude,
      });
    });
  }

  async remove(id: string) {
    const storeId = await this.storeResolver.getStoreId();
    const existing = await this.prisma.book.findFirst({
      where: { id, storeId },
    });
    if (!existing) throw new NotFoundException('Book not found');

    // Block deletion if referenced by orders (preserves history)
    const itemCount = await this.prisma.orderItem.count({
      where: { bookId: id },
    });
    if (itemCount > 0) {
      throw new BadRequestException(
        'Cannot delete a book referenced by existing orders',
      );
    }

    await this.prisma.book.delete({ where: { id } });
    return { ok: true };
  }

  private async assertCategory(categoryId: string) {
    const exists = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });
    if (!exists) throw new BadRequestException('Invalid categoryId');
  }
}
