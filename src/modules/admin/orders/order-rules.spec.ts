import {
  ORDER_TRANSITIONS,
  canTransition,
  computeOrderTotals,
} from './order-rules';

describe('computeOrderTotals', () => {
  it('sums line items into the subtotal', () => {
    const totals = computeOrderTotals(
      [
        { unitPrice: 1200, quantity: 2 },
        { unitPrice: 500, quantity: 3 },
      ],
      0,
    );
    expect(totals.subtotal).toBe(3900);
    expect(totals.total).toBe(3900);
  });

  it('adds shipping on top of the subtotal', () => {
    const totals = computeOrderTotals([{ unitPrice: 1000, quantity: 1 }], 350);
    expect(totals.subtotal).toBe(1000);
    expect(totals.shippingCost).toBe(350);
    expect(totals.total).toBe(1350);
  });

  it('clamps negative shipping to zero', () => {
    const totals = computeOrderTotals([{ unitPrice: 1000, quantity: 1 }], -50);
    expect(totals.shippingCost).toBe(0);
    expect(totals.total).toBe(1000);
  });

  it('returns zeros for an empty cart', () => {
    expect(computeOrderTotals([], 0)).toEqual({
      subtotal: 0,
      shippingCost: 0,
      total: 0,
    });
  });
});

describe('canTransition', () => {
  it('allows the forward workflow steps', () => {
    expect(canTransition('pending', 'confirmed')).toBe(true);
    expect(canTransition('confirmed', 'shipped')).toBe(true);
    expect(canTransition('shipped', 'delivered')).toBe(true);
  });

  it('allows cancelling from any non-terminal state', () => {
    expect(canTransition('pending', 'cancelled')).toBe(true);
    expect(canTransition('confirmed', 'cancelled')).toBe(true);
    expect(canTransition('shipped', 'cancelled')).toBe(true);
  });

  it('treats a no-op transition as allowed', () => {
    expect(canTransition('pending', 'pending')).toBe(true);
    expect(canTransition('delivered', 'delivered')).toBe(true);
  });

  it('rejects skipping or reversing the workflow', () => {
    expect(canTransition('pending', 'shipped')).toBe(false);
    expect(canTransition('pending', 'delivered')).toBe(false);
    expect(canTransition('shipped', 'pending')).toBe(false);
  });

  it('rejects any move out of a terminal state', () => {
    expect(canTransition('delivered', 'shipped')).toBe(false);
    expect(canTransition('cancelled', 'pending')).toBe(false);
    expect(ORDER_TRANSITIONS.delivered).toEqual([]);
    expect(ORDER_TRANSITIONS.cancelled).toEqual([]);
  });
});
