import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { StoreResolver } from '../store-resolver.service';
import { normalizeArabic } from '../../../common/utils/normalize-arabic';
import {
  bookInclude,
  serializeBook,
  serializeBooks,
} from '../../../common/utils/book-serializer';
import { UpsertBookDto } from './dto/upsert-book.dto';

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
              // Search across every author of the book, not just a primary one.
              {
                authors: {
                  some: {
                    author: {
                      name: { contains: search, mode: 'insensitive' as const },
                    },
                  },
                },
              },
            ],
          }
        : {}),
    };

    const [books, total] = await Promise.all([
      this.prisma.book.findMany({
        where,
        include: bookInclude as any,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.book.count({ where }),
    ]);

    return { books: serializeBooks(books), total, page, pageSize };
  }

  async get(id: string) {
    const storeId = await this.storeResolver.getStoreId();
    const book = await this.prisma.book.findFirst({
      where: { id, storeId },
      include: bookInclude as any,
    });
    if (!book) throw new NotFoundException('Book not found');
    return serializeBook(book);
  }

  async create(dto: UpsertBookDto) {
    const storeId = await this.storeResolver.getStoreId();

    const categoryId = await this.resolveCategoryId(
      dto.categoryId,
      dto.categoryName,
    );
    const authorIds = await this.resolveRefList(
      'author',
      dto.authorIds,
      dto.authorNames,
      dto.authorId,
      dto.authorName,
    );
    const publisherIds = await this.resolveRefList(
      'publisher',
      dto.publisherIds,
      dto.publisherNames,
      dto.publisherId,
      dto.publisherName,
    );
    const countryId = await this.resolveOptionalRef(
      'country',
      dto.countryId,
      dto.countryName,
    );
    const academic = await this.resolveAcademic(dto);

    const book = await this.prisma.book.create({
      data: {
        storeId,
        title: dto.title,
        titleNormalized: normalizeArabic(dto.title),
        description: dto.description ?? null,
        notes: dto.notes ?? null,
        year: dto.year ?? null,
        price: dto.price ?? null,
        imageUrl: dto.imageUrl ?? null,
        categoryId,
        countryId,
        authors: {
          create: authorIds.map((authorId, position) => ({
            authorId,
            position,
          })),
        },
        publishers: {
          create: publisherIds.map((publisherId, position) => ({
            publisherId,
            position,
          })),
        },
        fields: { create: academic.fieldIds.map((fieldId) => ({ fieldId })) },
        years: { create: academic.yearIds.map((yearId) => ({ yearId })) },
        subjects: {
          create: academic.subjectIds.map((subjectId) => ({ subjectId })),
        },
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
      },
      include: bookInclude as any,
    });

    return serializeBook(book);
  }

  async update(id: string, dto: UpsertBookDto) {
    const storeId = await this.storeResolver.getStoreId();
    const existing = await this.prisma.book.findFirst({
      where: { id, storeId },
    });
    if (!existing) throw new NotFoundException('Book not found');

    const categoryId = await this.resolveCategoryId(
      dto.categoryId,
      dto.categoryName,
    );
    const authorIds = await this.resolveRefList(
      'author',
      dto.authorIds,
      dto.authorNames,
      dto.authorId,
      dto.authorName,
    );
    const publisherIds = await this.resolveRefList(
      'publisher',
      dto.publisherIds,
      dto.publisherNames,
      dto.publisherId,
      dto.publisherName,
    );
    const countryId = await this.resolveOptionalRef(
      'country',
      dto.countryId,
      dto.countryName,
    );
    const academic = await this.resolveAcademic(dto);

    // Only touch a relation set when the client actually sent it, so a partial
    // payload cannot silently wipe existing links.
    const sentAuthors =
      dto.authorIds !== undefined ||
      dto.authorNames !== undefined ||
      dto.authorId !== undefined ||
      dto.authorName !== undefined;
    const sentPublishers =
      dto.publisherIds !== undefined ||
      dto.publisherNames !== undefined ||
      dto.publisherId !== undefined ||
      dto.publisherName !== undefined;

    await this.prisma.$transaction(async (tx) => {
      await tx.book.update({
        where: { id },
        data: {
          title: dto.title,
          titleNormalized: normalizeArabic(dto.title),
          description: dto.description ?? null,
          notes: dto.notes ?? null,
          year: dto.year ?? null,
          price: dto.price ?? null,
          imageUrl: dto.imageUrl ?? null,
          categoryId,
          countryId,
        },
      });

      if (sentAuthors) {
        await tx.bookAuthor.deleteMany({ where: { bookId: id } });
        if (authorIds.length) {
          await tx.bookAuthor.createMany({
            data: authorIds.map((authorId, position) => ({
              bookId: id,
              authorId,
              position,
            })),
          });
        }
      }

      if (sentPublishers) {
        await tx.bookPublisher.deleteMany({ where: { bookId: id } });
        if (publisherIds.length) {
          await tx.bookPublisher.createMany({
            data: publisherIds.map((publisherId, position) => ({
              bookId: id,
              publisherId,
              position,
            })),
          });
        }
      }

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

      if (Array.isArray(dto.fieldIds)) {
        await tx.bookOnField.deleteMany({ where: { bookId: id } });
        if (academic.fieldIds.length) {
          await tx.bookOnField.createMany({
            data: academic.fieldIds.map((fieldId) => ({ bookId: id, fieldId })),
          });
        }
      }

      if (Array.isArray(dto.yearIds)) {
        await tx.bookOnYear.deleteMany({ where: { bookId: id } });
        if (academic.yearIds.length) {
          await tx.bookOnYear.createMany({
            data: academic.yearIds.map((yearId) => ({ bookId: id, yearId })),
          });
        }
      }

      if (Array.isArray(dto.subjectIds)) {
        await tx.bookOnSubject.deleteMany({ where: { bookId: id } });
        if (academic.subjectIds.length) {
          await tx.bookOnSubject.createMany({
            data: academic.subjectIds.map((subjectId) => ({
              bookId: id,
              subjectId,
            })),
          });
        }
      }
    });

    const fresh = await this.prisma.book.findUnique({
      where: { id },
      include: bookInclude as any,
    });
    return serializeBook(fresh);
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

  /**
   * Returns a valid category id. Priority: validated id → find-or-create by name
   * → fall back to the shared "غير مصنف" (Uncategorized) category.
   */
  private async resolveCategoryId(
    categoryId?: string | null,
    categoryName?: string | null,
  ): Promise<string> {
    if (categoryId) {
      const exists = await this.prisma.category.findUnique({
        where: { id: categoryId },
      });
      if (!exists) throw new BadRequestException('Invalid categoryId');
      return categoryId;
    }

    const name = categoryName?.trim();
    if (name) {
      const row = await this.prisma.category.upsert({
        where: { name },
        create: { name },
        update: {},
      });
      return row.id;
    }

    const fallback = await this.prisma.category.upsert({
      where: { name: 'غير مصنف' },
      create: { name: 'غير مصنف' },
      update: {},
    });
    return fallback.id;
  }

  /**
   * Resolve an ordered, de-duplicated list of author/publisher ids from any mix
   * of ids, free-text names, and the deprecated singular fields. Names are
   * found-or-created (race-safe via the unique name constraint).
   */
  private async resolveRefList(
    model: 'author' | 'publisher',
    ids?: string[] | null,
    names?: string[] | null,
    legacyId?: string | null,
    legacyName?: string | null,
  ): Promise<string[]> {
    const out: string[] = [];
    const push = (id: string) => {
      if (id && !out.includes(id)) out.push(id);
    };

    const givenIds = [...(ids ?? []), ...(legacyId ? [legacyId] : [])]
      .map((v) => v?.trim())
      .filter(Boolean) as string[];

    if (givenIds.length) {
      const found = await (this.prisma[model] as any).findMany({
        where: { id: { in: givenIds } },
        select: { id: true },
      });
      const valid = new Set(found.map((r: any) => r.id));
      const bad = givenIds.find((id) => !valid.has(id));
      if (bad) throw new BadRequestException(`Invalid ${model} id: ${bad}`);
      givenIds.forEach(push);
    }

    const givenNames = [...(names ?? []), ...(legacyName ? [legacyName] : [])]
      .map((v) => v?.trim())
      .filter(Boolean) as string[];

    for (const name of givenNames) {
      const row = await (this.prisma[model] as any).upsert({
        where: { name },
        create: { name },
        update: {},
      });
      push(row.id as string);
    }

    return out;
  }

  /**
   * Resolve a single optional reference (country). Priority: given id →
   * find-or-create by name → null.
   */
  private async resolveOptionalRef(
    model: 'country',
    id?: string | null,
    name?: string | null,
  ): Promise<string | null> {
    if (id) return id;
    const trimmed = name?.trim();
    if (!trimmed) return null;

    const row = await (this.prisma[model] as any).upsert({
      where: { name: trimmed },
      create: { name: trimmed },
      update: {},
    });
    return row.id as string;
  }

  /**
   * Validate the academic placement ids. Attaching a book to a speciality or a
   * year alone is legitimate — it is what makes the book visible under that
   * speciality without needing a subject to exist first.
   */
  private async resolveAcademic(dto: UpsertBookDto): Promise<{
    fieldIds: string[];
    yearIds: string[];
    subjectIds: string[];
  }> {
    const uniq = (v?: string[] | null) =>
      Array.from(
        new Set((v ?? []).map((x) => x?.trim()).filter(Boolean)),
      ) as string[];

    const fieldIds = uniq(dto.fieldIds);
    const yearIds = uniq(dto.yearIds);
    const subjectIds = uniq(dto.subjectIds);

    const check = async (
      model: 'field' | 'academicYear' | 'subject',
      list: string[],
      label: string,
    ) => {
      if (!list.length) return;
      const found = await (this.prisma[model] as any).findMany({
        where: { id: { in: list } },
        select: { id: true },
      });
      const valid = new Set(found.map((r: any) => r.id));
      const bad = list.find((id) => !valid.has(id));
      if (bad) throw new BadRequestException(`Invalid ${label}: ${bad}`);
    };

    await check('field', fieldIds, 'fieldId');
    await check('academicYear', yearIds, 'yearId');
    await check('subject', subjectIds, 'subjectId');

    return { fieldIds, yearIds, subjectIds };
  }
}
