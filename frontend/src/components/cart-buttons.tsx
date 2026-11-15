import { useCart } from "@/lib/cart";
import type { Book } from "@/lib/types";

/** Header button with the number of books in the basket. */
export function CartButton() {
  const cart = useCart();
  const warm = () => void import("@/components/cart-drawer").catch(() => undefined);
  return (
    <button
      type="button"
      onClick={cart.openDrawer}
      onPointerEnter={warm}
      onFocus={warm}
      className="relative flex h-10 w-10 items-center justify-center rounded-lg text-gold-light transition-colors hover:bg-gold/10"
      aria-label={cart.count ? `السلة: ${cart.count} كتاب` : "السلة فارغة"}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
        <path d="M3 6h18M16 10a4 4 0 0 1-8 0" />
      </svg>
      {cart.count > 0 && (
        <span className="absolute -top-0.5 -left-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold text-[#1F3A2E] tabular-nums ring-2 ring-[#1F3A2E]">
          {cart.count > 99 ? "99+" : cart.count}
        </span>
      )}
    </button>
  );
}

type CartBook = Pick<Book, "id" | "title" | "price" | "thumbUrl" | "imageUrl">;

/** «أضف إلى السلة» — full-width on the book page, compact on cards. */
export function AddToCartButton({ book, variant = "page" }: { book: CartBook; variant?: "page" | "card" | "bar" }) {
  const cart = useCart();
  const inCart = cart.has(book.id);

  if (variant === "card") {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          cart.add(book);
        }}
        className={`flex h-[34px] w-10 shrink-0 items-center justify-center rounded-lg border transition-colors ${
          inCart
            ? "border-primary/30 bg-primary/10 text-primary"
            : "border-border/70 bg-card text-foreground/70 hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
        }`}
        aria-label={inCart ? `«${book.title}» في السلة — أضف نسخة أخرى` : `أضف «${book.title}» إلى السلة`}
        title={inCart ? "في السلة" : "أضف إلى السلة"}
      >
        <CartPlusIcon done={inCart} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => cart.add(book)}
      className={`inline-flex h-12 w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl border-2 text-sm font-bold transition-all active:scale-[0.98] sm:w-auto ${variant === "bar" ? "px-3" : "px-6"} ${
        inCart
          ? "border-primary/30 bg-primary/5 text-primary"
          : "border-primary/70 bg-background text-primary hover:bg-primary/5"
      }`}
    >
      <CartPlusIcon done={inCart} />
      {variant === "bar" ? (inCart ? "في السلة" : "أضف للسلة") : inCart ? "في السلة — أضف نسخة" : "أضف إلى السلة"}
    </button>
  );
}

function CartPlusIcon({ done }: { done: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <path d="M3 6h18" />
      {done ? <path d="m9 13 2 2 4-4" /> : <path d="M12 10v6M9 13h6" />}
    </svg>
  );
}
