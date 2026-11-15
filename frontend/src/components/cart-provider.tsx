import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  CART_KEY,
  CartContext,
  MAX_LINES,
  MAX_QTY,
  clampQty,
  toPrice,
  readCart,
  writeCart,
  type CartApi,
  type CartLine,
} from "@/lib/cart";

// The drawer pulls in the dialog library; it loads the first time it opens.
const CartDrawer = lazy(() => import("@/components/cart-drawer"));

/**
 * Holds the basket for the whole storefront, keeps it in localStorage and in
 * step across tabs, and shows a short «أُضيف إلى السلة» note after each add.
 */
export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(readCart);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMounted, setDrawerMounted] = useState(false);
  const [notice, setNotice] = useState<{ title: string; key: number; text: string } | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Every change is saved; another tab's change is picked up here.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    writeCart(lines);
  }, [lines]);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === CART_KEY || e.key === null) setLines(readCart());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const flash = useCallback((title: string, text: string) => {
    clearTimeout(noticeTimer.current);
    setNotice({ title, text, key: Date.now() });
    noticeTimer.current = setTimeout(() => setNotice(null), 3200);
  }, []);

  const openDrawer = useCallback(() => {
    setDrawerMounted(true);
    setDrawerOpen(true);
    setNotice(null);
  }, []);

  const api = useMemo<CartApi>(() => {
    const count = lines.reduce((s, l) => s + l.quantity, 0);
    const subtotal = lines.reduce((s, l) => s + (l.price ?? 0) * l.quantity, 0);
    return {
      lines,
      count,
      subtotal,
      hasUnpriced: lines.some((l) => l.price == null),
      has: (id) => lines.some((l) => l.bookId === id),
      add(book, quantity = 1) {
        const existing = lines.find((l) => l.bookId === book.id);
        if (existing) {
          if (existing.quantity >= MAX_QTY) {
            flash(book.title, `الحدّ الأقصى ${MAX_QTY} نسخ من الكتاب نفسه`);
            return "max-qty";
          }
          setLines((ls) => ls.map((l) => (l.bookId === book.id ? { ...l, quantity: clampQty(l.quantity + quantity) } : l)));
          flash(book.title, "زدنا الكمية في السلة");
          return "increased";
        }
        if (lines.length >= MAX_LINES) {
          flash(book.title, `السلة ممتلئة (${MAX_LINES} كتابًا مختلفًا كحدّ أقصى)`);
          return "full";
        }
        setLines((ls) => [
          ...ls,
          {
            bookId: book.id,
            title: book.title,
            price: toPrice(book.price),
            thumbUrl: book.thumbUrl ?? null,
            imageUrl: book.imageUrl ?? null,
            quantity: clampQty(quantity),
          },
        ]);
        flash(book.title, "أُضيف إلى السلة");
        return "added";
      },
      setQuantity: (id, q) => setLines((ls) => ls.map((l) => (l.bookId === id ? { ...l, quantity: clampQty(q) } : l))),
      remove: (id) => setLines((ls) => ls.filter((l) => l.bookId !== id)),
      clear: () => setLines([]),
      reprice(update) {
        const removed: string[] = [];
        const changed: string[] = [];
        const next: CartLine[] = [];
        for (const l of lines) {
          const u = update.get(l.bookId);
          if (!u) {
            removed.push(l.title);
            continue;
          }
          const price = toPrice(u.price);
          if (price !== l.price) changed.push(u.title);
          next.push({ ...l, title: u.title, price, thumbUrl: u.thumbUrl, imageUrl: u.imageUrl });
        }
        if (JSON.stringify(next) !== JSON.stringify(lines)) setLines(next);
        return { removed, changed };
      },
      drawerOpen,
      openDrawer,
      closeDrawer: () => setDrawerOpen(false),
    };
  }, [lines, drawerOpen, flash, openDrawer]);

  return (
    <CartContext.Provider value={api}>
      {children}
      {drawerMounted && (
        <Suspense fallback={null}>
          <CartDrawer />
        </Suspense>
      )}
      {notice && !drawerOpen && (
        <div
          key={notice.key}
          role="status"
          dir="rtl"
          className="fixed inset-x-3 bottom-20 z-[60] mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-[#1F3A2E] px-4 py-3 text-sm text-white shadow-lg duration-200 animate-in fade-in-0 slide-in-from-bottom-2 md:bottom-6"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold text-[#1F3A2E]" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-3.5 w-3.5">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{notice.text}</p>
            <p className="truncate text-xs text-white/70">{notice.title}</p>
          </div>
          <button
            type="button"
            onClick={openDrawer}
            className="shrink-0 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-bold text-gold-light transition-colors hover:bg-white/20"
          >
            عرض السلة
          </button>
        </div>
      )}
    </CartContext.Provider>
  );
}
