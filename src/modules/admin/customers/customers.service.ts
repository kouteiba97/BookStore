import { randomBytes } from 'crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { StoreResolver } from '../../../common/tenant/store-resolver.service';
import { hashResetToken } from '../../shop/account/account.service';

/** Orders that count as money in (same rule as reports). */
const SOLD = ['confirmed', 'shipped', 'delivered'] as const;
const RESET_TTL_MS = 48 * 60 * 60 * 1000;

/**
 * «الزبائن»: storefront accounts, with what each one has ordered, and the
 * one-time link that lets a customer who forgot their password set a new one
 * (sent by the shop on WhatsApp — no email service needed).
 */
@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stores: StoreResolver,
  ) {}

  async list(opts: { search?: string; page: number; pageSize: number }) {
    const storeId = await this.stores.getStoreId();
    const q = opts.search?.trim();
    const digits = q?.replace(/\D/g, '');
    const where: Prisma.CustomerWhereInput = {
      storeId,
      ...(q
        ? {
            OR: [
              { firstName: { contains: q, mode: 'insensitive' } },
              { lastName: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
              ...(digits && digits.length >= 3 ? [{ phone: { contains: digits.replace(/^213/, '') } }] : []),
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (opts.page - 1) * opts.pageSize,
        take: opts.pageSize,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          email: true,
          wilaya: true,
          createdAt: true,
          lastLoginAt: true,
        },
      }),
      this.prisma.customer.count({ where }),
    ]);

    const ids = rows.map((r) => r.id);
    const [all, sold] = ids.length
      ? await Promise.all([
          this.prisma.order.groupBy({
            by: ['customerId'],
            where: { customerId: { in: ids }, status: { not: 'cancelled' } },
            _count: true,
            _max: { createdAt: true },
          }),
          this.prisma.order.groupBy({
            by: ['customerId'],
            where: { customerId: { in: ids }, status: { in: [...SOLD] } },
            _sum: { total: true },
          }),
        ])
      : [[], []];
    const counts = new Map(all.map((g) => [g.customerId, g]));
    const spent = new Map(sold.map((g) => [g.customerId, Number(g._sum.total ?? 0)]));

    return {
      customers: rows.map((r) => ({
        ...r,
        ordersCount: counts.get(r.id)?._count ?? 0,
        lastOrderAt: counts.get(r.id)?._max.createdAt ?? null,
        totalSpent: spent.get(r.id) ?? 0,
      })),
      total,
      page: opts.page,
      pageSize: opts.pageSize,
    };
  }

  /**
   * A fresh one-time link (48 h). Any earlier unused link for this customer
   * stops working, so only the last one sent is valid.
   */
  async resetLink(id: string) {
    const storeId = await this.stores.getStoreId();
    const customer = await this.prisma.customer.findFirst({
      where: { id, storeId },
      select: { id: true, firstName: true, phone: true },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    const token = randomBytes(24).toString('base64url');
    const expiresAt = new Date(Date.now() + RESET_TTL_MS);
    await this.prisma.$transaction([
      this.prisma.passwordResetToken.deleteMany({ where: { customerId: id, usedAt: null } }),
      this.prisma.passwordResetToken.create({ data: { customerId: id, tokenHash: hashResetToken(token), expiresAt } }),
    ]);

    const site = (process.env.STOREFRONT_URL ?? 'http://localhost:5173').replace(/\/$/, '');
    return {
      url: `${site}/account/reset?token=${token}`,
      expiresAt,
      customer: { firstName: customer.firstName, phone: customer.phone },
    };
  }

  /** Delete an account on the customer's request. Their orders stay, unlinked. */
  async remove(id: string) {
    const storeId = await this.stores.getStoreId();
    const { count } = await this.prisma.customer.deleteMany({ where: { id, storeId } });
    if (count === 0) throw new NotFoundException('Customer not found');
    return { ok: true };
  }
}
