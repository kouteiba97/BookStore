import { useState } from "react";
import { Link } from "react-router-dom";
import { OrderTimeline } from "@/components/order-timeline";
import { formatDzd } from "@/lib/format";
import type { PlacedOrder } from "@/lib/types";
import { whatsappNumber } from "@/lib/store-info";

/**
 * Shown the moment an order is placed. It answers the three questions a
 * customer has right then — did it work, what happens now, who calls me — and
 * waits: it never closes itself and never opens WhatsApp on its own.
 */
export function OrderConfirmation({
  order,
  onTrack,
}: {
  order: PlacedOrder;
  /** Called before following the «تتبّع طلبي» link (e.g. to close a dialog). */
  onTrack?: () => void;
}) {
  // The API builds the message with the shop's number; if the server has none
  // configured, the storefront's own number still gives the customer a way in.
  const waUrl =
    order.whatsappUrl ??
    `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
      `السلام عليكم، أرسلت طلبًا من الموقع رقمه ${order.reference}\nأرجو تأكيد الطلب. شكرًا.`,
    )}`;
  return (
    <div className="flex flex-col gap-5" dir="rtl">
      {/* Did it work? */}
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary ring-8 ring-primary/5">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </span>
        <h2 className="font-heading text-xl font-bold text-foreground">تم استلام طلبك</h2>
        <p className="text-sm text-muted-foreground">
          شكرًا {order.firstName}، طلبك مسجّل عندنا.
        </p>
        <ReferenceChip reference={order.reference} />
        <p className="text-[11px] text-muted-foreground">احتفظ بهذا الرقم لتتبّع طلبك.</p>
      </div>

      {/* What happens now? */}
      <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
        <p className="mb-3 text-xs font-semibold text-muted-foreground">ماذا يحدث الآن؟</p>
        <OrderTimeline step={order.status.step} cancelled={order.status.cancelled} phone={order.phone} />
      </div>

      <OrderSummary order={order} />

      {/* Next actions — thumb-reachable, primary first. */}
      <div className="flex flex-col gap-2">
        <Link
          to={`/track?ref=${encodeURIComponent(order.reference)}`}
          onClick={onTrack}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 active:scale-[0.98]"
        >
          تتبّع طلبي
        </Link>
        {waUrl && (
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#1f7a4a]/30 text-sm font-semibold text-[#1f7a4a] transition-colors hover:bg-[#1f7a4a]/5"
          >
            <WhatsAppGlyph className="h-4 w-4" />
            راسلنا على واتساب لتأكيد أسرع
          </a>
        )}
      </div>
    </div>
  );
}

/** The order number, large and copyable. */
export function ReferenceChip({ reference }: { reference: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(reference);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* Clipboard blocked: the number stays readable on screen. */
    }
  };
  return (
    <div className="mt-1 flex items-center gap-2 rounded-xl border border-gold/40 bg-gold-light/40 py-1.5 pr-3 pl-1.5">
      <span className="text-xs text-muted-foreground">رقم طلبك</span>
      <bdi dir="ltr" className="font-mono text-lg font-bold tracking-wider text-foreground">
        {reference}
      </bdi>
      <button
        type="button"
        onClick={copy}
        className="rounded-lg bg-background px-2.5 py-1 text-xs font-semibold text-foreground ring-1 ring-border transition-colors hover:bg-muted"
        aria-label="نسخ رقم الطلب"
      >
        {copied ? "نُسخ ✓" : "نسخ"}
      </button>
    </div>
  );
}

/** Lines and totals, saying plainly what is not known yet. */
export function OrderSummary({ order }: { order: Pick<PlacedOrder, "items" | "subtotal" | "shippingCost" | "discount" | "total" | "hasUnpricedItems" | "status"> }) {
  const priced = order.status.step >= 1; // the shop has confirmed prices and shipping
  return (
    <div className="rounded-xl border border-border/60">
      <ul className="divide-y divide-border/50">
        {order.items.map((it) => (
          <li key={it.bookId} className="flex items-center gap-3 px-3 py-2.5">
            <div className="h-12 w-9 shrink-0 overflow-hidden rounded bg-muted">
              {(it.thumbUrl || it.imageUrl) && (
                <img src={it.thumbUrl || it.imageUrl!} alt="" loading="lazy" className="h-full w-full object-cover" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-1 text-sm font-semibold text-foreground">{it.title}</p>
              <p className="text-xs text-muted-foreground">الكمية: {it.quantity}</p>
            </div>
            <span className="shrink-0 text-sm font-semibold text-foreground">
              {it.unitPrice > 0 ? formatDzd(it.unitPrice * it.quantity) : <span className="text-xs font-medium text-muted-foreground">السعر عند التأكيد</span>}
            </span>
          </li>
        ))}
      </ul>
      <dl className="flex flex-col gap-1.5 border-t border-border/60 bg-muted/20 px-3 py-3 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">مجموع الكتب</dt>
          <dd className="font-semibold">
            {formatDzd(order.subtotal)}
            {order.hasUnpricedItems && !priced && <span className="text-xs font-normal text-muted-foreground"> + كتب يُحدَّد سعرها</span>}
          </dd>
        </div>
        {order.discount > 0 && (
          <div className="flex justify-between">
            <dt className="text-muted-foreground">تخفيض</dt>
            <dd className="font-semibold">− {formatDzd(order.discount)}</dd>
          </div>
        )}
        <div className="flex justify-between">
          <dt className="text-muted-foreground">التوصيل</dt>
          <dd className={priced ? "font-semibold" : "text-xs text-muted-foreground"}>
            {priced ? (order.shippingCost > 0 ? formatDzd(order.shippingCost) : "مجاني") : "يُحدَّد عند التأكيد"}
          </dd>
        </div>
        {priced && (
          <div className="mt-1 flex justify-between border-t border-border/60 pt-2">
            <dt className="font-bold">المبلغ عند الاستلام</dt>
            <dd className="font-bold text-primary">{formatDzd(order.total)}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}

export function WhatsAppGlyph({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.7a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3Z" />
    </svg>
  );
}
