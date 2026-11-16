import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { OrderTimeline } from "@/components/order-timeline";
import { OrderSummary, ReferenceChip, WhatsAppGlyph } from "@/components/order-confirmation";
import { apiErrorMessage, trackOrder } from "@/lib/queries";
import { whatsappNumber } from "@/lib/store-info";
import { useSavedCustomer } from "@/lib/saved-customer";

/**
 * /track — follow an order with its number and the phone it was placed with.
 * Both are required, so nobody can look up somebody else's order.
 */
export default function TrackPage() {
  const [params, setParams] = useSearchParams();
  const saved = useSavedCustomer();
  const [ref, setRef] = useState(params.get("ref") ?? "");
  const [phone, setPhone] = useState(saved.value?.phone ?? "");
  const [query, setQuery] = useState<{ ref: string; phone: string } | null>(null);

  // Arriving from the confirmation screen on this device: look it up at once.
  useEffect(() => {
    const r = params.get("ref");
    if (r && saved.value?.phone) setQuery({ ref: r, phone: saved.value.phone });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: order, isFetching, error } = useQuery({
    queryKey: ["track", query?.ref, query?.phone],
    queryFn: () => trackOrder(query!.ref, query!.phone),
    enabled: !!query,
    retry: false,
    staleTime: 30_000,
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ref.trim() || !phone.trim()) return;
    setQuery({ ref: ref.trim(), phone: phone.trim() });
    setParams({ ref: ref.trim() }, { replace: true });
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6" dir="rtl">
      <header className="flex flex-col gap-1.5 text-center">
        <h1 className="font-heading text-2xl font-bold text-foreground">تتبّع طلبك</h1>
        <p className="text-sm text-muted-foreground">أدخل رقم الطلب ورقم الهاتف الذي طلبت به.</p>
      </header>

      <form onSubmit={submit} className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-4 shadow-sm" noValidate>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            رقم الطلب
            <Input
              value={ref}
              onChange={(e) => setRef(e.target.value)}
              placeholder="BY-482193"
              dir="ltr"
              autoCapitalize="characters"
              className="h-11 text-left font-mono tracking-wider"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            رقم الهاتف
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="05 XX XX XX XX"
              dir="ltr"
              className="h-11 text-left"
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={isFetching || !ref.trim() || !phone.trim()}
          className="h-11 rounded-xl bg-primary text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50"
        >
          {isFetching ? "جاري البحث…" : "عرض حالة الطلب"}
        </button>
      </form>

      {isFetching && !order && <TrackSkeleton />}

      {error && !isFetching && (
        <div role="alert" className="flex flex-col items-center gap-3 rounded-2xl border border-border/60 bg-muted/30 px-4 py-6 text-center">
          <p className="text-sm font-semibold text-foreground">
            {apiErrorMessage(error, "تعذّر جلب الطلب. تحقّق من الاتصال وأعد المحاولة.")}
          </p>
          <a
            href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(`السلام عليكم، أريد الاستفسار عن طلبي ${ref}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1f7a4a] hover:underline"
          >
            <WhatsAppGlyph className="h-4 w-4" />
            اسألنا على واتساب
          </a>
        </div>
      )}

      {order && (
        <section className="flex flex-col gap-4" aria-live="polite">
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-border/60 bg-card p-4 text-center shadow-sm">
            <ReferenceChip reference={order.reference} />
            <p
              className={`mt-1 rounded-full px-3 py-1 text-sm font-bold ${
                order.status.cancelled ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
              }`}
            >
              {order.status.label}
            </p>
            <p className="max-w-sm text-sm text-muted-foreground">{order.status.hint}</p>
            <p className="text-xs text-muted-foreground">
              طلبت يوم {new Date(order.createdAt).toLocaleDateString("ar-DZ", { day: "numeric", month: "long", year: "numeric" })}
              {" · "}التوصيل إلى {order.wilaya}
            </p>
          </div>

          {!order.status.cancelled && (
            <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
              <OrderTimeline
                step={order.status.step}
                phone={query?.phone}
                carrier={order.carrier}
                trackingNumber={order.trackingNumber}
              />
            </div>
          )}

          <OrderSummary order={order} />
        </section>
      )}
    </div>
  );
}

function TrackSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-4" aria-hidden="true">
      <div className="h-36 rounded-2xl bg-muted" />
      <div className="h-56 rounded-2xl bg-muted" />
    </div>
  );
}
