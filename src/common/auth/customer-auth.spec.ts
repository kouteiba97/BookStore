import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { hashPassword, verifyPassword } from './password';
import { CustomerTokens } from './customer-tokens';
import { CustomerAuthGuard, OptionalCustomerGuard } from '../guards/customer-auth.guard';
import { AdminAuthGuard } from '../guards/admin-auth.guard';

describe('passwords', () => {
  it('verifies the right password and rejects others', async () => {
    const h = await hashPassword('kalimat-sirr-9');
    expect(h).toMatch(/^scrypt\$16384\$8\$1\$/);
    await expect(verifyPassword('kalimat-sirr-9', h)).resolves.toBe(true);
    await expect(verifyPassword('kalimat-sirr-8', h)).resolves.toBe(false);
  });

  it('salts every hash', async () => {
    expect(await hashPassword('same')).not.toBe(await hashPassword('same'));
  });

  it('rejects malformed stored values instead of throwing', async () => {
    await expect(verifyPassword('x', 'not-a-hash')).resolves.toBe(false);
  });
});

describe('customer tokens and guards', () => {
  const jwt = new JwtService({ secret: 'admin-secret', signOptions: { expiresIn: '30d' } });
  const config = { get: (k: string) => (k === 'JWT_SECRET' ? 'admin-secret' : undefined) } as unknown as ConfigService;
  const tokens = new CustomerTokens(jwt, config);

  const store = { id: 'store-1', slug: 'elbayan', name: 'x' };
  const stores = {
    bySlug: jest.fn(async (slug: string) => {
      if (slug === 'elbayan') return store;
      if (slug === 'other') return { id: 'store-2', slug: 'other', name: 'y' };
      throw new Error('Store not found');
    }),
    getStore: jest.fn(async () => store),
  };
  let tokenVersion = 0;
  const prisma = {
    customer: {
      findFirst: jest.fn(async ({ where }: { where: { id: string; storeId: string } }) =>
        where.id === 'cust-1' && where.storeId === 'store-1' ? { id: 'cust-1', storeId: 'store-1', tokenVersion } : null,
      ),
    },
  };

  const ctx = (token: string | null, storeSlug = 'elbayan') => {
    const req: Record<string, unknown> = {
      headers: token ? { authorization: `Bearer ${token}` } : {},
      params: { storeSlug },
    };
    return {
      req,
      context: { switchToHttp: () => ({ getRequest: () => req }) } as unknown as ExecutionContext,
    };
  };

  const guard = new CustomerAuthGuard(tokens, stores as never, prisma as never);
  const optional = new OptionalCustomerGuard(tokens, stores as never, prisma as never);

  beforeEach(() => {
    tokenVersion = 0;
  });

  it('lets a valid customer token through and attaches the customer', async () => {
    const t = await tokens.sign({ id: 'cust-1', storeId: 'store-1', tokenVersion: 0 });
    const { req, context } = ctx(t);
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(req.customer).toEqual({ id: 'cust-1', storeId: 'store-1' });
  });

  it('refuses an admin token', async () => {
    const adminToken = await jwt.signAsync({ role: 'admin' });
    await expect(guard.canActivate(ctx(adminToken).context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('refuses a token used on another store', async () => {
    const t = await tokens.sign({ id: 'cust-1', storeId: 'store-1', tokenVersion: 0 });
    await expect(guard.canActivate(ctx(t, 'other').context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('refuses a token issued before a password change', async () => {
    const t = await tokens.sign({ id: 'cust-1', storeId: 'store-1', tokenVersion: 0 });
    tokenVersion = 1;
    await expect(guard.canActivate(ctx(t).context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('refuses no token and garbage', async () => {
    await expect(guard.canActivate(ctx(null).context)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(guard.canActivate(ctx('abc.def.ghi').context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('optional guard never blocks: bad token = guest', async () => {
    const { req, context } = ctx('abc.def.ghi');
    await expect(optional.canActivate(context)).resolves.toBe(true);
    expect(req.customer).toBeUndefined();
  });

  it('the admin guard refuses a customer token', async () => {
    const t = await tokens.sign({ id: 'cust-1', storeId: 'store-1', tokenVersion: 0 });
    const adminGuard = new AdminAuthGuard(jwt, stores as never);
    await expect(adminGuard.canActivate(ctx(t).context)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
