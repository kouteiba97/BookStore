import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StoreResolver } from '../../common/tenant/store-resolver.service';
import { bookCardInclude, serializePublicBooks } from '../../common/utils/book-serializer';
import { BUILTIN_KINDS, HOME_SHELF_LIMIT, SHELF_KIND } from '../../common/home/home-layout';

/** The storefront's view of the home layout the admin arranges. */
@Injectable()
export class HomeSectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stores: StoreResolver,
  ) {}

  /**
   * Visible sections in order. Built-ins carry no data (the storefront already
   * fetches categories and books); shelves carry their first books and total,
   * and an empty shelf is left out. A store that never arranged its home gets
   * the default layout; a built-in added after it did is appended.
   */
  async list(storeSlug: string) {
    const store = await this.stores.bySlug(storeSlug);
    const rows = await this.prisma.homeSection.findMany({
      where: { storeId: store.id },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      include: {
        books: {
          orderBy: { position: 'asc' },
          take: HOME_SHELF_LIMIT,
          include: { book: { include: bookCardInclude as any } },
        },
        _count: { select: { books: true } },
      },
    });

    const present = new Set(rows.map((r) => r.kind));
    const sections: any[] = [];
    for (const r of rows) {
      if (!r.visible) continue;
      if (r.kind === SHELF_KIND) {
        if (!r._count.books) continue;
        sections.push({
          id: r.id,
          kind: r.kind,
          title: r.title,
          subtitle: r.subtitle,
          total: r._count.books,
          books: serializePublicBooks(r.books.map((b: any) => b.book)),
        });
      } else {
        sections.push({ id: r.id, kind: r.kind, title: r.title, subtitle: r.subtitle });
      }
    }
    for (const kind of BUILTIN_KINDS) {
      if (!present.has(kind)) sections.push({ id: kind, kind, title: null, subtitle: null });
    }
    return sections;
  }

  /** One shelf with all its books — the «عرض الكل» page. */
  async shelf(storeSlug: string, id: string) {
    const store = await this.stores.bySlug(storeSlug);
    const row = await this.prisma.homeSection.findFirst({
      where: { id, storeId: store.id, kind: SHELF_KIND, visible: true },
      include: {
        books: {
          orderBy: { position: 'asc' },
          include: { book: { include: bookCardInclude as any } },
        },
      },
    });
    if (!row) throw new NotFoundException('Section not found');
    return {
      id: row.id,
      title: row.title,
      subtitle: row.subtitle,
      books: serializePublicBooks(row.books.map((b: any) => b.book)),
    };
  }
}
