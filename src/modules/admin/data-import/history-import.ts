import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { normalizeArabic } from '../../../common/utils/normalize-arabic';
import { moveStock } from '../../../common/stock/stock';
import { findOrCreateBooks, titleKey } from '../../../common/stock/book-lookup';
import { computeOrderTotals } from '../orders/order-rules';
import { EXPENSE_LABELS } from '../money/money.dto';
import { MoneyService } from '../money/money.service';
import { isTotalsLabel } from './fields';
import { ImportKind } from './kinds';
import {
  INVALID,
  PaymentKey,
  parseDate,
  parseExpenseCategory,
  parsePayment,
  parsePrice,
  parseQuantity,
  text,
} from './values';
import { ReadSheet } from './workbook';

export type HistoryKind = Exclude<ImportKind, 'catalog'>;

export interface HistoryOptions {
  kind: HistoryKind;
  sheet: string;
  headerRow: number;
  mapping: Record<string, number | undefined>;
  /** Sales: take the sold books out of current stock (default no — it is history). */
  applyStock?: boolean;
  /** Purchases: put the bought books into current stock (default no). */
  addToStock?: boolean;
  /** Purchases: set each book's purchase price from these lines (default yes). */
  updateCostPrice?: boolean;
}

export interface Issue {
  code: string;
  level: 'error' | 'warning';
  message: string;
}

export interface Line {
  row: number;
  date: Date | null;
  group: string;
  title: string;
  author: string | null;
  quantity: number;
  unitPrice: number | null;
  salePrice: number | null;
  customer: string | null;
  phone: string | null;
  wilaya: string | null;
  supplier: string | null;
  reference: string | null;
  payment: PaymentKey | null;
  notes: string | null;
  // expenses
  amount: number | null;
  category: string | null;
  description: string | null;
}

export interface HistoryRow {
  row: number;
  title: string;
  action: 'create' | 'skip' | 'error';
  issues: Issue[];
  changes: string[];
  cells: string[];
  line?: Line;
}

const cents = (n: number) => Math.round(n * 100) / 100;

/**
 * Imports a shop's past sales, purchases or expenses from a spreadsheet.
 * Lines sharing an invoice/receipt number become one sale or purchase.
 */
@Injectable()
export class HistoryImport {
  constructor(
    private readonly prisma: PrismaService,
    private readonly money: MoneyService,
  ) {}

