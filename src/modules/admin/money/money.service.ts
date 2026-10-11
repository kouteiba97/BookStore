import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { StoreResolver } from '../../../common/tenant/store-resolver.service';
import { moveStock } from '../../../common/stock/stock';
import { findOrCreateBooks, titleKey } from '../../../common/stock/book-lookup';
import { ExpenseDto, PurchaseDto, StoreProfileDto, SupplierDto } from './money.dto';

const cents = (n: number) => Math.round(n * 100) / 100;
const num = (d: Prisma.Decimal | null | undefined) => (d == null ? 0 : Number(d));

const purchaseInclude = {
  supplier: { select: { id: true, name: true } },
  items: { include: { book: { select: { id: true, title: true, imageUrl: true } } } },
} satisfies Prisma.PurchaseInclude;

/**
 * Suppliers, purchases (stock in) and expenses — the money side of the shop,
 * which together with the sales register feeds the reports.
 */
@Injectable()
export class MoneyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stores: StoreResolver,
  ) {}

  // ── Suppliers ───────────────────────────────────────────

  /** Every supplier with what was bought from them and what is still owed. */
  async suppliers() {
    const storeId = await this.stores.getStoreId();
    const [suppliers, sums] = await Promise.all([
      this.prisma.supplier.findMany({ where: { storeId }, orderBy: { name: 'asc' } }),
      this.prisma.purchase.groupBy({
        by: ['supplierId'],
        where: { storeId, cancelled: false },
        _sum: { total: true, paidAmount: true },
        _count: true,
      }),
    ]);
    const by = new Map(sums.map((s) => [s.supplierId, s]));
    return suppliers.map((s) => {
      const t = by.get(s.id);
      const total = num(t?._sum.total);
      const paid = num(t?._sum.paidAmount);
      return { ...s, purchases: t?._count ?? 0, totalPurchased: total, totalPaid: paid, balance: cents(total - paid) };
    });
  }

  async createSupplier(dto: SupplierDto) {
    const storeId = await this.stores.getStoreId();
    try {
      return await this.prisma.supplier.create({ data: { storeId, ...clean(dto), name: dto.name.trim() } });
    } catch (e: any) {
      if (e?.code === 'P2002') throw new BadRequestException('يوجد مورد بهذا الاسم.');
      throw e;
    }
  }

  async updateSupplier(id: string, dto: SupplierDto) {
    const storeId = await this.stores.getStoreId();
    await this.own('supplier', id, storeId);
    try {
      return await this.prisma.supplier.update({ where: { id }, data: { ...clean(dto), name: dto.name.trim() } });
    } catch (e: any) {
      if (e?.code === 'P2002') throw new BadRequestException('يوجد مورد بهذا الاسم.');
      throw e;
    }
  }

  async deleteSupplier(id: string) {
    const storeId = await this.stores.getStoreId();
    await this.own('supplier', id, storeId);
    // Purchases keep their history; they just lose the supplier link.
    await this.prisma.supplier.delete({ where: { id } });
    return { ok: true };
  }

  // ── Purchases ───────────────────────────────────────────

  async purchases(opts: { supplierId?: string; from?: Date; to?: Date; page: number; pageSize: number }) {
    const storeId = await this.stores.getStoreId();
    const where: Prisma.PurchaseWhereInput = {
      storeId,
      ...(opts.supplierId ? { supplierId: opts.supplierId } : {}),
      ...(opts.from || opts.to ? { date: { ...(opts.from ? { gte: opts.from } : {}), ...(opts.to ? { lte: opts.to } : {}) } } : {}),
    };
    const [rows, total, sums] = await Promise.all([
      this.prisma.purchase.findMany({
        where,
        include: { supplier: { select: { id: true, name: true } }, _count: { select: { items: true } } },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        skip: (opts.page - 1) * opts.pageSize,
        take: opts.pageSize,
      }),
      this.prisma.purchase.count({ where }),
      this.prisma.purchase.aggregate({ where: { ...where, cancelled: false }, _sum: { total: true, paidAmount: true } }),
    ]);
    const t = num(sums._sum.total);
    const p = num(sums._sum.paidAmount);
    return { purchases: rows, total, page: opts.page, pageSize: opts.pageSize, totals: { total: t, paid: p, balance: cents(t - p) } };
  }

  async purchase(id: string) {
    const storeId = await this.stores.getStoreId();
    const p = await this.prisma.purchase.findFirst({ where: { id, storeId }, include: purchaseInclude });
    if (!p) throw new NotFoundException('Purchase not found');
    return p;
  }

  /**
   * Record a delivery from a supplier: the books (existing, or created from a
   * title) go into stock, and each book's purchase price becomes this cost.
   */
  async createPurchase(dto: PurchaseDto, opts: { importJobId?: string } = {}) {
    const storeId = await this.stores.getStoreId();
    if (dto.items.some((i) => !i.bookId && !i.title?.trim())) {
      throw new BadRequestException('كل سطر يحتاج كتابًا أو عنوانًا.');
    }
    const addToStock = dto.addToStock !== false;
    const updateCost = dto.updateCostPrice !== false;

    return this.prisma.$transaction(
      async (tx) => {
        const supplierId = await this.supplierFor(tx, storeId, dto);

        // Books by id must belong to this store; titles are matched or created.
        const givenIds = dto.items.map((i) => i.bookId).filter((x): x is string => !!x);
        const owned = givenIds.length
          ? new Map((await tx.book.findMany({ where: { id: { in: givenIds }, storeId }, select: { id: true, title: true } })).map((b) => [b.id, b.title]))
          : new Map<string, string>();
        const bad = givenIds.find((x) => !owned.has(x));
        if (bad) throw new BadRequestException(`Book ${bad} not found`);

        const byTitle = await findOrCreateBooks(
          tx,
          storeId,
          dto.items.filter((i) => !i.bookId).map((i) => ({ title: i.title! })),
          { importJobId: opts.importJobId },
        );
        const lines = dto.items.map((i) => {
          const bookId = i.bookId ?? byTitle.ids.get(titleKey({ title: i.title! }))!;
          return { ...i, bookId, bookTitle: i.bookId ? owned.get(i.bookId)! : i.title!.trim() };
        });

        const subtotal = cents(lines.reduce((s, l) => s + l.unitCost * l.quantity, 0));
        const shipping = cents(dto.shippingCost ?? 0);
        const total = cents(subtotal + shipping);
        const paid = Math.min(cents(dto.paidAmount ?? 0), total);

        const purchase = await tx.purchase.create({
          data: {
            storeId,
            supplierId,
            reference: dto.reference?.trim() || null,
            date: dto.date ? new Date(dto.date) : new Date(),
            subtotal,
            shippingCost: shipping,
            total,
            paidAmount: paid,
            notes: dto.notes ?? null,
            stockApplied: addToStock,
            importJobId: opts.importJobId ?? null,
            items: {
              create: lines.map((l) => ({ bookId: l.bookId, bookTitle: l.bookTitle, quantity: l.quantity, unitCost: l.unitCost })),
            },
          },
        });

        if (addToStock) {
          await moveStock(tx, storeId, lines.map((l) => ({ bookId: l.bookId, delta: l.quantity })), 'purchase', purchase.id);
        }
        for (const l of lines) {
          const data: Prisma.BookUpdateInput = {};
          if (updateCost) data.costPrice = l.unitCost;
          if (l.salePrice !== undefined) data.price = l.salePrice;
          if (Object.keys(data).length) await tx.book.update({ where: { id: l.bookId }, data });
        }
        return tx.purchase.findUniqueOrThrow({ where: { id: purchase.id }, include: purchaseInclude });
      },
      { timeout: 60_000 },
    );
  }

  async updatePayment(id: string, paidAmount: number) {
    const storeId = await this.stores.getStoreId();
    const p = await this.prisma.purchase.findFirst({ where: { id, storeId } });
    if (!p) throw new NotFoundException('Purchase not found');
    if (paidAmount > num(p.total)) throw new BadRequestException('المبلغ المدفوع أكبر من مجموع الفاتورة.');
    return this.prisma.purchase.update({ where: { id }, data: { paidAmount: cents(paidAmount) } });
  }

  /** Cancel a delivery: its books leave stock again. History is kept. */
  async cancelPurchase(id: string) {
    const storeId = await this.stores.getStoreId();
    const p = await this.prisma.purchase.findFirst({ where: { id, storeId }, include: { items: true } });
    if (!p) throw new NotFoundException('Purchase not found');
    if (p.cancelled) throw new BadRequestException('الشراء ملغى مسبقًا.');
    return this.prisma.$transaction(async (tx) => {
      const claimed = await tx.purchase.updateMany({ where: { id, cancelled: false }, data: { cancelled: true } });
      if (!claimed.count) throw new BadRequestException('الشراء ملغى مسبقًا.');
      if (p.stockApplied) {
        await moveStock(
          tx,
          storeId,
          p.items.filter((i) => i.bookId).map((i) => ({ bookId: i.bookId!, delta: -i.quantity })),
          'purchase_cancel',
          id,
        );
        await tx.purchase.update({ where: { id }, data: { stockApplied: false } });
      }
      return tx.purchase.findUniqueOrThrow({ where: { id }, include: purchaseInclude });
    });
  }

  async deletePurchase(id: string) {
    const storeId = await this.stores.getStoreId();
    const p = await this.prisma.purchase.findFirst({ where: { id, storeId } });
    if (!p) throw new NotFoundException('Purchase not found');
    if (!p.cancelled && p.stockApplied) throw new BadRequestException('ألغِ الشراء أولًا (حتى تخرج كتبه من المخزون).');
    await this.prisma.purchase.delete({ where: { id } });
    return { ok: true };
  }

  // ── Expenses ────────────────────────────────────────────

  async expenses(opts: { category?: string; from?: Date; to?: Date; page: number; pageSize: number }) {
    const storeId = await this.stores.getStoreId();
    const where: Prisma.ExpenseWhereInput = {
      storeId,
      ...(opts.category ? { category: opts.category } : {}),
      ...(opts.from || opts.to ? { date: { ...(opts.from ? { gte: opts.from } : {}), ...(opts.to ? { lte: opts.to } : {}) } } : {}),
    };
    const [rows, total, byCategory] = await Promise.all([
      this.prisma.expense.findMany({ where, orderBy: [{ date: 'desc' }, { createdAt: 'desc' }], skip: (opts.page - 1) * opts.pageSize, take: opts.pageSize }),
      this.prisma.expense.count({ where }),
      this.prisma.expense.groupBy({ by: ['category'], where, _sum: { amount: true } }),
    ]);
    return {
      expenses: rows,
      total,
      page: opts.page,
      pageSize: opts.pageSize,
      byCategory: byCategory.map((c) => ({ category: c.category, amount: num(c._sum.amount) })),
      sum: cents(byCategory.reduce((s, c) => s + num(c._sum.amount), 0)),
    };
  }

  async createExpense(dto: ExpenseDto, opts: { importJobId?: string } = {}) {
    const storeId = await this.stores.getStoreId();
    return this.prisma.expense.create({
      data: {
        storeId,
        category: dto.category,
        amount: cents(dto.amount),
        date: dto.date ? new Date(dto.date) : new Date(),
        description: dto.description?.trim() || null,
        paymentMethod: dto.paymentMethod ?? null,
        importJobId: opts.importJobId ?? null,
      },
    });
  }

  async updateExpense(id: string, dto: ExpenseDto) {
    const storeId = await this.stores.getStoreId();
    await this.own('expense', id, storeId);
    return this.prisma.expense.update({
      where: { id },
      data: {
        category: dto.category,
        amount: cents(dto.amount),
        ...(dto.date ? { date: new Date(dto.date) } : {}),
        description: dto.description?.trim() || null,
        paymentMethod: dto.paymentMethod ?? null,
      },
    });
  }

  async deleteExpense(id: string) {
    const storeId = await this.stores.getStoreId();
    await this.own('expense', id, storeId);
    await this.prisma.expense.delete({ where: { id } });
    return { ok: true };
  }

  // ── Stock log ───────────────────────────────────────────

  async stockMovements(bookId: string) {
    const storeId = await this.stores.getStoreId();
    const book = await this.prisma.book.findFirst({ where: { id: bookId, storeId }, select: { id: true, title: true, inventory: true } });
    if (!book) throw new NotFoundException('Book not found');
    const movements = await this.prisma.stockMovement.findMany({ where: { bookId, storeId }, orderBy: { createdAt: 'desc' }, take: 200 });
    return { book, movements };
  }

  // ── Store profile (invoice header) ──────────────────────

  async profile() {
    const storeId = await this.stores.getStoreId();
    return this.prisma.store.findUniqueOrThrow({
      where: { id: storeId },
      select: { name: true, slug: true, phone: true, address: true, email: true, rc: true, nif: true, nis: true, art: true, invoiceFooter: true, plan: true },
    });
  }

  async updateProfile(dto: StoreProfileDto) {
    const storeId = await this.stores.getStoreId();
    const data = clean(dto);
    if (data.name !== undefined && !data.name) throw new BadRequestException('اسم المتجر مطلوب.');
    await this.prisma.store.update({ where: { id: storeId }, data });
    return this.profile();
  }

  // ── Helpers ─────────────────────────────────────────────

  private async supplierFor(tx: Prisma.TransactionClient, storeId: string, dto: PurchaseDto): Promise<string | null> {
    if (dto.supplierId) {
      const s = await tx.supplier.findFirst({ where: { id: dto.supplierId, storeId }, select: { id: true } });
      if (!s) throw new BadRequestException('Supplier not found');
      return s.id;
    }
    const name = dto.supplierName?.trim();
    if (!name) return null;
    const s = await tx.supplier.upsert({
      where: { storeId_name: { storeId, name } },
      create: { storeId, name },
      update: {},
      select: { id: true },
    });
    return s.id;
  }

  private async own(model: 'supplier' | 'expense', id: string, storeId: string) {
    const row = await (this.prisma[model] as any).findFirst({ where: { id, storeId }, select: { id: true } });
    if (!row) throw new NotFoundException('Not found');
  }
}

/** Trim strings; empty optional text becomes null. */
function clean<T extends object>(dto: T): any {
  const out: any = {};
  for (const [k, v] of Object.entries(dto)) {
    if (v === undefined) continue;
    out[k] = typeof v === 'string' ? v.trim() || null : v;
  }
  return out;
}
