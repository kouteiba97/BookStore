import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { StoreResolver } from '../store-resolver.service';
import {
  ConvertRequestDto,
  OrderItemInputDto,
  UpsertOrderDto,
} from './dto/order.dto';
import { OrderStatus, canTransition, computeOrderTotals } from './order-rules';

const orderInclude = {
  items: { include: { book: { select: { id: true, title: true, imageUrl: true } } } },
  request: { select: { id: true } },
};

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storeResolver: StoreResolver,
  ) {}

  async list(opts: {
    status?: string;
    search?: string;
    page: number;
    pageSize: number;
  }) {
    const storeId = await this.storeResolver.getStoreId();
    const { status, search, page, pageSize } = opts;

    const where: Prisma.OrderWhereInput = {
      storeId,
      ...(status ? { status: status as OrderStatus } : {}),
      ...(search?.trim()
        ? {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search } },
            ],
          }
        : {}),
    };

    const [orders, total, counts, revenueAgg] = await Promise.all([
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
    ]);

    return {
      orders,
      total,
      page,
      pageSize,
      counts,
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
    return order;
  }

  async create(dto: UpsertOrderDto) {
    const storeId = await this.storeResolver.getStoreId();
    const items = await this.resolveItems(dto.items);
    const totals = computeOrderTotals(items, dto.shippingCost ?? 0);

    return this.prisma.order.create({
      data: {
        storeId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        wilaya: dto.wilaya,
        address: dto.address,
        status: dto.status ?? 'pending',
        subtotal: totals.subtotal,
        shippingCost: totals.shippingCost,
        total: totals.total,
        notes: dto.notes ?? null,
        items: {
          create: items.map((it) => ({
            bookId: it.bookId,
            bookTitle: it.bookTitle,
            unitPrice: it.unitPrice,
            quantity: it.quantity,
          })),
        },
      },
      include: orderInclude,
    });
  }

  async update(id: string, dto: UpsertOrderDto) {
    const storeId = await this.storeResolver.getStoreId();
    const existing = await this.prisma.order.findFirst({
      where: { id, storeId },
    });
    if (!existing) throw new NotFoundException('Order not found');

    if (existing.status === 'delivered' || existing.status === 'cancelled') {
      throw new BadRequestException(
        `Cannot edit a ${existing.status} order`,
      );
    }

    const items = await this.resolveItems(dto.items);
    const totals = computeOrderTotals(items, dto.shippingCost ?? 0);

    return this.prisma.$transaction(async (tx) => {
      // Replace items wholesale — simplest correct strategy for edits
      await tx.orderItem.deleteMany({ where: { orderId: id } });

      await tx.order.update({
        where: { id },
        data: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone,
          wilaya: dto.wilaya,
          address: dto.address,
          ...(dto.status ? { status: dto.status } : {}),
          subtotal: totals.subtotal,
          shippingCost: totals.shippingCost,
          total: totals.total,
          notes: dto.notes ?? null,
          items: {
            create: items.map((it) => ({
              bookId: it.bookId,
              bookTitle: it.bookTitle,
              unitPrice: it.unitPrice,
              quantity: it.quantity,
            })),
          },
        },
      });

      return tx.order.findUnique({ where: { id }, include: orderInclude });
    });
  }

  async updateStatus(id: string, target: OrderStatus) {
    const storeId = await this.storeResolver.getStoreId();
    const order = await this.prisma.order.findFirst({
      where: { id, storeId },
    });
    if (!order) throw new NotFoundException('Order not found');

    if (!canTransition(order.status as OrderStatus, target)) {
      throw new BadRequestException(
        `Cannot transition order from ${order.status} to ${target}`,
      );
    }

    return this.prisma.order.update({
      where: { id },
      data: { status: target },
      include: orderInclude,
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

    const items = await this.resolveItems(dto.items);
    const totals = computeOrderTotals(items, dto.shippingCost ?? 0);

    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          storeId,
          firstName: request.firstName,
          lastName: request.lastName,
          phone: request.phone,
          wilaya: request.wilaya,
          address: request.address,
          status: 'confirmed',
          subtotal: totals.subtotal,
          shippingCost: totals.shippingCost,
          total: totals.total,
          notes: dto.notes ?? null,
          items: {
            create: items.map((it) => ({
              bookId: it.bookId,
              bookTitle: it.bookTitle,
              unitPrice: it.unitPrice,
              quantity: it.quantity,
            })),
          },
        },
        include: orderInclude,
      });

      await tx.request.update({
        where: { id: requestId },
        data: { status: 'done', convertedOrderId: order.id },
      });

      return order;
    });
  }

  // ── Helpers ─────────────────────────────────────────────

  private async resolveItems(input: OrderItemInputDto[]) {
    if (!input.length) throw new BadRequestException('At least one item required');

    const ids = input.map((i) => i.bookId);
    const books = await this.prisma.book.findMany({
      where: { id: { in: ids } },
      select: { id: true, title: true, price: true },
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
        quantity: it.quantity,
      };
    });
  }
}
