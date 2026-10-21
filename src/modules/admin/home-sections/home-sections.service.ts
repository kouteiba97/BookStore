import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { StoreResolver } from '../../../common/tenant/store-resolver.service';
import { thumbUrlFor } from '../../../common/utils/cover-image';
import { BUILTIN_KINDS, SHELF_KIND, isBuiltin } from '../../../common/home/home-layout';
import {
  CreateHomeSectionDto,
  ReorderHomeSectionsDto,
  SetShelfBooksDto,
  UpdateHomeSectionDto,
} from './dto/home-section.dto';

const clean = (s: string | null | undefined) => {
  const t = (s ?? '').trim();
  return t ? t : null;
};

/** The admin's editor for the storefront home page layout. */
@Injectable()
export class AdminHomeSectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stores: StoreResolver,
  ) {}

  /**
   * Every section, hidden ones included, with each shelf's books. The first
   * call writes the default layout, and any built-in added since is appended,
   * so the admin always edits real rows.
   */
  async list() {
    const storeId = await this.stores.getStoreId();
    await this.ensureBuiltins(storeId);
    const rows = await this.prisma.homeSection.findMany({
      where: { storeId },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      include: {
        books: {
          orderBy: { position: 'asc' },
          include: {
            book: {
              select: {
                id: true,
                title: true,
                imageUrl: true,
                price: true,
                inventory: { select: { status: true, stock: true } },
              },
            },
          },
        },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      title: r.title,
      subtitle: r.subtitle,
      visible: r.visible,
      position: r.position,
      books:
        r.kind === SHELF_KIND
          ? r.books.map((b) => ({ ...b.book, thumbUrl: thumbUrlFor(b.book.imageUrl) }))
          : undefined,
    }));
  }

  /** A new shelf, placed first so it shows at the top of the home page. */
  async create(dto: CreateHomeSectionDto) {
    const storeId = await this.stores.getStoreId();
    await this.ensureBuiltins(storeId);
    const first = await this.prisma.homeSection.aggregate({
      where: { storeId },
      _min: { position: true },
    });
    const row = await this.prisma.homeSection.create({
      data: {
        storeId,
        kind: SHELF_KIND,
        title: clean(dto.title),
        subtitle: clean(dto.subtitle),
        position: (first._min.position ?? 0) - 1,
      },
    });
    return { id: row.id };
  }

  async update(id: string, dto: UpdateHomeSectionDto) {
    const row = await this.find(id);
    const data: { title?: string | null; subtitle?: string | null; visible?: boolean } = {};
    if (dto.title !== undefined) {
      data.title = clean(dto.title);
      if (!data.title && row.kind === SHELF_KIND) {
        throw new BadRequestException('اسم القسم مطلوب');
      }
    }
    if (dto.subtitle !== undefined) data.subtitle = clean(dto.subtitle);
    if (dto.visible !== undefined) data.visible = dto.visible;
    await this.prisma.homeSection.update({ where: { id }, data });
    return { ok: true };
  }

  /** Only shelves can be deleted; a built-in block is hidden instead. */
  async remove(id: string) {
    const row = await this.find(id);
    if (isBuiltin(row.kind)) {
      throw new BadRequestException('لا يمكن حذف هذا القسم، يمكن إخفاؤه فقط');
    }
    await this.prisma.homeSection.delete({ where: { id } });
    return { ok: true };
  }

  /** `ids` in display order; sections it leaves out keep their place after them. */
  async reorder(dto: ReorderHomeSectionsDto) {
    const storeId = await this.stores.getStoreId();
    const rows = await this.prisma.homeSection.findMany({
      where: { storeId },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      select: { id: true },
    });
    const known = new Set(rows.map((r) => r.id));
    const wanted = [...new Set(dto.ids)].filter((id) => known.has(id));
    const order = [...wanted, ...rows.map((r) => r.id).filter((id) => !wanted.includes(id))];
    await this.prisma.$transaction(
      order.map((id, position) =>
        this.prisma.homeSection.update({ where: { id }, data: { position } }),
      ),
    );
    return { ok: true };
  }

  /** Replace a shelf's books with `bookIds`, in that order. */
  async setBooks(id: string, dto: SetShelfBooksDto) {
    const row = await this.find(id);
    if (row.kind !== SHELF_KIND) throw new BadRequestException('هذا القسم لا يحتوي على كتب مختارة');
    const ids = [...new Set(dto.bookIds)];
    const owned = await this.prisma.book.findMany({
      where: { id: { in: ids }, storeId: row.storeId },
      select: { id: true },
    });
    const ok = new Set(owned.map((b) => b.id));
    const bookIds = ids.filter((b) => ok.has(b));
    await this.prisma.$transaction([
      this.prisma.homeSectionBook.deleteMany({ where: { sectionId: id } }),
      this.prisma.homeSectionBook.createMany({
        data: bookIds.map((bookId, position) => ({ sectionId: id, bookId, position })),
      }),
    ]);
    return { count: bookIds.length };
  }

  private async find(id: string) {
    const storeId = await this.stores.getStoreId();
    const row = await this.prisma.homeSection.findFirst({ where: { id, storeId } });
    if (!row) throw new NotFoundException('القسم غير موجود');
    return row;
  }

  /**
   * Write any missing built-in block: the whole default layout on first use,
   * later only kinds added since, at the end. A per-store advisory lock keeps
   * two concurrent first loads from writing it twice.
   */
  private async ensureBuiltins(storeId: string) {
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'home-sections:' + storeId}))`;
      const rows = await tx.homeSection.findMany({
        where: { storeId },
        select: { kind: true, position: true },
      });
      const present = new Set(rows.map((r) => r.kind));
      const missing = BUILTIN_KINDS.filter((k) => !present.has(k));
      if (!missing.length) return;
      const start = rows.length ? Math.max(...rows.map((r) => r.position)) + 1 : 0;
      await tx.homeSection.createMany({
        data: missing.map((kind, i) => ({ storeId, kind, position: start + i })),
      });
    });
  }
}
