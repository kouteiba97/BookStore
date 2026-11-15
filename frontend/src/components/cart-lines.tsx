import { Link } from "react-router-dom";
import { MAX_QTY, useCart, type CartLine } from "@/lib/cart";
import { formatDzd } from "@/lib/format";

/** The basket's lines with quantity steppers — used by the drawer and checkout. */
export function CartLines({ onNavigate }: { onNavigate?: () => void }) {
  const cart = useCart();
  return (
    <ul className="divide-y divide-border/50">
      {cart.lines.map((l) => (
        <CartLineRow key={l.bookId} line={l} onNavigate={onNavigate} />
      ))}
    </ul>
  );
}

function CartLineRow({ line, onNavigate }: { line: CartLine; onNavigate?: () => void }) {
  const cart = useCart();
  const src = line.thumbUrl || line.imageUrl;
  return (
    <li className="flex gap-3 py-3">
      <Link to={`/books/${line.bookId}`} onClick={onNavigate} className="h-20 w-14 shrink-0 overflow-hidden rounded-md bg-muted ring-1 ring-border/50">
        {src ? <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" /> : null}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-start justify-between gap-2">
          <Link to={`/books/${line.bookId}`} onClick={onNavigate} className="line-clamp-2 text-sm font-semibold leading-snug text-foreground hover:text-primary">
            {line.title}
          </Link>
          <button
            type="button"
            onClick={() => cart.remove(line.bookId)}
            className="-m-1 shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            aria-label={`حذف «${line.title}» من السلة`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4" aria-hidden="true">
              <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
            </svg>
          </button>
        </div>
        <div className="mt-auto flex items-center justify-between gap-2">
          <QtyStepper
            value={line.quantity}
            onChange={(q) => cart.setQuantity(line.bookId, q)}
            label={line.title}
          />
          <span className="text-sm font-bold text-foreground">
            {line.price != null ? formatDzd(line.price * line.quantity) : <span className="text-xs font-medium text-muted-foreground">السعر عند التأكيد</span>}
          </span>
        </div>
      </div>
    </li>
  );
}

function QtyStepper({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  const btn = "flex h-8 w-8 items-center justify-center text-base font-bold text-foreground transition-colors hover:bg-muted disabled:opacity-30";
  return (
    <div className="flex items-center overflow-hidden rounded-lg ring-1 ring-border" role="group" aria-label={`كمية «${label}»`}>
      <button type="button" className={btn} onClick={() => onChange(value + 1)} disabled={value >= MAX_QTY} aria-label="زيادة">
        +
      </button>
      <span className="w-7 text-center text-sm font-semibold tabular-nums" aria-live="polite">{value}</span>
      <button type="button" className={btn} onClick={() => onChange(value - 1)} disabled={value <= 1} aria-label="إنقاص">
        −
      </button>
    </div>
  );
}

/** Subtotal, saying plainly what is still to be set. */
export function CartTotals() {
  const cart = useCart();
  return (
    <dl className="flex flex-col gap-1.5 text-sm">
      <div className="flex justify-between">
        <dt className="text-muted-foreground">مجموع الكتب ({cart.count})</dt>
        <dd className="font-bold text-foreground">{formatDzd(cart.subtotal)}</dd>
      </div>
      {cart.hasUnpriced && (
        <p className="text-xs text-muted-foreground">+ كتب يُحدَّد سعرها عند التأكيد</p>
      )}
      <div className="flex justify-between">
        <dt className="text-muted-foreground">التوصيل</dt>
        <dd className="text-xs text-muted-foreground">يُحدَّد عند التأكيد حسب الولاية</dd>
      </div>
    </dl>
  );
}
