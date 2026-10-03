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
}
