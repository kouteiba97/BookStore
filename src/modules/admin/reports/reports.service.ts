import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { StoreResolver } from '../../../common/tenant/store-resolver.service';
import { EXPENSE_LABELS, ExpenseCategory } from '../money/money.dto';

/** Orders that count as income: confirmed, shipped or delivered. */
const SOLD = Prisma.sql`('confirmed','shipped','delivered')`;
/** A sale's date: when it happened (imports), else when it was recorded. */
const SALE_DATE = Prisma.sql`COALESCE(o."soldAt", o."createdAt")`;
/** Days without a sale after which stock counts as slow. */
const SLOW_DAYS = 90;
const SLOW_INTERVAL = Prisma.raw(`interval '${SLOW_DAYS} days'`);

const cents = (n: number) => Math.round(n * 100) / 100;
const n = (v: unknown) => (v == null ? 0 : Number(v));

export interface Range {
  from: Date;
  to: Date;
}

export interface MonthRow {
  month: string;
  orders: number;
  booksSold: number;
  revenue: number;
  bookRevenue: number;
  shipping: number;
  cogs: number;
  grossMargin: number;
  expenses: number;
  netProfit: number;
  purchases: number;
}

/**
 * Money reports, computed in SQL.
 *
 *   revenue       = order totals (books − discount + shipping)
 *   cost of books = Σ quantity × purchase price frozen on each sale line
 *   gross margin  = revenue − cost of books
 *   net profit    = gross margin − expenses
 *
 * Purchases are cash going out (stock bought), not a cost until the books are
 * sold — shown separately, with what is still owed to suppliers. When some
 * sold books had no purchase price, `costCoverage` says how much of the revenue
 * the margin is based on, instead of pretending those books cost nothing.
 */
