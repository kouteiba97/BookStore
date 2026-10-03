import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Single-store helper. The admin UI doesn't pass a storeSlug — we resolve the
 * one configured store (env override → first store row).
 */
@Injectable()
export class StoreResolver {
  constructor(private readonly prisma: PrismaService) {}

  private cached: { id: string; slug: string } | null = null;

  async getStore() {
    if (this.cached) return this.cached;

    const slug = process.env.STORE_SLUG;
    const store = slug
      ? await this.prisma.store.findUnique({ where: { slug } })
      : await this.prisma.store.findFirst({ orderBy: { createdAt: 'asc' } });

    if (!store) throw new NotFoundException('No store configured');

    this.cached = { id: store.id, slug: store.slug };
    return this.cached;
  }

  async getStoreId() {
    return (await this.getStore()).id;
  }

  /** slug → store, remembered briefly; unknown slugs are remembered too. */
  private readonly bySlugCache = new Map<string, { store: { id: string; slug: string; name: string } | null; at: number }>();

  /**
   * The store a public URL names. Every storefront request starts with this
   * lookup; stores change almost never, so a one-minute cache saves a database
   * round trip (~50 ms in production) on each of them.
   */
  async bySlug(slug: string): Promise<{ id: string; slug: string; name: string }> {
    const hit = this.bySlugCache.get(slug);
    if (hit && Date.now() - hit.at < SLUG_TTL_MS) {
      if (!hit.store) throw new NotFoundException('Store not found');
      return hit.store;
    }
    const store = await this.prisma.store.findUnique({
      where: { slug },
      select: { id: true, slug: true, name: true },
    });
    // Bounded: random slugs from crawlers must not grow the map forever.
    if (this.bySlugCache.size >= 100) this.bySlugCache.clear();
    this.bySlugCache.set(slug, { store, at: Date.now() });
    if (!store) throw new NotFoundException('Store not found');
    return store;
  }
}

const SLUG_TTL_MS = 60_000;
