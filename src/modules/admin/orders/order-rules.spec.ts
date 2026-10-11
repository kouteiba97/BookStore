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
      discount: 0,
      shippingCost: 0,
      total: 0,
    });
  });

  it('applies a discount, never beyond the value of the books', () => {
    expect(computeOrderTotals([{ unitPrice: 1000, quantity: 2 }], 300, 500).total).toBe(1800);
    expect(computeOrderTotals([{ unitPrice: 1000, quantity: 1 }], 300, 5000)).toMatchObject({ discount: 1000, total: 300 });
    expect(computeOrderTotals([{ unitPrice: 1000, quantity: 1 }], 0, -200).discount).toBe(0);
  });

  it('rounds money to the cent', () => {
    expect(computeOrderTotals([{ unitPrice: 0.1, quantity: 3 }], 0).total).toBe(0.3);
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

  it('a delivered sale can only be returned (cancelled), never moved back', () => {
    expect(canTransition('delivered', 'shipped')).toBe(false);
    expect(canTransition('delivered', 'pending')).toBe(false);
    expect(ORDER_TRANSITIONS.delivered).toEqual(['cancelled']);
  });

  it('cancelled is final', () => {
    expect(canTransition('cancelled', 'pending')).toBe(false);
    expect(ORDER_TRANSITIONS.cancelled).toEqual([]);
  });
});
