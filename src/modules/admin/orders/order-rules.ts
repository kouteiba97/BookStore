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
  delivered: [],
  cancelled: [],
};

/** A move is allowed if it's a no-op or an edge in the transition graph. */
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return true;
  return ORDER_TRANSITIONS[from]?.includes(to) ?? false;
}

export interface OrderTotals {
  subtotal: number;
  shippingCost: number;
  total: number;
}

/** Sum line items and clamp shipping to >= 0. Money is computed once here. */
export function computeOrderTotals(
  items: { unitPrice: number; quantity: number }[],
  shipping: number,
): OrderTotals {
  const subtotal = items.reduce((s, it) => s + it.unitPrice * it.quantity, 0);
  const shippingCost = Math.max(0, shipping);
  return {
    subtotal,
    shippingCost,
    total: subtotal + shippingCost,
  };
}
