// Pure order business rules — money math and the status state machine.
// Kept free of Prisma/Nest so the logic is unit-testable in isolation.

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

// Status state machine — keeps the operator from making nonsensical jumps.
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['shipped', 'cancelled'],
  shipped: ['delivered', 'cancelled'],
  // A delivered sale can still be returned: cancelling it puts the books back
  // in stock and takes it out of the income.
  delivered: ['cancelled'],
  cancelled: [],
};

/** A move is allowed if it's a no-op or an edge in the transition graph. */
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return true;
  return ORDER_TRANSITIONS[from]?.includes(to) ?? false;
}

export interface OrderTotals {
  subtotal: number;
  discount: number;
  shippingCost: number;
  total: number;
}

const cents = (n: number) => Math.round(n * 100) / 100;

/**
 * Sum line items, apply a discount (never more than the books are worth, never
 * negative) and add shipping (never negative). Money is computed once, here,
 * and rounded to the cent so floating-point dust never reaches the database.
 */
export function computeOrderTotals(
  items: { unitPrice: number; quantity: number }[],
  shipping: number,
  discount = 0,
): OrderTotals {
  const subtotal = cents(items.reduce((s, it) => s + it.unitPrice * it.quantity, 0));
  const d = cents(Math.min(Math.max(0, discount || 0), subtotal));
  const shippingCost = cents(Math.max(0, shipping || 0));
  return {
    subtotal,
    discount: d,
    shippingCost,
    total: cents(subtotal - d + shippingCost),
  };
}
