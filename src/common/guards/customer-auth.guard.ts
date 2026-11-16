import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { StoreResolver } from '../tenant/store-resolver.service';
import { CustomerTokens } from '../auth/customer-tokens';

export interface AuthedCustomer {
  id: string;
  storeId: string;
}

type CustomerRequest = Request & { customer?: AuthedCustomer };

/**
 * Who is calling, from "Authorization: Bearer <customer token>". The token
 * must be a customer token, for the store named in the URL, and not older
 * than the account's last password change.
 */
async function resolveCustomer(
  req: CustomerRequest,
  tokens: CustomerTokens,
  stores: StoreResolver,
  prisma: PrismaService,
): Promise<AuthedCustomer | null> {
  const [scheme, token] = (req.headers.authorization ?? '').split(' ');
  if (scheme !== 'Bearer' || !token) return null;

  const payload = await tokens.verify(token);
  if (!payload) return null;

  const slug = req.params?.storeSlug;
  if (typeof slug !== 'string' || !slug) return null;
  const store = await stores.bySlug(slug).catch(() => null);
  if (!store || store.id !== payload.store) return null;

  const customer = await prisma.customer.findFirst({
    where: { id: payload.sub, storeId: store.id },
    select: { id: true, storeId: true, tokenVersion: true },
  });
  if (!customer || customer.tokenVersion !== payload.v) return null;
  return { id: customer.id, storeId: customer.storeId };
}

/** Routes for logged-in customers only («حسابي», «طلباتي»). */
@Injectable()
export class CustomerAuthGuard implements CanActivate {
  constructor(
    private readonly tokens: CustomerTokens,
    private readonly stores: StoreResolver,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<CustomerRequest>();
    const customer = await resolveCustomer(req, this.tokens, this.stores, this.prisma);
    if (!customer) throw new UnauthorizedException('انتهت الجلسة. سجّل الدخول من جديد.');
    req.customer = customer;
    return true;
  }
}

/**
 * Routes open to everyone that do a little more for a logged-in customer
 * (checkout links the order to the account). A missing, expired or foreign
 * token never blocks the request — the caller is simply a guest.
 */
@Injectable()
export class OptionalCustomerGuard implements CanActivate {
  constructor(
    private readonly tokens: CustomerTokens,
    private readonly stores: StoreResolver,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<CustomerRequest>();
    req.customer = (await resolveCustomer(req, this.tokens, this.stores, this.prisma)) ?? undefined;
    return true;
  }
}

/** The customer the guard attached, or undefined for a guest. */
export const CurrentCustomer = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthedCustomer | undefined =>
    ctx.switchToHttp().getRequest<CustomerRequest>().customer,
);
