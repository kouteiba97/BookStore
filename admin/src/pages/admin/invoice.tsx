import { useEffect, useRef } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CHANNEL_LABEL, PAYMENT_LABEL, fetchInvoice, money } from "@/lib/money-api";
import { LogoMark } from "@/components/logo";
import { FeatureGate } from "@/components/admin/plan-gate";
import { ToastProvider } from "@/components/admin/toaster";

/**
 * A numbered invoice, printed from the browser (or saved as PDF from the print
 * dialog). Lives outside the dashboard shell so only the page prints.
 * Opening it gives the order its number the first time (YYYY-NNNN); later
 * opens show the same number.
 */
export default function InvoicePage() {
  return (
    <ToastProvider>
      <div dir="rtl" className="min-h-screen bg-muted/40 p-4 print:bg-white print:p-0">
        <FeatureGate feature="invoices">
          <Invoice />
        </FeatureGate>
      </div>
    </ToastProvider>
  );
}

function Invoice() {
  const { id = "" } = useParams();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["invoice", id],
    queryFn: () => fetchInvoice(id),
    staleTime: Infinity,
    retry: false,
  });
  const printed = useRef(false);
  useEffect(() => {
    if (data && !printed.current && new URLSearchParams(location.search).has("print")) {
      printed.current = true;
      setTimeout(() => window.print(), 300);
    }
  }, [data]);

  if (isLoading) return <p className="p-10 text-center text-sm text-muted-foreground">جاري تجهيز الفاتورة…</p>;
  if (isError || !data) {
    const msg = (error as any)?.response?.data?.message;
    return (
      <div className="mx-auto max-w-md space-y-3 p-10 text-center">
        <p className="font-bold">تعذّر إصدار الفاتورة</p>
        <p className="text-sm text-muted-foreground">{typeof msg === "string" ? msg : "تحقق من الطلب."}</p>
        <Link to={`/admin/orders/${id}`} className="text-sm font-semibold text-primary hover:underline">رجوع للطلب</Link>
      </div>
    );
  }

  const { store, order } = data;
  const customer = `${order.firstName} ${order.lastName}`.trim();
  const date = new Date(order.soldAt ?? order.createdAt).toLocaleDateString("ar-DZ");
  const legal = [
    store.rc && `س.ت: ${store.rc}`,
    store.nif && `ر.ج: ${store.nif}`,
    store.nis && `ر.إ: ${store.nis}`,
    store.art && `م.ض: ${store.art}`,
  ].filter(Boolean);

  return (
    <>
      <div className="mx-auto mb-3 flex max-w-3xl items-center justify-between print:hidden">
        <Link to={`/admin/orders/${order.id}`} className="text-sm font-semibold text-primary hover:underline">→ رجوع للطلب</Link>
        <div className="flex items-center gap-3">
          <Link to="/admin/settings" className="text-xs text-muted-foreground hover:underline">معلومات المتجر على الفاتورة</Link>
          <button type="button" onClick={() => window.print()} className="h-9 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">
            طباعة / حفظ PDF
          </button>
        </div>
      </div>

      <article className="mx-auto max-w-3xl rounded-xl bg-white p-8 text-[13px] text-neutral-900 shadow-sm ring-1 ring-black/5 print:max-w-none print:rounded-none print:p-6 print:shadow-none print:ring-0">
        <header className="flex items-start justify-between gap-6 border-b border-neutral-200 pb-5">
          <div className="flex items-start gap-3">
            <LogoMark className="h-14 w-14 shrink-0" />
            <div className="space-y-0.5">
              <p className="text-lg font-bold">{store.name}</p>
              {store.address && <p className="text-neutral-600">{store.address}</p>}
              <p className="text-neutral-600">
                {store.phone && <span dir="ltr">{store.phone}</span>}
                {store.phone && store.email && " • "}
                {store.email && <span dir="ltr">{store.email}</span>}
              </p>
              {legal.length > 0 && <p className="text-[11px] text-neutral-500">{legal.join("   ")}</p>}
            </div>
          </div>
          <div className="text-end">
            <p className="text-2xl font-bold tracking-tight">فاتورة</p>
            <p className="mt-1 font-mono text-base" dir="ltr">N° {order.invoiceNumber}</p>
            <p className="text-neutral-600">التاريخ: {date}</p>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-6 py-5">
          <div>
            <p className="mb-1 text-[11px] font-semibold text-neutral-500">الزبون</p>
            <p className="font-semibold">{customer || "—"}</p>
            {order.phone && (
              <p className="text-neutral-600">
                <span dir="ltr">{order.phone}</span>
              </p>
            )}
            {(order.address || order.wilaya) && <p className="text-neutral-600">{[order.address, order.wilaya].filter(Boolean).join("، ")}</p>}
          </div>
          <div className="text-end">
            <p className="mb-1 text-[11px] font-semibold text-neutral-500">تفاصيل</p>
            <p>{CHANNEL_LABEL[order.channel] ?? order.channel}</p>
            {order.paymentMethod && <p className="text-neutral-600">الدفع: {PAYMENT_LABEL[order.paymentMethod]}</p>}
          </div>
        </section>

        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-neutral-100 text-[12px]">
              <th className="px-3 py-2 text-start font-semibold">#</th>
              <th className="px-3 py-2 text-start font-semibold">البيان</th>
              <th className="px-3 py-2 text-end font-semibold">الكمية</th>
              <th className="px-3 py-2 text-end font-semibold">سعر الوحدة</th>
              <th className="px-3 py-2 text-end font-semibold">المبلغ</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((it, i) => (
              <tr key={it.id} className="border-b border-neutral-200">
                <td className="px-3 py-2 text-neutral-500">{i + 1}</td>
                <td className="px-3 py-2">{it.bookTitle}</td>
                <td className="px-3 py-2 text-end tabular-nums">{it.quantity}</td>
                <td className="px-3 py-2 text-end tabular-nums">{money(it.unitPrice)}</td>
                <td className="px-3 py-2 text-end tabular-nums">{money(Number(it.unitPrice) * it.quantity)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 flex justify-end">
          <dl className="w-64 space-y-1">
            <Row label="المجموع" value={money(order.subtotal)} />
            {Number(order.discount) > 0 && <Row label="التخفيض" value={`− ${money(order.discount)}`} />}
            {Number(order.shippingCost) > 0 && <Row label="التوصيل" value={money(order.shippingCost)} />}
            <div className="flex justify-between border-t border-neutral-300 pt-2 text-base font-bold">
              <dt>الإجمالي</dt>
              <dd className="tabular-nums">{money(order.total)}</dd>
            </div>
          </dl>
        </div>

        {order.notes && <p className="mt-6 text-neutral-600">ملاحظات: {order.notes}</p>}
        <footer className="mt-10 border-t border-neutral-200 pt-4 text-center text-[11px] text-neutral-500">
          {store.invoiceFooter || "شكرًا لثقتكم."}
        </footer>
      </article>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-neutral-600">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
