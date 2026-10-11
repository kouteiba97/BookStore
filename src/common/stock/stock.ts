import { InventoryStatus, Prisma, StockReason } from '@prisma/client';

type Tx = Prisma.TransactionClient;

export interface StockLine {
  bookId: string;
  /** Positive = into stock (purchase, cancelled sale); negative = out (sale). */
  delta: number;
}

/**
 * Move books in or out of stock, inside the caller's transaction, and log
 * every change (StockMovement) with its reason.
 *
 * Rules, as a shop expects them:
 *  - an unknown stock (null) stays unknown when books go out — we cannot
 *    invent a count — but becomes known when books come in;
 *  - stock never goes below 0;
 *  - reaching 0 turns "available" into "on request"; coming back from 0
 *    turns "on request" into "available". "Rare" is left alone.
 *
 * The update is a single atomic SQL statement per book, so two sales of the
 * last copy at the same moment cannot both read the same number.
 */
export async function moveStock(
  tx: Tx,
  storeId: string,
  lines: StockLine[],
  reason: StockReason,
  refId?: string | null,
  note?: string | null,
): Promise<void> {
  // One net change per book.
  const net = new Map<string, number>();
  for (const l of lines) {
    if (!l.bookId || !Number.isInteger(l.delta) || l.delta === 0) continue;
    net.set(l.bookId, (net.get(l.bookId) ?? 0) + l.delta);
  }
  const entries = [...net.entries()].filter(([, d]) => d !== 0);
  if (!entries.length) return;

  for (const [bookId, delta] of entries) {
    const updated = await tx.$queryRaw<{ stock: number | null; status: InventoryStatus }[]>`
      UPDATE "Inventory"
         SET "stock" = CASE
               WHEN "stock" IS NULL AND ${delta}::int > 0 THEN ${delta}::int
               WHEN "stock" IS NULL THEN NULL
               ELSE GREATEST(0, "stock" + ${delta}::int)
             END,
             "updatedAt" = now()
       WHERE "bookId" = ${bookId} AND "storeId" = ${storeId}
   RETURNING "stock", "status"`;

    if (!updated.length) {
      // No inventory row yet: a delivery creates one; a sale of an untracked
      // book leaves stock unknown rather than inventing a count.
      if (delta > 0) {
        await tx.inventory.create({ data: { bookId, storeId, stock: delta, status: 'available' } });
      }
      continue;
    }

    const { stock, status } = updated[0];
    let next: InventoryStatus | null = null;
    if (stock === 0 && status === 'available') next = 'on_request';
    if (stock !== null && stock > 0 && status === 'on_request') next = 'available';
    if (next) await tx.inventory.update({ where: { bookId }, data: { status: next } });
  }

  await tx.stockMovement.createMany({
    data: entries.map(([bookId, delta]) => ({
      storeId,
      bookId,
      delta,
      reason,
      refId: refId ?? null,
      note: note ?? null,
    })),
  });
}

/** Statuses in which an order's books have left the shelf. */
export const STOCK_OUT_STATUSES = ['confirmed', 'shipped', 'delivered'] as const;

export function takesStock(status: string): boolean {
  return (STOCK_OUT_STATUSES as readonly string[]).includes(status);
}
