import { BadRequestException } from '@nestjs/common';

/** Values of the Prisma enums, for DTO and query-string validation. */
export const INVENTORY_STATUSES = ['available', 'on_request', 'rare'] as const;
export const ORDER_STATUSES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'] as const;
export const REQUEST_STATUSES = ['pending', 'contacted', 'done'] as const;

/**
 * An optional enum filter from the query string. Empty means "no filter"; an
 * unknown value is the caller's mistake (400), not a database error (500).
 */
export function optionalEnum<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
  name: string,
): T | undefined {
  if (value === undefined || value === '') return undefined;
  if (!(allowed as readonly string[]).includes(value)) {
    throw new BadRequestException(`Invalid ${name}: expected one of ${allowed.join(', ')}`);
  }
  return value as T;
}

/** Page / page size from the query string, clamped so a list is always bounded. */
export function paging(page?: string, pageSize?: string, defaults = { size: 25, max: 100 }) {
  const p = Math.max(1, Math.floor(Number(page)) || 1);
  const s = Math.min(defaults.max, Math.max(1, Math.floor(Number(pageSize)) || defaults.size));
  return { page: p, pageSize: s };
}
