import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaymentMethod, Prisma, SaleChannel } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { StoreResolver } from '../../../common/tenant/store-resolver.service';
import { moveStock, takesStock } from '../../../common/stock/stock';
import {
  ConvertRequestDto,
  CounterSaleDto,
  OrderItemInputDto,
  UpsertOrderDto,
} from './dto/order.dto';
import { OrderStatus, canTransition, computeOrderTotals } from './order-rules';
import { thumbUrlFor } from '../../../common/utils/cover-image';

const orderInclude = {
  items: { include: { book: { select: { id: true, title: true, imageUrl: true } } } },
  request: { select: { id: true } },
};

type Tx = Prisma.TransactionClient;

interface ResolvedItem {
  bookId: string;
  bookTitle: string;
  unitPrice: number;
  unitCost: number | null;
  quantity: number;
}

/**
 * The sales register: storefront/phone orders, counter sales and imported
 * sales are all orders, told apart by `channel`.
 *
 * Stock follows the order: books leave stock when an order is confirmed (or
 * sold at the counter) and come back if it is cancelled. Every move happens in
 * the same transaction as the status change, so stock and orders can never
 * disagree.
 */
@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storeResolver: StoreResolver,
  ) {}

  async list(opts: {
    status?: string;
    channel?: SaleChannel;
    search?: string;
    from?: Date;
    to?: Date;
    page: number;
    pageSize: number;
  }) {
    const storeId = await this.storeResolver.getStoreId();
    const { status, channel, search, from, to, page, pageSize } = opts;

    const where: Prisma.OrderWhereInput = {
      storeId,
      ...(status ? { status: status as OrderStatus } : {}),
      ...(channel ? { channel } : {}),
      ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
      ...(search?.trim()
        ? {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search } },
              { invoiceNumber: { contains: search } },
              { items: { some: { bookTitle: { contains: search, mode: 'insensitive' } } } },
            ],
          }
        : {}),
    };

    const [orders, total, counts, revenueAgg, channels] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: orderInclude,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.order.count({ where }),
      this.prisma.order.groupBy({
        by: ['status'],
        where: { storeId, ...(channel ? { channel } : {}) },
        _count: true,
      }),
      this.prisma.order.aggregate({
        where: {
          storeId,
          ...(channel ? { channel } : {}),
          status: { in: ['confirmed', 'shipped', 'delivered'] },
        },
        _sum: { total: true },
      }),
      this.prisma.order.groupBy({ by: ['channel'], where: { storeId }, _count: true }),
    ]);

    return {
      orders,
      total,
      page,
      pageSize,
      counts,
      channels,
      totalRevenue: Number(revenueAgg._sum.total ?? 0),
    };
  }

  async get(id: string) {
    const storeId = await this.storeResolver.getStoreId();
    const order = await this.prisma.order.findFirst({
      where: { id, storeId },
      include: orderInclude,
    });
    if (!order) throw new NotFoundException('Order not found');
    return {
      ...order,
      items: order.items.map((it) => ({
        ...it,
        book: it.book && { ...it.book, thumbUrl: thumbUrlFor(it.book.imageUrl) },
      })),
    };
  }

  async create(dto: UpsertOrderDto) {
    const storeId = await this.storeResolver.getStoreId();
    const items = await this.resolveItems(storeId, dto.items);
    const totals = computeOrderTotals(items, dto.shippingCost ?? 0, dto.discount ?? 0);
    const status = dto.status ?? 'pending';

    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          storeId,
          channel: dto.channel ?? 'online',
          paymentMethod: dto.paymentMethod ?? null,
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone,
          wilaya: dto.wilaya,
          address: dto.address,
          status,
          ...money(totals),
          notes: dto.notes ?? null,
          items: { create: items.map(itemRow) },
        },
      });
      if (takesStock(status)) await this.applyStock(tx, storeId, order.id, items, -1);
      return tx.order.findUnique({ where: { id: order.id }, include: orderInclude });
    });
  }

  /**
   * A sale at the counter: paid and handed over on the spot, so it is
   * recorded as delivered and the books leave stock immediately.
   */
  async counterSale(dto: CounterSaleDto) {
    const storeId = await this.storeResolver.getStoreId();
    const items = await this.resolveItems(storeId, dto.items);
    const totals = computeOrderTotals(items, 0, dto.discount ?? 0);

    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          storeId,
          channel: 'shop',
          paymentMethod: dto.paymentMethod ?? 'cash',
          firstName: dto.customerName?.trim() || 'زبون المحل',
          lastName: '',
          phone: dto.phone?.trim() ?? '',
          wilaya: '',
          address: '',
          status: 'delivered',
          soldAt: new Date(),
          ...money(totals),
          notes: dto.notes ?? null,
          items: { create: items.map(itemRow) },
        },
      });
      await this.applyStock(tx, storeId, order.id, items, -1);
      return tx.order.findUnique({ where: { id: order.id }, include: orderInclude });
    });
  }

  async update(id: string, dto: UpsertOrderDto) {
    const storeId = await this.storeResolver.getStoreId();
    const existing = await this.prisma.order.findFirst({
      where: { id, storeId },
      include: { items: true },
    });
    if (!existing) throw new NotFoundException('Order not found');

    if (existing.status === 'delivered' || existing.status === 'cancelled') {
      throw new BadRequestException(
        `Cannot edit a ${existing.status} order`,
      );
    }
    // An edit may move the status too, but only along the same state machine
    // as the dedicated status endpoint — never pending → delivered in one go.
    if (dto.status && !canTransition(existing.status as OrderStatus, dto.status)) {
      throw new BadRequestException(
        `Cannot transition order from ${existing.status} to ${dto.status}`,
      );
    }

    const items = await this.resolveItems(storeId, dto.items);
    // A form that doesn't send the discount keeps the one already on the order.
    const totals = computeOrderTotals(items, dto.shippingCost ?? 0, dto.discount ?? Number(existing.discount));
    const nextStatus = dto.status ?? existing.status;

    return this.prisma.$transaction(async (tx) => {
      // Put the old lines back on the shelf before replacing them.
      if (existing.stockApplied) {
        await moveStock(tx, storeId, existing.items.map((i) => ({ bookId: i.bookId, delta: i.quantity })), 'sale_cancel', id, 'تعديل الطلب');
      }
      await tx.orderItem.deleteMany({ where: { orderId: id } });

      await tx.order.update({
        where: { id },
        data: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone,
          wilaya: dto.wilaya,
          address: dto.address,
          status: nextStatus,
          ...(dto.paymentMethod ? { paymentMethod: dto.paymentMethod } : {}),
          ...money(totals),
          notes: dto.notes ?? null,
          stockApplied: false,
          items: { create: items.map(itemRow) },
        },
      });
      if (takesStock(nextStatus)) await this.applyStock(tx, storeId, id, items, -1);

      return tx.order.findUnique({ where: { id }, include: orderInclude });
    });
  }

  async updateStatus(id: string, target: OrderStatus) {
    const storeId = await this.storeResolver.getStoreId();
    const order = await this.prisma.order.findFirst({
      where: { id, storeId },
      include: { items: true },
    });
    if (!order) throw new NotFoundException('Order not found');

    if (!canTransition(order.status as OrderStatus, target)) {
      throw new BadRequestException(
        `Cannot transition order from ${order.status} to ${target}`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // Conditional update: two clicks at once cannot move stock twice.
      const moved = await tx.order.updateMany({
        where: { id, status: order.status },
        data: { status: target },
      });
      if (moved.count === 0) throw new BadRequestException('تغيّرت حالة الطلب للتو. أعد تحميل الصفحة.');

      const lines = order.items.map((i) => ({ bookId: i.bookId, quantity: i.quantity }));
      if (takesStock(target) && !order.stockApplied) {
        await this.applyStock(tx, storeId, id, lines, -1);
      } else if (target === 'cancelled' && order.stockApplied) {
        await moveStock(tx, storeId, lines.map((l) => ({ bookId: l.bookId, delta: l.quantity })), 'sale_cancel', id);
        await tx.order.update({ where: { id }, data: { stockApplied: false } });
      }
      return tx.order.findUnique({ where: { id }, include: orderInclude });
    });
  }

  async remove(id: string) {
    const storeId = await this.storeResolver.getStoreId();
    const order = await this.prisma.order.findFirst({
      where: { id, storeId },
    });
    if (!order) throw new NotFoundException('Order not found');

    // Only allow hard-delete for cancelled orders — keeps history clean
    if (order.status !== 'cancelled') {
      throw new BadRequestException(
        'Only cancelled orders can be deleted. Cancel it first.',
      );
    }

    await this.prisma.order.delete({ where: { id } });
    return { ok: true };
  }

  async convertFromRequest(requestId: string, dto: ConvertRequestDto) {
    const storeId = await this.storeResolver.getStoreId();
    const request = await this.prisma.request.findFirst({
      where: { id: requestId, storeId },
    });
    if (!request) throw new NotFoundException('Request not found');

    if (request.convertedOrderId) {
      throw new BadRequestException(
        'This request has already been converted to an order',
      );
    }

    const items = await this.resolveItems(storeId, dto.items);
    const totals = computeOrderTotals(items, dto.shippingCost ?? 0);

    return this.prisma.$transaction(async (tx) => {
      // Claim the request first: two clicks on "convert" must not produce two
      // orders. The conditional update only succeeds for the first one.
      const claimed = await tx.request.updateMany({
        where: { id: requestId, storeId, convertedOrderId: null },
        data: { status: 'done' },
      });
      if (claimed.count === 0) {
        throw new BadRequestException(
          'This request has already been converted to an order',
        );
      }

      const order = await tx.order.create({
        data: {
          storeId,
          channel: 'online',
          firstName: request.firstName,
          lastName: request.lastName,
          phone: request.phone,
          wilaya: request.wilaya,
          address: request.address,
          status: 'confirmed',
          ...money(totals),
          notes: dto.notes ?? null,
          items: { create: items.map(itemRow) },
        },
      });
      await this.applyStock(tx, storeId, order.id, items, -1);

      await tx.request.update({
        where: { id: requestId },
        data: { convertedOrderId: order.id },
      });

      return tx.order.findUnique({ where: { id: order.id }, include: orderInclude });
    });
  }

  // ── Invoices ────────────────────────────────────────────

  /**
   * Everything needed to print the invoice of a sale. The number is given the
   * first time ("2026-0001", sequential per store and year) and never changes.
   */
  async invoice(id: string) {
    const store = await this.storeResolver.getStore();
    let order = await this.prisma.order.findFirst({ where: { id, storeId: store.id }, include: { items: true } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status === 'cancelled') throw new BadRequestException('لا تُصدر فاتورة لطلب ملغى.');

    if (!order.invoiceNumber) {
      const year = new Date().getFullYear();
      order = await this.prisma.$transaction(async (tx) => {
        const counter = await tx.storeCounter.upsert({
          where: { storeId_key: { storeId: store.id, key: `invoice-${year}` } },
          create: { storeId: store.id, key: `invoice-${year}`, value: 1 },
          update: { value: { increment: 1 } },
        });
        // Only the first caller numbers the invoice; a parallel one keeps it.
        await tx.order.updateMany({
          where: { id, invoiceNumber: null },
          data: { invoiceNumber: `${year}-${String(counter.value).padStart(4, '0')}`, invoicedAt: new Date() },
        });
        return tx.order.findUniqueOrThrow({ where: { id }, include: { items: true } });
      });
    }

    const profile = await this.prisma.store.findUniqueOrThrow({
      where: { id: store.id },
      select: { name: true, phone: true, address: true, email: true, rc: true, nif: true, nis: true, art: true, invoiceFooter: true },
    });
    return { store: profile, order };
  }

  // ── Helpers ─────────────────────────────────────────────

  private async applyStock(
    tx: Tx,
    storeId: string,
    orderId: string,
    items: { bookId: string; quantity: number }[],
    sign: -1,
  ) {
    await moveStock(tx, storeId, items.map((i) => ({ bookId: i.bookId, delta: sign * i.quantity })), 'sale', orderId);
    await tx.order.update({ where: { id: orderId }, data: { stockApplied: true } });
  }

  private async resolveItems(storeId: string, input: OrderItemInputDto[]): Promise<ResolvedItem[]> {
    if (!input.length) throw new BadRequestException('At least one item required');

    const ids = input.map((i) => i.bookId);
    // Scoped to this store: an order can only ever contain its own books.
    const books = await this.prisma.book.findMany({
      where: { id: { in: ids }, storeId },
      select: { id: true, title: true, price: true, costPrice: true },
    });
    const byId = new Map(books.map((b) => [b.id, b]));

    return input.map((it) => {
      const book = byId.get(it.bookId);
      if (!book) {
        throw new BadRequestException(`Book ${it.bookId} not found`);
      }
      const unitPrice =
        it.unitPrice !== undefined ? it.unitPrice : Number(book.price ?? 0);
      if (unitPrice < 0) {
        throw new BadRequestException('unitPrice must be >= 0');
      }
      return {
        bookId: book.id,
        bookTitle: book.title,
        unitPrice,
        // Frozen now, so this sale's profit stays right if prices change later.
        unitCost: book.costPrice === null ? null : Number(book.costPrice),
        quantity: it.quantity,
      };
    });
  }
}

function itemRow(it: ResolvedItem) {
  return {
    bookId: it.bookId,
    bookTitle: it.bookTitle,
    unitPrice: it.unitPrice,
    unitCost: it.unitCost,
    quantity: it.quantity,
  };
}

function money(t: ReturnType<typeof computeOrderTotals>) {
  return { subtotal: t.subtotal, discount: t.discount, shippingCost: t.shippingCost, total: t.total };
}

export type { PaymentMethod };