  /** Read and check every row; nothing is written. */
  async plan(storeId: string, sheet: ReadSheet, o: HistoryOptions) {
    const rows: HistoryRow[] = [];
    const col = (f: string) => o.mapping[f];
    const has = (f: string) => col(f) !== undefined && col(f) !== null;
    const notices: string[] = [];
    if (o.kind !== 'expenses' && !has('date')) notices.push('لا يوجد عمود تاريخ: ستُسجَّل العمليات بتاريخ اليوم.');
    if (o.kind === 'expenses' && !has('date')) notices.push('لا يوجد عمود تاريخ: ستُسجَّل المصاريف بتاريخ اليوم.');

    for (let r = o.headerRow; r < sheet.rows.length; r++) {
      const cells = sheet.rows[r] ?? [];
      if (!cells.some((c) => text(c))) continue;
      const first = cells.map(text).find(Boolean) ?? '';
      if (isTotalsLabel(first)) continue;
      const cell = (f: string) => (has(f) ? cells[col(f)!] ?? '' : '');
      const issues: Issue[] = [];
      const err = (code: string, message: string) => issues.push({ code, level: 'error', message });
      const warn = (code: string, message: string) => issues.push({ code, level: 'warning', message });

      let date: Date | null = null;
      if (has('date')) {
        const d = parseDate(cell('date'));
        if (d === null) err('missing_date', 'التاريخ فارغ');
        else if (d === INVALID) err('invalid_date', `التاريخ غير مفهوم: «${text(cell('date')).slice(0, 30)}»`);
        else date = d;
      }

      const line: Line = {
        row: r + 1, date, group: '', title: text(cell('title')).slice(0, 500), author: text(cell('author')) || null,
        quantity: 1, unitPrice: null, salePrice: null, customer: text(cell('customer')).slice(0, 120) || null,
        phone: text(cell('phone')).slice(0, 30) || null, wilaya: text(cell('wilaya')).slice(0, 60) || null,
        supplier: text(cell('supplier')).slice(0, 160) || null, reference: text(cell('reference')).slice(0, 80) || null,
        payment: null, notes: text(cell('notes')).slice(0, 1000) || null, amount: null, category: null, description: null,
      };
      const pay = parsePayment(cell('payment'));
      line.payment = pay === INVALID ? null : pay;

      if (o.kind === 'expenses') {
        const amount = parsePrice(cell('amount'));
        if (amount === null || amount === 0) err('missing_amount', 'المبلغ فارغ');
        else if (amount === INVALID) err('invalid_amount', `المبلغ غير مفهوم: «${text(cell('amount')).slice(0, 30)}»`);
        else line.amount = amount;
        const rawCat = text(cell('category'));
        line.category = parseExpenseCategory(rawCat || text(cell('description')));
        const desc = text(cell('description'));
        line.description = [line.category === 'other' && rawCat ? rawCat : '', desc].filter(Boolean).join(' — ').slice(0, 500) || null;
        line.title = line.description || EXPENSE_LABELS[line.category as keyof typeof EXPENSE_LABELS];
      } else {
        if (!line.title) err('missing_title', 'اسم الكتاب فارغ');
        if (has('quantity')) {
          const q = parseQuantity(cell('quantity'));
          if (q === INVALID || q === 0) err('invalid_quantity', `الكمية غير مفهومة: «${text(cell('quantity')).slice(0, 20)}»`);
          else if (q !== null) line.quantity = q;
        }
        const priceField = o.kind === 'sales' ? 'unitPrice' : 'unitCost';
        const unit = parsePrice(cell(priceField));
        const total = parsePrice(cell('total'));
        if (unit === INVALID) warn('invalid_price', `السعر غير مفهوم: «${text(cell(priceField)).slice(0, 30)}»`);
        else if (unit !== null) line.unitPrice = unit;
        if (line.unitPrice === null && total !== null && total !== INVALID && line.quantity > 0) {
          line.unitPrice = cents(total / line.quantity);
        }
        if (o.kind === 'purchases') {
          const sp = parsePrice(cell('salePrice'));
          if (sp !== null && sp !== INVALID) line.salePrice = sp;
          if (line.unitPrice === null) warn('missing_cost', 'بدون سعر شراء (يُسجَّل بـ 0)');
        } else if (line.unitPrice === null) {
          warn('missing_price', 'بدون سعر: يُستعمل سعر الكتاب في المتجر');
        }
      }

      const day = (line.date ?? new Date()).toISOString().slice(0, 10);
      line.group =
        o.kind === 'expenses'
          ? `row:${line.row}`
          : line.reference
            ? `ref:${o.kind === 'purchases' ? normalizeArabic(line.supplier ?? '') : ''}|${line.reference}`
            : o.kind === 'purchases'
              ? `sup:${normalizeArabic(line.supplier ?? '')}|${day}`
              : line.customer || line.phone
                ? `cus:${day}|${normalizeArabic(line.customer ?? '')}|${line.phone ?? ''}`
                : `row:${line.row}`;

      rows.push({
        row: line.row,
        title: line.title,
        action: issues.some((i) => i.level === 'error') ? 'error' : 'create',
        issues,
        changes: [],
        cells: cells.map(text),
        line,
      });
    }

    const ok = rows.filter((r) => r.action === 'create').map((r) => r.line!);
    const groups = new Set(ok.map((l) => l.group)).size;
    const amount = cents(ok.reduce((s, l) => s + (o.kind === 'expenses' ? l.amount ?? 0 : (l.unitPrice ?? 0) * l.quantity), 0));

    let newBooks = 0;
    let newSuppliers = 0;
    if (o.kind !== 'expenses') {
      const titles = [...new Set(ok.map((l) => normalizeArabic(l.title)))];
      const found = titles.length
        ? await this.prisma.book.findMany({ where: { storeId, titleNormalized: { in: titles } }, select: { titleNormalized: true } })
        : [];
      const have = new Set(found.map((b) => b.titleNormalized));
      newBooks = titles.filter((t) => !have.has(t)).length;
    }
    if (o.kind === 'purchases') {
      const names = [...new Set(ok.map((l) => l.supplier).filter((x): x is string => !!x))];
      const found = names.length ? await this.prisma.supplier.findMany({ where: { storeId, name: { in: names } }, select: { name: true } }) : [];
      newSuppliers = names.length - found.length;
    }
    return { rows, groups, amount, newBooks, newSuppliers, notices };
  }

