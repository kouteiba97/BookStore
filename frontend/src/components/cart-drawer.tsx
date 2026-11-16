import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { useCart } from "@/lib/cart";
import { quoteBooks } from "@/lib/queries";
import { CartLines, CartTotals } from "@/components/cart-lines";
import { PayOnDeliveryNote } from "@/components/customer-fields";

/**
 * The basket, sliding in from the right (the start side in Arabic). Opening it
 * re-prices the lines against the shop, so a changed price or a removed book
 * is known before checkout, not after.
 */
export default function CartDrawer() {
  const cart = useCart();
  const [notice, setNotice] = useState<string | null>(null);
  const { drawerOpen, lines, reprice } = cart;

  useEffect(() => {
    if (!drawerOpen || lines.length === 0) return;
    let live = true;
    quoteBooks(lines.map((l) => l.bookId))
      .then((books) => {
        if (!live) return;
        const { removed, changed } = reprice(new Map(books.map((b) => [b.id, b])));
        const parts = [];
        if (removed.length) parts.push(`لم يعد متوفرًا وحُذف: ${removed.join("، ")}`);
        if (changed.length) parts.push(`تغيّر سعر: ${changed.join("، ")}`);
        setNotice(parts.length ? parts.join(" — ") : null);
      })
      .catch(() => undefined); // offline: keep the saved prices, checkout re-prices anyway
    return () => {
      live = false;
    };
    // Only when the drawer opens, not on every quantity change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawerOpen]);

  return (
    <DialogPrimitive.Root open={drawerOpen} onOpenChange={(o) => (o ? cart.openDrawer() : cart.closeDrawer())}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/30 duration-150 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Popup
          dir="rtl"
          className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-background shadow-2xl outline-none duration-200 data-open:animate-in data-open:slide-in-from-right data-closed:animate-out data-closed:slide-out-to-right"
        >
          <header className="flex items-center justify-between border-b border-border/60 px-4 py-3.5">
            <DialogPrimitive.Title className="font-heading text-lg font-bold">
              السلة {cart.count > 0 && <span className="text-sm font-medium text-muted-foreground">({cart.count})</span>}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="إغلاق السلة">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-5 w-5" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </DialogPrimitive.Close>
          </header>

          {cart.lines.length === 0 ? (
            <EmptyCart onClose={cart.closeDrawer} />
          ) : (
            <>
              <div className="flex-1 overflow-x-hidden overflow-y-auto px-4">
                {notice && (
                  <p role="status" className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 ring-1 ring-amber-200">
                    {notice}
                  </p>
                )}
                <CartLines onNavigate={cart.closeDrawer} />
              </div>
              <footer className="flex flex-col gap-3 border-t border-border/60 bg-muted/20 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
                <CartTotals />
                <Link
                  to="/checkout"
                  onClick={cart.closeDrawer}
                  className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-warm transition-colors hover:bg-primary/90 active:scale-[0.98]"
                >
                  إتمام الطلب
                </Link>
                <PayOnDeliveryNote />
              </footer>
            </>
          )}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function EmptyCart({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-8 w-8" aria-hidden="true">
          <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
          <path d="M3 6h18M16 10a4 4 0 0 1-8 0" />
        </svg>
      </span>
      <p className="font-semibold text-foreground">سلّتك فارغة</p>
      <p className="text-sm text-muted-foreground">أضف الكتب التي تريدها، ثم أرسلها في طلب واحد.</p>
      <Link to="/search" onClick={onClose} className="mt-1 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground">
        تصفّح الكتب
      </Link>
    </div>
  );
}
