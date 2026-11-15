import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { useCart } from "@/lib/cart";
import { useCustomerForm } from "@/lib/customer-form";
import { useSavedCustomer } from "@/lib/saved-customer";
import { apiErrorMessage, createOrder, quoteBooks } from "@/lib/queries";
import { CustomerFields, PayOnDeliveryNote } from "@/components/customer-fields";
import { CartLines, CartTotals } from "@/components/cart-lines";
import { OrderConfirmation } from "@/components/order-confirmation";
import type { PlacedOrder } from "@/lib/types";

/**
 * /checkout — the whole basket as one order. Same form and the same promises
 * as the one-book dialog; the confirmation replaces the page once it is sent.
 */
export default function CheckoutPage() {
  const cart = useCart();
  const saved = useSavedCustomer();
  const f = useCustomerForm(saved.value);
  const [note, setNote] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [placed, setPlaced] = useState<PlacedOrder | null>(null);
  const [repriceNote, setRepriceNote] = useState<string | null>(null);

  // Prices may have moved since the books were added: refresh once on arrival.
  useEffect(() => {
    if (!cart.lines.length) return;
    quoteBooks(cart.lines.map((l) => l.bookId))
      .then((books) => {
        const { removed, changed } = cart.reprice(new Map(books.map((b) => [b.id, b])));
        const parts = [];
        if (removed.length) parts.push(`لم يعد متوفرًا وحُذف: ${removed.join("، ")}`);
        if (changed.length) parts.push(`تغيّر سعر: ${changed.join("، ")}`);
        setRepriceNote(parts.length ? parts.join(" — ") : null);
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mutation = useMutation({
    mutationFn: createOrder,
    onSuccess: (order) => {
      saved.remember(f.values());
      setPlaced(order);
      cart.clear();
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.validate()) {
      document.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
      return;
    }
    mutation.mutate({
      ...f.values(),
      items: cart.lines.map((l) => ({ bookId: l.bookId, quantity: l.quantity })),
      note: note.trim() || undefined,
      website,
    });
  }

  if (placed) {
    return (
      <div className="mx-auto max-w-lg">
        <OrderConfirmation order={placed} />
      </div>
    );
  }

  if (!cart.lines.length) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center" dir="rtl">
        <h1 className="font-heading text-2xl font-bold">سلّتك فارغة</h1>
        <p className="text-sm text-muted-foreground">أضف الكتب التي تريدها إلى السلة، ثم ارجع هنا لإرسال الطلب.</p>
        <Link to="/search" className="mt-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground">
          تصفّح الكتب
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6" dir="rtl">
      <header>
        <h1 className="font-heading text-2xl font-bold text-foreground">إتمام الطلب</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          أرسل طلبك، ثم يتصل بك فريق المكتبة لتأكيده. لا دفع الآن.
        </p>
      </header>

      <form onSubmit={submit} noValidate className="relative grid gap-6 lg:grid-cols-[1fr_380px] lg:items-start">
        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          className="pointer-events-none absolute h-0 w-0 border-0 p-0 opacity-0"
        />

        {/* Delivery details */}
        <section className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-card p-4 shadow-sm sm:p-5" aria-labelledby="co-details">
          <h2 id="co-details" className="text-base font-bold">بيانات التوصيل</h2>
          <CustomerFields f={f} />
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            ملاحظة للمكتبة <span className="text-xs font-normal text-muted-foreground">(اختياري)</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="مثلًا: أفضّل طبعة دار …، أو وقت مناسب للاتصال"
              className="w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
            />
          </label>
        </section>

        {/* Basket + send — sticky on large screens */}
        <aside className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-card p-4 shadow-sm sm:p-5 lg:sticky lg:top-24" aria-labelledby="co-basket">
          <div className="flex items-center justify-between">
            <h2 id="co-basket" className="text-base font-bold">طلبك</h2>
            <button type="button" onClick={cart.openDrawer} className="text-xs font-semibold text-primary hover:underline">
              تعديل السلة
            </button>
          </div>
          {repriceNote && (
            <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 ring-1 ring-amber-200">
              {repriceNote}
            </p>
          )}
          <div className="max-h-80 overflow-x-hidden overflow-y-auto lg:max-h-[45vh]">
            <CartLines />
          </div>
          <div className="border-t border-border/60 pt-3">
            <CartTotals />
          </div>

          {mutation.isError && (
            <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
              {apiErrorMessage(mutation.error, "لم يُرسَل الطلب. تحقّق من الاتصال وأعد المحاولة.")}
            </p>
          )}

          <button
            type="submit"
            disabled={mutation.isPending}
            className="h-12 w-full rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-warm transition-colors hover:bg-primary/90 active:scale-[0.98] disabled:opacity-60"
          >
            {mutation.isPending ? "جاري الإرسال…" : `إرسال الطلب (${cart.count} ${cart.count === 1 ? "كتاب" : "كتب"})`}
          </button>
          <PayOnDeliveryNote />
        </aside>
      </form>
    </div>
  );
}
