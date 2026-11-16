import { createContext, useContext } from "react";
import type { Book } from "./types";

/**
 * The basket. It lives in this browser only (localStorage) — no account
 * needed — and survives reloads and open tabs. Prices kept here are what the
 * customer saw; checkout always re-prices on the server.
 */

/** Same limits as the API (CreateShopOrderDto). */
export const MAX_LINES = 20;
export const MAX_QTY = 10;

export interface CartLine {
  bookId: string;
  title: string;
  /** Price when added; null = set by the shop at confirmation. */
  price: number | null;
  thumbUrl: string | null;
  imageUrl: string | null;
  quantity: number;
}

export type AddResult = "added" | "increased" | "max-qty" | "full";

export interface CartApi {
  lines: CartLine[];
  /** Number of books (sum of quantities). */
  count: number;
  /** Sum of the priced lines. */
  subtotal: number;
  hasUnpriced: boolean;
  add(book: Pick<Book, "id" | "title" | "price" | "thumbUrl" | "imageUrl">, quantity?: number): AddResult;
  setQuantity(bookId: string, quantity: number): void;
  remove(bookId: string): void;
  /** Replace prices/titles with today's values; drop books that no longer exist. */
  reprice(update: Map<string, { title: string; price: number | null; thumbUrl: string | null; imageUrl: string | null }>): { removed: string[]; changed: string[] };
  clear(): void;
  has(bookId: string): boolean;
  drawerOpen: boolean;
  openDrawer(): void;
  closeDrawer(): void;
}

export const CartContext = createContext<CartApi | null>(null);

export function useCart(): CartApi {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}

// ── Persistence ──────────────────────────────────────────

export const CART_KEY = "bayan-cart-v1";

/** Read the saved basket; anything malformed is dropped, never thrown. */
export function readCart(): CartLine[] {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((l): l is CartLine => !!l && typeof l === "object" && typeof (l as CartLine).bookId === "string" && typeof (l as CartLine).title === "string")
      .map((l) => ({
        bookId: l.bookId,
        title: l.title,
        price: toPrice(l.price),
        thumbUrl: l.thumbUrl ?? null,
        imageUrl: l.imageUrl ?? null,
        quantity: clampQty(l.quantity),
      }))
      .slice(0, MAX_LINES);
  } catch {
    return [];
  }
}

export function writeCart(lines: CartLine[]) {
  try {
    if (lines.length) localStorage.setItem(CART_KEY, JSON.stringify(lines));
    else localStorage.removeItem(CART_KEY);
  } catch {
    /* storage blocked (private mode): the basket lives for this visit only */
  }
}

/**
 * A price as a number, or null when there is none. The API sends prices as
 * decimal strings ("1500"), so a number is never assumed.
 */
export function toPrice(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function clampQty(n: unknown): number {
  const v = Math.floor(Number(n));
  return Number.isFinite(v) ? Math.min(MAX_QTY, Math.max(1, v)) : 1;
}
