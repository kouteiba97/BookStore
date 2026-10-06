import { BadRequestException, Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Prisma } from '@prisma/client';
import { AdminAuthGuard } from '../../../common/guards/admin-auth.guard';
import { PrismaService } from '../../../prisma/prisma.service';
import { StoreResolver } from '../../../common/tenant/store-resolver.service';
import { ORDER_STATUSES, optionalEnum } from '../../../common/validation/query';
import { writeWorkbook } from './workbook';
import { xlsx } from './data-import.controller';
import { FIELD_LABELS } from './fields';

const MAX_ROWS = 20_000;
/** Orders that count as income (not pending, not cancelled). */
const INCOME_STATUSES = ['confirmed', 'shipped', 'delivered'] as const;

const STATUS_AR: Record<string, string> = {
  available: 'متوفر',
  on_request: 'حسب الطلب',
  rare: 'نادر',
  pending: 'قيد الانتظار',
  confirmed: 'مؤكد',
  shipped: 'تم الشحن',
  delivered: 'تم التسليم',
  cancelled: 'ملغى',
};

/**
 * Excel exports of the store's own data. Column names are the ones the import
 * wizard recognises, so an export can be edited in Excel and imported back.
 */
@UseGuards(AdminAuthGuard)
@Throttle({ default: { limit: 20, ttl: 60_000 } })
@Controller('v1/admin/export')
export class DataExportController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stores: StoreResolver,
  ) {}

  @Get('books')
  async books(@Res({ passthrough: true }) res: Response) {
    const storeId = await this.stores.getStoreId();
    const books = await this.prisma.book.findMany({
      where: { storeId },
      orderBy: [{ title: 'asc' }, { id: 'asc' }],
      take: MAX_ROWS,
      select: {
        title: true,
        year: true,
        price: true,
        costPrice: true,
        description: true,
        notes: true,
        imageUrl: true,
        createdAt: true,
        category: { select: { name: true } },
        country: { select: { name: true } },
        inventory: { select: { stock: true, status: true } },
        authors: { select: { author: { select: { name: true } } }, orderBy: { position: 'asc' } },
        publishers: { select: { publisher: { select: { name: true } } }, orderBy: { position: 'asc' } },
        _count: { select: { images: true } },
      },
    });

    const header = [
      FIELD_LABELS.title, 'المؤلفون', 'دور النشر', FIELD_LABELS.category, FIELD_LABELS.year,
      FIELD_LABELS.price, FIELD_LABELS.costPrice, FIELD_LABELS.quantity, FIELD_LABELS.status,
      FIELD_LABELS.country, FIELD_LABELS.description, FIELD_LABELS.notes, FIELD_LABELS.imageUrl, 'عدد الصور', 'تاريخ الإضافة',
    ];
    const rows = books.map((b) => [
      b.title,
      b.authors.map((a) => a.author.name).join('، '),
      b.publishers.map((p) => p.publisher.name).join('، '),
      b.category.name,
      b.year,
      num(b.price),
      num(b.costPrice),
      b.inventory?.stock ?? null,
      b.inventory ? STATUS_AR[b.inventory.status] : null,
      b.country?.name ?? null,
      b.description,
      b.notes,
      b.imageUrl,
      Math.max(b._count.images, b.imageUrl ? 1 : 0),
      day(b.createdAt),
    ]);
    const stockValue = books.reduce((s, b) => s + (num(b.costPrice) ?? 0) * (b.inventory?.stock ?? 0), 0);
    const saleValue = books.reduce((s, b) => s + (num(b.price) ?? 0) * (b.inventory?.stock ?? 0), 0);

    return xlsx(
      res,
      writeWorkbook([
        { name: 'الكتب', rows: [header, ...rows], widths: [36, 26, 22, 14, 9, 11, 11, 9, 11, 12, 40, 30, 40, 9, 12] },
        {
          name: 'ملخص المخزون',
          rows: [
            ['البيان', 'القيمة'],
            ['عدد العناوين', books.length],
            ['عدد النسخ في المخزون', books.reduce((s, b) => s + (b.inventory?.stock ?? 0), 0)],
            ['قيمة المخزون بسعر الشراء (دج)', round(stockValue)],
            ['قيمة المخزون بسعر البيع (دج)', round(saleValue)],
            ['كتب بدون سعر بيع', books.filter((b) => b.price === null).length],
            ['كتب بدون صورة', books.filter((b) => !b.imageUrl).length],
          ],
          widths: [34, 16],
        },
      ]),
      `books-${day(new Date())}.xlsx`,
    );
  }

  @Get('orders')
  async orders(
    @Res({ passthrough: true }) res: Response,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: string,
  ) {
    const storeId = await this.stores.getStoreId();
    const range = dateRange(from, to);
    const where: Prisma.OrderWhereInput = {
      storeId,
      ...(range ? { createdAt: range } : {}),
      ...(optionalEnum(status, ORDER_STATUSES, 'status') ? { status: status as any } : {}),
    };
    const orders = await this.prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: MAX_ROWS,
      include: { items: true },
    });

    const ref = (id: string) => id.slice(0, 8).toUpperCase();
    const orderRows = orders.map((o) => [
      ref(o.id), day(o.createdAt), `${o.firstName} ${o.lastName}`, o.phone, o.wilaya, o.address,
      STATUS_AR[o.status], num(o.subtotal), num(o.shippingCost), num(o.total),
      o.items.reduce((s, i) => s + i.quantity, 0), o.notes,
    ]);
    const itemRows = orders.flatMap((o) =>
      o.items.map((i) => [ref(o.id), day(o.createdAt), i.bookTitle, i.quantity, num(i.unitPrice), round(Number(i.unitPrice) * i.quantity), STATUS_AR[o.status]]),
    );

    // Income per month: confirmed, shipped and delivered orders.
    const months = new Map<string, { orders: number; books: number; revenue: number; shipping: number }>();
    for (const o of orders) {
      if (!(INCOME_STATUSES as readonly string[]).includes(o.status)) continue;
      const k = day(o.createdAt).slice(0, 7);
      const m = months.get(k) ?? { orders: 0, books: 0, revenue: 0, shipping: 0 };
      m.orders++;
      m.books += o.items.reduce((s, i) => s + i.quantity, 0);
      m.revenue += Number(o.total);
      m.shipping += Number(o.shippingCost);
      months.set(k, m);
    }
    const monthRows = [...months.entries()].sort().map(([k, m]) => [k, m.orders, m.books, round(m.revenue - m.shipping), round(m.shipping), round(m.revenue)]);

    return xlsx(
      res,
      writeWorkbook([
        {
          name: 'الطلبات',
          rows: [['رقم الطلب', 'التاريخ', 'الزبون', 'الهاتف', 'الولاية', 'العنوان', 'الحالة', 'المجموع الفرعي', 'التوصيل', 'المجموع', 'عدد الكتب', 'ملاحظات'], ...orderRows],
          widths: [11, 11, 22, 14, 14, 30, 12, 13, 10, 12, 9, 24],
        },
        {
          name: 'تفاصيل الطلبات',
          rows: [['رقم الطلب', 'التاريخ', 'الكتاب', 'الكمية', 'سعر الوحدة', 'المجموع', 'حالة الطلب'], ...itemRows],
          widths: [11, 11, 36, 8, 11, 12, 12],
        },
        {
          name: 'المداخيل الشهرية',
          rows: [['الشهر', 'عدد الطلبات', 'عدد الكتب', 'مبيعات الكتب (دج)', 'التوصيل (دج)', 'المجموع (دج)'], ...monthRows],
          widths: [10, 12, 11, 16, 13, 14],
        },
      ]),
      `orders-${day(new Date())}.xlsx`,
    );
  }
}

const num = (d: Prisma.Decimal | null | undefined) => (d == null ? null : Number(d));
const round = (n: number) => Math.round(n * 100) / 100;
const day = (d: Date) => d.toISOString().slice(0, 10);

function dateRange(from?: string, to?: string): Prisma.DateTimeFilter | null {
  const parse = (s: string | undefined, end: boolean) => {
    if (!s) return undefined;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new BadRequestException('Dates must be YYYY-MM-DD');
    return new Date(`${s}T${end ? '23:59:59.999' : '00:00:00.000'}Z`);
  };
  const gte = parse(from, false);
  const lte = parse(to, true);
  return gte || lte ? { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) } : null;
}
