import { createHash } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { StoreResolver } from '../../../common/tenant/store-resolver.service';
import { CustomerTokens } from '../../../common/auth/customer-tokens';
import { dummyHash, hashPassword, verifyPassword } from '../../../common/auth/password';
import { normalizePhone, parseReference } from '../../../common/orders/order-public';
import { publicOrderSelect, toPublicOrder } from '../shop-orders.service';
import type { ChangePasswordDto, LoginDto, RegisterDto, ResetPasswordDto, UpdateProfileDto } from './account.dto';

/** What the customer may read of their own account — never the hash. */
const profileSelect = {
  id: true,
  firstName: true,
  lastName: true,
  phone: true,
  email: true,
  wilaya: true,
  address: true,
  createdAt: true,
} satisfies Prisma.CustomerSelect;

export const hashResetToken = (token: string) => createHash('sha256').update(token).digest('hex');

const BAD_LOGIN = 'رقم الهاتف أو كلمة المرور غير صحيحة';

/**
 * Optional storefront accounts. An account only saves the delivery details
 * and lists the orders placed while logged in — guests keep ordering and
 * tracking exactly as before.
 */
@Injectable()
export class AccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stores: StoreResolver,
    private readonly tokens: CustomerTokens,
  ) {}

  async register(storeSlug: string, dto: RegisterDto) {
    const store = await this.stores.bySlug(storeSlug);
    const phone = normalizePhone(dto.phone)!;
    try {
      const customer = await this.prisma.customer.create({
        data: {
          storeId: store.id,
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone,
          email: dto.email?.toLowerCase() ?? null,
          wilaya: dto.wilaya ?? null,
          address: dto.address ?? null,
          passwordHash: await hashPassword(dto.password),
          lastLoginAt: new Date(),
        },
        select: { ...profileSelect, storeId: true, tokenVersion: true },
      });
      return this.session(customer);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const onEmail = String(err.meta?.target ?? '').includes('email');
        throw new ConflictException(
          onEmail
            ? 'هذا البريد الإلكتروني مستعمل في حساب آخر.'
            : 'يوجد حساب بهذا الرقم. سجّل الدخول، أو راسلنا على واتساب إن نسيت كلمة المرور.',
        );
      }
      throw err;
    }
  }

  async login(storeSlug: string, dto: LoginDto) {
    const store = await this.stores.bySlug(storeSlug);
    const phone = normalizePhone(dto.phone);
    const customer = phone
      ? await this.prisma.customer.findUnique({
          where: { storeId_phone: { storeId: store.id, phone } },
          select: { ...profileSelect, storeId: true, tokenVersion: true, passwordHash: true },
        })
      : null;
    // Same work whether or not the number has an account.
    const ok = await verifyPassword(dto.password, customer?.passwordHash ?? (await dummyHash()));
    if (!customer || !ok) throw new UnauthorizedException(BAD_LOGIN);

    await this.prisma.customer.update({ where: { id: customer.id }, data: { lastLoginAt: new Date() } });
    const { passwordHash: _hash, ...rest } = customer;
    return this.session(rest);
  }

  async me(customerId: string) {
    const c = await this.prisma.customer.findUnique({ where: { id: customerId }, select: profileSelect });
    if (!c) throw new NotFoundException();
    return c;
  }

  async update(customerId: string, dto: UpdateProfileDto) {
    try {
      return await this.prisma.customer.update({
        where: { id: customerId },
        data: {
          ...(dto.firstName !== undefined ? { firstName: dto.firstName } : {}),
          ...(dto.lastName !== undefined ? { lastName: dto.lastName } : {}),
          ...(dto.email !== undefined ? { email: dto.email?.toLowerCase() ?? null } : {}),
          ...(dto.wilaya !== undefined ? { wilaya: dto.wilaya } : {}),
          ...(dto.address !== undefined ? { address: dto.address } : {}),
        },
        select: profileSelect,
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('هذا البريد الإلكتروني مستعمل في حساب آخر.');
      }
      throw err;
    }
  }

  /** New password; every other device is logged out. */
  async changePassword(customerId: string, dto: ChangePasswordDto) {
    const c = await this.prisma.customer.findUniqueOrThrow({ where: { id: customerId }, select: { passwordHash: true } });
    if (!(await verifyPassword(dto.current, c.passwordHash))) {
      throw new BadRequestException('كلمة المرور الحالية غير صحيحة');
    }
    const updated = await this.prisma.customer.update({
      where: { id: customerId },
      data: { passwordHash: await hashPassword(dto.next), tokenVersion: { increment: 1 } },
      select: { ...profileSelect, storeId: true, tokenVersion: true },
    });
    return this.session(updated);
  }

  /** The link the shop sent on WhatsApp: one use, 48 hours. */
  async resetPassword(storeSlug: string, dto: ResetPasswordDto) {
    const store = await this.stores.bySlug(storeSlug);
    const row = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashResetToken(dto.token) },
      select: { id: true, usedAt: true, expiresAt: true, customer: { select: { id: true, storeId: true } } },
    });
    if (!row || row.usedAt || row.expiresAt < new Date() || row.customer.storeId !== store.id) {
      throw new BadRequestException('رابط إعادة التعيين غير صالح أو منتهٍ. اطلب رابطًا جديدًا من المكتبة.');
    }

    const passwordHash = await hashPassword(dto.password);
    const customer = await this.prisma.$transaction(async (tx) => {
      // Claim the token first: a double submit cannot use it twice.
      const claimed = await tx.passwordResetToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } });
      if (claimed.count === 0) throw new BadRequestException('استُعمل هذا الرابط من قبل.');
      return tx.customer.update({
        where: { id: row.customer.id },
        data: { passwordHash, tokenVersion: { increment: 1 }, lastLoginAt: new Date() },
        select: { ...profileSelect, storeId: true, tokenVersion: true },
      });
    });
    return this.session(customer);
  }

  async orders(customerId: string) {
    const rows = await this.prisma.order.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: publicOrderSelect,
    });
    return { orders: rows.map(toPublicOrder) };
  }

  async order(customerId: string, ref: string) {
    const reference = parseReference(ref);
    const row = reference
      ? await this.prisma.order.findFirst({ where: { customerId, reference }, select: publicOrderSelect })
      : null;
    if (!row) throw new NotFoundException('لم نجد هذا الطلب في حسابك.');
    return toPublicOrder(row);
  }

  private async session(c: { id: string; storeId: string; tokenVersion: number } & Prisma.CustomerGetPayload<{ select: typeof profileSelect }>) {
    const { storeId: _s, tokenVersion: _v, ...customer } = c;
    return { token: await this.tokens.sign(c), customer };
  }
}
