import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { StoreResolver } from '../store-resolver.service';

@Injectable()
export class StatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storeResolver: StoreResolver,
  ) {}

  async overview(days: number) {
    const storeId = await this.storeResolver.getStoreId();

    const since = new Date();
    since.setDate(since.getDate() - days);

    const [
      booksCount,
      categoriesCount,
      authorsCount,
      requestsByStatus,
      ordersByStatus,
      revenueAgg,
      ordersInRange,
      requestsInRange,
      topBooksRaw,
      lowStockCount,
      recentOrders,
      recentRequests,
    ] = await Promise.all([
      this.prisma.book.count({ where: { storeId } }),
      this.prisma.category.count(),
      this.prisma.author.count(),
      this.prisma.request.groupBy({
        by: ['status'],
        where: { storeId },
        _count: true,
      }),
      this.prisma.order.groupBy({
        by: ['status'],
        where: { storeId },
        _count: true,
      }),
      this.prisma.order.aggregate({
        where: {
          storeId,
          status: { in: ['confirmed', 'shipped', 'delivered'] },
        },
        _sum: { total: true },
      }),
      this.prisma.order.findMany({
        where: { storeId, createdAt: { gte: since } },
        select: { id: true, total: true, status: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.request.findMany({
        where: { storeId, createdAt: { gte: since } },
        select: { id: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.orderItem.groupBy({
        by: ['bookId', 'bookTitle'],
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 5,
      }),
      this.prisma.inventory.count({
        where: { storeId, OR: [{ stock: { lte: 3 } }, { status: 'rare' }] },
      }),
      this.prisma.order.findMany({
        where: { storeId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          total: true,
          status: true,
          createdAt: true,
        },
      }),
      this.prisma.request.findMany({
        where: { storeId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          bookName: true,
          status: true,
          createdAt: true,
        },
      }),
    ]);

    // Bucket per-day for charts
    const dailyOrders = this.bucketByDay(
      ordersInRange.map((o) => ({ date: o.createdAt, value: Number(o.total) })),
      days,
    );
    const dailyRequests = this.bucketByDay(
      requestsInRange.map((r) => ({ date: r.createdAt, value: 1 })),
      days,
    );

    const totalRevenue = Number(revenueAgg._sum.total ?? 0);

    const totalRequests = requestsByStatus.reduce(
      (sum, r) => sum + r._count,
      0,
    );
    const doneRequests =
      requestsByStatus.find((r) => r.status === 'done')?._count ?? 0;
    const conversionRate =
      totalRequests > 0 ? (doneRequests / totalRequests) * 100 : 0;

    return {
      kpis: {
        booksCount,
        categoriesCount,
        authorsCount,
        totalRevenue,
        totalRequests,
        totalOrders: ordersByStatus.reduce((sum, o) => sum + o._count, 0),
        conversionRate,
        lowStockCount,
      },
      requestsByStatus,
      ordersByStatus,
      dailyOrders,
      dailyRequests,
      topBooks: topBooksRaw.map((t) => ({
        bookId: t.bookId,
        title: t.bookTitle,
        quantity: t._sum.quantity ?? 0,
      })),
      recentOrders,
      recentRequests,
    };
  }

  private bucketByDay(
    rows: { date: Date; value: number }[],
    days: number,
  ): { date: string; value: number }[] {
    const buckets = new Map<string, number>();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      buckets.set(d.toISOString().slice(0, 10), 0);
    }

    for (const row of rows) {
      const key = new Date(row.date).toISOString().slice(0, 10);
      if (buckets.has(key)) {
        buckets.set(key, buckets.get(key)! + row.value);
      }
    }

    return [...buckets.entries()].map(([date, value]) => ({ date, value }));
  }
}