@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stores: StoreResolver,
  ) {}

  async overview(range: Range) {
    const storeId = await this.stores.getStoreId();
    const { from, to } = range;

    const [sales, costs, expensesByMonth, expensesByCategory, purchasesByMonth, channels, topBooks, slow, stock, owed] = await Promise.all([
      this.prisma.$queryRaw<{ month: string; orders: bigint; revenue: any; book_revenue: any; shipping: any }[]>`
        SELECT to_char(date_trunc('month', ${SALE_DATE}), 'YYYY-MM') AS month,
               count(*) AS orders,
               sum(o.total) AS revenue,
               sum(o.subtotal - o.discount) AS book_revenue,
               sum(o."shippingCost") AS shipping
          FROM "Order" o
         WHERE o."storeId" = ${storeId} AND o.status::text IN ${SOLD}
           AND ${SALE_DATE} BETWEEN ${from} AND ${to}
         GROUP BY 1 ORDER BY 1`,
      this.prisma.$queryRaw<{ month: string; books: bigint; cogs: any; costed_revenue: any; line_revenue: any }[]>`
        SELECT to_char(date_trunc('month', ${SALE_DATE}), 'YYYY-MM') AS month,
               sum(i.quantity) AS books,
               sum(CASE WHEN i."unitCost" IS NOT NULL THEN i.quantity * i."unitCost" ELSE 0 END) AS cogs,
               sum(CASE WHEN i."unitCost" IS NOT NULL THEN i.quantity * i."unitPrice" ELSE 0 END) AS costed_revenue,
               sum(i.quantity * i."unitPrice") AS line_revenue
          FROM "OrderItem" i JOIN "Order" o ON o.id = i."orderId"
         WHERE o."storeId" = ${storeId} AND o.status::text IN ${SOLD}
           AND ${SALE_DATE} BETWEEN ${from} AND ${to}
         GROUP BY 1 ORDER BY 1`,
      this.prisma.$queryRaw<{ month: string; amount: any }[]>`
        SELECT to_char(date_trunc('month', e.date), 'YYYY-MM') AS month, sum(e.amount) AS amount
          FROM "Expense" e
         WHERE e."storeId" = ${storeId} AND e.date BETWEEN ${from} AND ${to}
         GROUP BY 1 ORDER BY 1`,
      this.prisma.$queryRaw<{ category: string; amount: any }[]>`
        SELECT e.category, sum(e.amount) AS amount
          FROM "Expense" e
         WHERE e."storeId" = ${storeId} AND e.date BETWEEN ${from} AND ${to}
         GROUP BY 1 ORDER BY 2 DESC`,
      this.prisma.$queryRaw<{ month: string; total: any; paid: any }[]>`
        SELECT to_char(date_trunc('month', p.date), 'YYYY-MM') AS month, sum(p.total) AS total, sum(p."paidAmount") AS paid
          FROM "Purchase" p
         WHERE p."storeId" = ${storeId} AND NOT p.cancelled AND p.date BETWEEN ${from} AND ${to}
         GROUP BY 1 ORDER BY 1`,
      this.prisma.$queryRaw<{ channel: string; orders: bigint; revenue: any }[]>`
        SELECT o.channel::text AS channel, count(*) AS orders, sum(o.total) AS revenue
          FROM "Order" o
         WHERE o."storeId" = ${storeId} AND o.status::text IN ${SOLD}
           AND ${SALE_DATE} BETWEEN ${from} AND ${to}
         GROUP BY 1`,
      this.prisma.$queryRaw<{ book_id: string; title: string; qty: bigint; revenue: any; cost: any; costed: boolean }[]>`
        SELECT i."bookId" AS book_id, max(i."bookTitle") AS title, sum(i.quantity) AS qty,
               sum(i.quantity * i."unitPrice") AS revenue,
               sum(CASE WHEN i."unitCost" IS NOT NULL THEN i.quantity * i."unitCost" ELSE 0 END) AS cost,
               bool_and(i."unitCost" IS NOT NULL) AS costed
          FROM "OrderItem" i JOIN "Order" o ON o.id = i."orderId"
         WHERE o."storeId" = ${storeId} AND o.status::text IN ${SOLD}
           AND ${SALE_DATE} BETWEEN ${from} AND ${to}
         GROUP BY 1 ORDER BY 3 DESC, 4 DESC LIMIT 20`,
      this.prisma.$queryRaw<{ id: string; title: string; stock: number; cost: any; price: any; last_sale: Date | null }[]>`
        SELECT b.id, b.title, inv.stock, b."costPrice" AS cost, b.price,
               (SELECT max(COALESCE(o."soldAt", o."createdAt"))
                  FROM "OrderItem" i JOIN "Order" o ON o.id = i."orderId"
                 WHERE i."bookId" = b.id AND o.status::text IN ${SOLD}) AS last_sale
          FROM "Book" b JOIN "Inventory" inv ON inv."bookId" = b.id
         WHERE b."storeId" = ${storeId} AND inv.stock > 0
           AND NOT EXISTS (
             SELECT 1 FROM "OrderItem" i JOIN "Order" o ON o.id = i."orderId"
              WHERE i."bookId" = b.id AND o.status::text IN ${SOLD}
                AND COALESCE(o."soldAt", o."createdAt") > now() - ${SLOW_INTERVAL})
         ORDER BY inv.stock * COALESCE(b."costPrice", b.price, 0) DESC NULLS LAST
         LIMIT 20`,
      this.prisma.$queryRaw<{ titles: bigint; units: bigint; at_cost: any; at_price: any; uncosted: bigint }[]>`
        SELECT count(*) FILTER (WHERE inv.stock > 0) AS titles,
               COALESCE(sum(inv.stock), 0) AS units,
               COALESCE(sum(inv.stock * b."costPrice"), 0) AS at_cost,
               COALESCE(sum(inv.stock * b.price), 0) AS at_price,
               count(*) FILTER (WHERE inv.stock > 0 AND b."costPrice" IS NULL) AS uncosted
          FROM "Book" b JOIN "Inventory" inv ON inv."bookId" = b.id
         WHERE b."storeId" = ${storeId}`,
      this.prisma.$queryRaw<{ owed: any }[]>`
        SELECT COALESCE(sum(p.total - p."paidAmount"), 0) AS owed
          FROM "Purchase" p WHERE p."storeId" = ${storeId} AND NOT p.cancelled`,
    ]);

    // One row per month in the range, even months with no activity.
    const months = monthsBetween(from, to);
    const by = <T extends { month: string }>(rows: T[]) => new Map(rows.map((r) => [r.month, r]));
    const s = by(sales), c = by(costs), e = by(expensesByMonth), p = by(purchasesByMonth);
    const monthly: MonthRow[] = months.map((m) => {
      const revenue = n(s.get(m)?.revenue);
      const cogs = n(c.get(m)?.cogs);
      const expenses = n(e.get(m)?.amount);
      return {
        month: m,
        orders: n(s.get(m)?.orders),
        booksSold: n(c.get(m)?.books),
        revenue: cents(revenue),
        bookRevenue: cents(n(s.get(m)?.book_revenue)),
        shipping: cents(n(s.get(m)?.shipping)),
        cogs: cents(cogs),
        grossMargin: cents(revenue - cogs),
        expenses: cents(expenses),
        netProfit: cents(revenue - cogs - expenses),
        purchases: cents(n(p.get(m)?.total)),
      };
    });

    const sum = (k: keyof MonthRow) => cents(monthly.reduce((a, r) => a + (r[k] as number), 0));
    const revenue = sum('revenue');
    const cogs = sum('cogs');
    const expenses = sum('expenses');
    const orders = sum('orders');
    const lineRevenue = costs.reduce((a, r) => a + n(r.line_revenue), 0);
    const costedRevenue = costs.reduce((a, r) => a + n(r.costed_revenue), 0);
    const st = stock[0];

    return {
      range: { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) },
      kpis: {
        revenue,
        cogs,
        grossMargin: cents(revenue - cogs),
        grossMarginRate: revenue ? Math.round(((revenue - cogs) / revenue) * 1000) / 10 : 0,
        expenses,
        netProfit: cents(revenue - cogs - expenses),
        orders,
        booksSold: sum('booksSold'),
        averageOrder: orders ? cents(revenue / orders) : 0,
        purchases: sum('purchases'),
        owedToSuppliers: cents(n(owed[0]?.owed)),
        /** Share of book sales whose purchase price is known (0–100). */
        costCoverage: lineRevenue ? Math.round((costedRevenue / lineRevenue) * 1000) / 10 : 100,
      },
      monthly,
      channels: channels.map((ch) => ({ channel: ch.channel, orders: n(ch.orders), revenue: cents(n(ch.revenue)) })),
      expensesByCategory: expensesByCategory.map((x) => ({
        category: x.category,
        label: EXPENSE_LABELS[x.category as ExpenseCategory] ?? x.category,
        amount: cents(n(x.amount)),
      })),
      topBooks: topBooks.map((b) => {
        const rev = n(b.revenue);
        const cost = n(b.cost);
        return {
          bookId: b.book_id,
          title: b.title,
          quantity: n(b.qty),
          revenue: cents(rev),
          margin: b.costed ? cents(rev - cost) : null,
        };
      }),
      slowStock: slow.map((b) => ({
        bookId: b.id,
        title: b.title,
        stock: b.stock,
        value: cents(b.stock * n(b.cost ?? b.price)),
        lastSale: b.last_sale ? new Date(b.last_sale).toISOString().slice(0, 10) : null,
      })),
      slowDays: SLOW_DAYS,
      stock: {
        titles: n(st?.titles),
        units: n(st?.units),
        valueAtCost: cents(n(st?.at_cost)),
        valueAtPrice: cents(n(st?.at_price)),
        titlesWithoutCost: n(st?.uncosted),
      },
    };
  }
}

/** "YYYY-MM" for every month from `from` to `to`, inclusive (max 60). */
export function monthsBetween(from: Date, to: Date): string[] {
  const out: string[] = [];
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
  while (d <= to && out.length < 60) {
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return out;
}
