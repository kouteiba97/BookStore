import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StoreResolver } from '../../common/tenant/store-resolver.service';
import { computeOrderTotals } from '../admin/orders/order-rules';
import { thumbUrlFor } from '../../common/utils/cover-image';
import {
  customerWhatsappMessage,
  normalizePhone,
  parseReference,
  publicStatus,
  samePhone,
  whatsappLink,
} from '../../common/orders/order-public';
import { withReference } from '../../common/orders/with-reference';
import { CreateShopOrderDto, MAX_QTY } from './dto/shop-order.dto';

/** The order fields a customer may see — never cost, notes or invoice data. */
export const publicOrderSelect = {
  id: true,
  reference: true,
  status: true,
  firstName: true,
  wilaya: true,
  subtotal: true,
  discount: true,
  shippingCost: true,
  total: true,
  carrier: true,
  trackingNumber: true,
  createdAt: true,
  updatedAt: true,
  items: {
    select: {
      bookId: true,
      bookTitle: true,
      unitPrice: true,
      quantity: true,
      book: { select: { imageUrl: true } },
    },
  },
} satisfies Prisma.OrderSelect;

type PublicOrderRow = Prisma.OrderGetPayload<{ select: typeof publicOrderSelect }>;

/**
 * Orders placed on the storefront.
 *
 * Checkout creates a real Order straight away — status "pending", channel
 * "online" — so the shop works every web order from one register. Prices come
 * from the database, never from the browser, and are frozen on the lines. No
 * stock moves until the shop confirms the order (see OrdersService).
 */
@Injectable()
export class ShopOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stores: StoreResolver,
  ) {}

  async create(storeSlug: string, dto: CreateShopOrderDto, customerId: string | null = null) {
    const store = await this.stores.bySlug(storeSlug);

    // The same book twice in one basket is one line with both quantities.
    const wanted = new Map<string, number>();
    for (const it of dto.items) {
      wanted.set(it.bookId, Math.min(MAX_QTY, (wanted.get(it.bookId) ?? 0) + it.quantity));
    }

    const books = await this.prisma.book.findMany({
      where: { id: { in: [...wanted.keys()] }, storeId: store.id },
      select: { id: true, title: true, price: true, costPrice: true },
    });
    if (books.length !== wanted.size) {
      throw new BadRequestException('بعض الكتب في طلبك لم تعد متوفرة في المتجر. حدّث السلة وأعد المحاولة.');
    }

    // Keep the customer's order of lines.
    const byId = new Map(books.map((b) => [b.id, b]));
    const lines = [...wanted.entries()].map(([bookId, quantity]) => {
      const b = byId.get(bookId)!;
      return {
        bookId,
        bookTitle: b.title,
        unitPrice: Number(b.price ?? 0),
        // Frozen now so this sale's profit stays right if prices change later.
        unitCost: b.costPrice === null ? null : Number(b.costPrice),
        quantity,
      };
    });
    const totals = computeOrderTotals(lines, 0);
    const phone = normalizePhone(dto.phone)!;

    const order = await withReference((reference) =>
      this.prisma.order.create({
        data: {
          storeId: store.id,
          reference,
          channel: 'online',
          paymentMethod: 'cod',
          status: 'pending',
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone,
          wilaya: dto.wilaya,
          address: dto.address,
          ...totals,
          notes: dto.note ? `ملاحظة الزبون: ${dto.note}` : null,
          // Only an order placed while logged in joins the account.
          customerId,
          items: { create: lines },
        },
        select: publicOrderSelect,
      }),
    );

    const view = toPublicOrder(order);
    const shopNumber = process.env.WHATSAPP_NUMBER?.replace(/\D/g, '');
    return {
      ...view,
      phone,
      whatsappUrl: shopNumber
        ? whatsappLink(
            shopNumber,
            customerWhatsappMessage({
              reference: view.reference,
              firstName: dto.firstName,
              lastName: dto.lastName,
              items: view.items,
            }),
          )
        : null,
    };
  }

  /**
   * An order seen from outside: the number AND the phone it was placed with
   * must both match. Either one wrong gives the same answer, so the page
   * cannot be used to discover which numbers exist.
   */
  async track(storeSlug: string, ref: string | undefined, phone: string | undefined) {
    const reference = parseReference(ref);
    if (!reference || !normalizePhone(phone)) throw notFound();

    const store = await this.stores.bySlug(storeSlug);
    const order = await this.prisma.order.findFirst({
      where: { storeId: store.id, reference },
      select: { ...publicOrderSelect, phone: true },
    });
    if (!order || !samePhone(order.phone, phone)) throw notFound();
    return toPublicOrder(order);
  }

  /**
   * Today's price and availability of the books in a basket. The cart keeps
   * what it saw when a book was added; this lets it catch price changes and
   * books that were removed before the customer checks out.
   */
  async quote(storeSlug: string, bookIds: string[]) {
    const store = await this.stores.bySlug(storeSlug);
    const ids = [...new Set(bookIds)].slice(0, 50);
    if (!ids.length) return { books: [] };
    const books = await this.prisma.book.findMany({
      where: { id: { in: ids }, storeId: store.id },
      select: { id: true, title: true, price: true, imageUrl: true, inventory: { select: { status: true } } },
    });
    return {
      books: books.map((b) => ({
        id: b.id,
        title: b.title,
        price: b.price === null ? null : Number(b.price),
        imageUrl: b.imageUrl,
        thumbUrl: thumbUrlFor(b.imageUrl),
        status: b.inventory?.status ?? null,
      })),
    };
  }
}

function notFound() {
  return new NotFoundException('لم نجد طلبًا بهذا الرقم وهذا الهاتف. تأكّد منهما وأعد المحاولة.');
}

/** The customer's view of an order. */
export function toPublicOrder(o: PublicOrderRow) {
  const items = o.items.map((it) => ({
    bookId: it.bookId,
    title: it.bookTitle,
    quantity: it.quantity,
    unitPrice: Number(it.unitPrice),
    imageUrl: it.book?.imageUrl ?? null,
    thumbUrl: thumbUrlFor(it.book?.imageUrl),
  }));
  return {
    reference: o.reference ?? '',
    status: publicStatus(o.status),
    firstName: o.firstName,
    wilaya: o.wilaya,
    items,
    hasUnpricedItems: items.some((it) => it.unitPrice <= 0),
    subtotal: Number(o.subtotal),
    discount: Number(o.discount),
    shippingCost: Number(o.shippingCost),
    total: Number(o.total),
    carrier: o.carrier,
    trackingNumber: o.trackingNumber,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

export type PublicOrder = ReturnType<typeof toPublicOrder>;