  /** Write the planned lines. Returns how many lines and records were created. */
  async commit(storeId: string, jobId: string, planned: HistoryRow[], o: HistoryOptions) {
    const lines = planned.filter((r) => r.action === 'create').map((r) => r.line!);
    if (!lines.length) throw new BadRequestException('لا يوجد ما يُستورد: كل الأسطر بها أخطاء.');

    if (o.kind === 'expenses') {
      for (let i = 0; i < lines.length; i += 1000) {
        await this.prisma.expense.createMany({
          data: lines.slice(i, i + 1000).map((l) => ({
            storeId,
            importJobId: jobId,
            date: l.date ?? new Date(),
            category: l.category!,
            amount: l.amount!,
            description: l.description,
            paymentMethod: l.payment,
          })),
        });
      }
      return { lines: lines.length, records: lines.length };
    }

    const groups = new Map<string, Line[]>();
    for (const l of lines) groups.set(l.group, [...(groups.get(l.group) ?? []), l]);
    // Oldest first, so the latest purchase price is the one that sticks.
    const ordered = [...groups.values()].sort((a, b) => (a[0].date?.getTime() ?? 0) - (b[0].date?.getTime() ?? 0));

    if (o.kind === 'purchases') {
      for (const g of ordered) {
        await this.money.createPurchase(
          {
            supplierName: g[0].supplier,
            reference: g[0].reference,
            date: (g[0].date ?? new Date()).toISOString(),
            notes: g.map((l) => l.notes).filter(Boolean).join(' • ') || null,
            items: g.map((l) => ({ title: l.title, quantity: l.quantity, unitCost: l.unitPrice ?? 0, ...(l.salePrice !== null ? { salePrice: l.salePrice } : {}) })),
            paidAmount: Number.MAX_SAFE_INTEGER, // history: treated as paid (clamped to the total)
            addToStock: o.addToStock === true,
            updateCostPrice: o.updateCostPrice !== false,
          },
          { importJobId: jobId },
        );
      }
      return { lines: lines.length, records: ordered.length };
    }

    // Sales: one order per group, books matched or created.
    const { ids } = await findOrCreateBooks(
      this.prisma,
      storeId,
      lines.map((l) => ({ title: l.title, author: l.author })),
      { importJobId: jobId },
    );
    const bookIds = [...new Set(lines.map((l) => ids.get(titleKey({ title: l.title, author: l.author }))!))];
    const books = new Map(
      (await this.prisma.book.findMany({ where: { id: { in: bookIds } }, select: { id: true, title: true, price: true, costPrice: true } })).map((b) => [b.id, b]),
    );

    for (let i = 0; i < ordered.length; i += 50) {
      await this.prisma.$transaction(
        async (tx) => {
          for (const g of ordered.slice(i, i + 50)) {
            const items = g.map((l) => {
              const book = books.get(ids.get(titleKey({ title: l.title, author: l.author }))!)!;
              return {
                bookId: book.id,
                bookTitle: book.title,
                quantity: l.quantity,
                unitPrice: l.unitPrice ?? Number(book.price ?? 0),
                unitCost: book.costPrice === null ? null : Number(book.costPrice),
              };
            });
            const t = computeOrderTotals(items, 0);
            const head = g[0];
            const order = await tx.order.create({
              data: {
                storeId,
                importJobId: jobId,
                channel: 'import',
                status: 'delivered',
                soldAt: head.date ?? new Date(),
                paymentMethod: head.payment,
                firstName: head.customer ?? 'زبون',
                lastName: '',
                phone: head.phone ?? '',
                wilaya: head.wilaya ?? '',
                address: '',
                notes: [head.reference ? `مرجع: ${head.reference}` : '', ...g.map((l) => l.notes ?? '')].filter(Boolean).join(' • ') || null,
                subtotal: t.subtotal,
                discount: 0,
                shippingCost: 0,
                total: t.total,
                stockApplied: o.applyStock === true,
                items: { create: items },
              },
            });
            if (o.applyStock) {
              await moveStock(tx, storeId, items.map((it) => ({ bookId: it.bookId, delta: -it.quantity })), 'import', order.id);
            }
          }
        },
        { timeout: 60_000 },
      );
    }
    return { lines: lines.length, records: ordered.length };
  }

  /** Remove everything a history import created, putting stock back. */
  async undo(storeId: string, jobId: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const orders = await tx.order.findMany({ where: { storeId, importJobId: jobId }, include: { items: true } });
        for (const ord of orders.filter((x) => x.stockApplied)) {
          await moveStock(tx, storeId, ord.items.map((i) => ({ bookId: i.bookId, delta: i.quantity })), 'sale_cancel', ord.id, 'تراجع عن استيراد');
        }
        const delOrders = await tx.order.deleteMany({ where: { storeId, importJobId: jobId } });

        const purchases = await tx.purchase.findMany({ where: { storeId, importJobId: jobId }, include: { items: true } });
        for (const p of purchases.filter((x) => x.stockApplied && !x.cancelled)) {
          await moveStock(tx, storeId, p.items.filter((i) => i.bookId).map((i) => ({ bookId: i.bookId!, delta: -i.quantity })), 'purchase_cancel', p.id, 'تراجع عن استيراد');
        }
        const delPurchases = await tx.purchase.deleteMany({ where: { storeId, importJobId: jobId } });
        // Suppliers the import introduced (created during it) that nothing else uses now.
        const job = await tx.importJob.findUnique({ where: { id: jobId }, select: { createdAt: true } });
        if (job && purchases.length) {
          await tx.supplier.deleteMany({
            where: {
              storeId,
              id: { in: [...new Set(purchases.map((p) => p.supplierId).filter((x): x is string => !!x))] },
              createdAt: { gte: job.createdAt },
              purchases: { none: {} },
            },
          });
        }
        const delExpenses = await tx.expense.deleteMany({ where: { storeId, importJobId: jobId } });
        // Books the import created, unless something else now uses them.
        const delBooks = await tx.book.deleteMany({
          where: { storeId, importJobId: jobId, orderItems: { none: {} }, purchaseItems: { none: {} } },
        });
        return { orders: delOrders.count, purchases: delPurchases.count, expenses: delExpenses.count, books: delBooks.count };
      },
      { timeout: 60_000 },
    );
  }
}

export type { Prisma };
