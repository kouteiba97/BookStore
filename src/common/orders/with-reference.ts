import { Prisma } from '@prisma/client';
import { newReference } from './order-public';

const ATTEMPTS = 5;

/**
 * Run `create(reference)` with a fresh order number, trying again with a new
 * number if another order already took it (Order.@@unique([storeId,
 * reference])). A clash aborts the whole Postgres transaction, so `create`
 * must be the entire transaction, not a step inside one.
 *
 * With six random digits a clash is rare (≈0.1 % at a thousand orders); five
 * attempts make a failure practically impossible.
 */
export async function withReference<T>(create: (reference: string) => Promise<T>): Promise<T> {
  let last: unknown;
  for (let i = 0; i < ATTEMPTS; i++) {
    try {
      return await create(newReference());
    } catch (err) {
      if (!isReferenceClash(err)) throw err;
      last = err;
    }
  }
  throw last;
}

export function isReferenceClash(err: unknown): boolean {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') return false;
  const target = (err.meta as { target?: string[] | string } | undefined)?.target;
  return Array.isArray(target) ? target.includes('reference') : String(target ?? '').includes('reference');
}
