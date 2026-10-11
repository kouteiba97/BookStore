import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CHANNEL_LABEL,
  PAYMENT_LABEL,
  createCounterSale,
  fetchSales,
  money,
  ymd,
  type Channel,
  type PaymentMethod,
} from "@/lib/money-api";
import type { AdminBook } from "@/lib/admin-types";
import { Button, EmptyState, Pagination, StatusBadge, Surface, TableSkeleton, inputClass, selectClass } from "@/components/admin/primitives";
import { useToast } from "@/components/admin/toaster";
import BookSearch from "@/components/admin/book-search";
import { useFeature } from "@/components/admin/plan-gate";

const STATUS_LABEL: Record<string, string> = {
  pending: "قيد الانتظار",
  confirmed: "مؤكد",
  shipped: "تم الشحن",
  delivered: "تم التسليم",
  cancelled: "ملغى / مرتجع",
};

type Tab = "counter" | "register";

/**
 * One sales register for every channel — storefront and phone orders,
 * counter sales and imported history — plus the counter itself.
 */
export default function SalesPage() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") === "register" ? "register" : "counter") as Tab;
  return (
    <div className="space-y-5">
      <div className="flex gap-1 rounded-xl border border-border/60 bg-card p-1">
        {(
          [
            ["counter", "بيع في المحل"],
            ["register", "سجل المبيعات"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setParams({ tab: k }, { replace: true })}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
              tab === k ? "bg-primary text-primary-foreground shadow-warm" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "counter" ? <Counter onDone={() => setParams({ tab: "register" }, { replace: true })} /> : <Register />}
    </div>
  );
}

// ── Counter (point of sale) ───────────────────────────────

interface CartLine {
  book: AdminBook;
  quantity: number;
  unitPrice: number;
}

function Counter({ onDone }: { onDone: () => void }) {
  const toast = useToast();
  const qc = useQueryClient();
  const invoices = useFeature("invoices");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [discount, setDiscount] = useState("");
  const [payment, setPayment] = useState<PaymentMethod>("cash");
  const [customer, setCustomer] = useState("");
  const [phone, setPhone] = useState("");
  const [received, setReceived] = useState("");
  const [last, setLast] = useState<{ id: string; total: number } | null>(null);

  const subtotal = cart.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  const disc = Math.min(Math.max(0, Number(discount) || 0), subtotal);
  const total = subtotal - disc;
  const change = Number(received) > 0 ? Number(received) - total : null;

  const add = (book: AdminBook) => {
    setLast(null);
    setCart((c) => {
      const i = c.findIndex((l) => l.book.id === book.id);
      if (i >= 0) return c.map((l, k) => (k === i ? { ...l, quantity: l.quantity + 1 } : l));
      return [...c, { book, quantity: 1, unitPrice: Number(book.price ?? 0) }];
    });
  };
  const update = (i: number, patch: Partial<CartLine>) => setCart((c) => c.map((l, k) => (k === i ? { ...l, ...patch } : l)));
  const remove = (i: number) => setCart((c) => c.filter((_, k) => k !== i));

  const sell = useMutation({
    mutationFn: () =>
      createCounterSale({
        items: cart.map((l) => ({ bookId: l.book.id, quantity: l.quantity, unitPrice: l.unitPrice })),
        discount: disc || undefined,
        paymentMethod: payment,
        customerName: customer.trim() || undefined,
        phone: phone.trim() || undefined,
      }),
    onSuccess: (o) => {
      toast.success(`تم البيع: ${money(o.total)}`);
      setLast({ id: o.id, total: Number(o.total) });
      setCart([]);
      setDiscount("");
      setCustomer("");
      setPhone("");
      setReceived("");
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["admin-books"] });
      qc.invalidateQueries({ queryKey: ["admin-inventory"] });
      qc.invalidateQueries({ queryKey: ["book-search"] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || "تعذّر تسجيل البيع"),
  });

  const overStock = cart.filter((l) => l.book.inventory?.stock != null && l.quantity > l.book.inventory.stock);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
      <Surface className="space-y-4 p-4">
        <BookSearch onPick={add} autoFocus placeholder="امسح أو اكتب عنوان الكتاب ثم Enter..." />
        {cart.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {last ? (
              <>
                تم تسجيل البيع ({money(last.total)}).{" "}
                {invoices && (
                  <Link to={`/admin/invoice/${last.id}`} target="_blank" className="font-semibold text-primary hover:underline">
                    طباعة الفاتورة
                  </Link>
                )}
              </>
            ) : (
              "ابحث عن كتاب لإضافته إلى البيع."
            )}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b border-border/60">
                <th className="py-2 text-start font-semibold">الكتاب</th>
                <th className="w-20 py-2 text-start font-semibold">الكمية</th>
                <th className="w-28 py-2 text-start font-semibold">السعر</th>
                <th className="w-24 py-2 text-end font-semibold">المجموع</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {cart.map((l, i) => (
                <tr key={l.book.id} className="border-b border-border/30 last:border-0">
                  <td className="py-2 pe-2">
                    <p className="truncate font-medium">{l.book.title}</p>
                    {l.book.inventory?.stock != null && (
                      <p className={`text-xs ${l.quantity > l.book.inventory.stock ? "text-rose-600" : "text-muted-foreground"}`}>
                        في المخزون: {l.book.inventory.stock}
                      </p>
                    )}
                  </td>
                  <td className="py-2 pe-2">
                    <input
                      type="number"
                      min={1}
                      value={l.quantity}
                      onChange={(e) => update(i, { quantity: Math.max(1, Math.floor(Number(e.target.value) || 1)) })}
                      className={`${inputClass} h-9`}
                      aria-label="الكمية"
                    />
                  </td>
                  <td className="py-2 pe-2">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={l.unitPrice}
                      onChange={(e) => update(i, { unitPrice: Math.max(0, Number(e.target.value) || 0) })}
                      className={`${inputClass} h-9`}
                      aria-label="السعر"
                    />
                  </td>
                  <td className="py-2 text-end tabular-nums">{money(l.unitPrice * l.quantity)}</td>
                  <td className="py-2 text-end">
                    <button type="button" onClick={() => remove(i)} aria-label="حذف" className="rounded p-1 text-rose-600 hover:bg-rose-50">
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {overStock.length > 0 && (
          <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-800">
            الكمية أكبر من المخزون المسجّل لـ {overStock.length} كتاب. يمكنك المتابعة؛ سيُصبح المخزون 0.
          </p>
        )}
      </Surface>

      <Surface className="h-fit space-y-3 p-4 lg:sticky lg:top-4">
        <div className="space-y-1 text-sm">
          <Line label="المجموع" value={money(subtotal)} />
          <label className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">تخفيض</span>
            <input type="number" min={0} value={discount} onChange={(e) => setDiscount(e.target.value)} className={`${inputClass} h-8 w-28`} placeholder="0" />
          </label>
          <div className="flex items-center justify-between border-t border-border/50 pt-2 text-lg font-bold">
            <span>الصافي</span>
            <span className="tabular-nums">{money(total)}</span>
          </div>
        </div>
        <select value={payment} onChange={(e) => setPayment(e.target.value as PaymentMethod)} className={selectClass} aria-label="طريقة الدفع">
          {(["cash", "card", "transfer", "other"] as PaymentMethod[]).map((p) => (
            <option key={p} value={p}>
              {PAYMENT_LABEL[p]}
            </option>
          ))}
        </select>
        {payment === "cash" && (
          <label className="block text-xs text-muted-foreground">
            المبلغ المستلم
            <input type="number" min={0} value={received} onChange={(e) => setReceived(e.target.value)} className={`${inputClass} mt-1`} />
            {change !== null && (
              <span className={`mt-1 block text-sm font-bold ${change < 0 ? "text-rose-600" : "text-emerald-700"}`}>
                {change < 0 ? `ناقص ${money(-change)}` : `الباقي للزبون: ${money(change)}`}
              </span>
            )}
          </label>
        )}
        <input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="اسم الزبون (اختياري)" className={inputClass} />
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="الهاتف (اختياري)" className={inputClass} dir="ltr" />
        <Button className="w-full" onClick={() => sell.mutate()} disabled={!cart.length || sell.isPending}>
          {sell.isPending ? "جاري التسجيل..." : `تسجيل البيع — ${money(total)}`}
        </Button>
        <button type="button" onClick={onDone} className="w-full text-center text-xs text-muted-foreground hover:underline">
          عرض سجل المبيعات
        </button>
      </Surface>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

// ── Register ──────────────────────────────────────────────

function Register() {
  const now = new Date();
  const [channel, setChannel] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState(ymd(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [to, setTo] = useState(ymd(now));
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);
  const filters = useMemo(() => ({ channel, status, from, to, search: debounced }), [channel, status, from, to, debounced]);
  useEffect(() => setPage(1), [filters]);

  const { data, isLoading } = useQuery({
    queryKey: ["sales", filters, page],
    queryFn: () =>
      fetchSales({
        channel: channel || undefined,
        status: status || undefined,
        from: from || undefined,
        to: to || undefined,
        search: debounced || undefined,
        page,
        pageSize: 25,
      }),
    placeholderData: keepPreviousData,
  });

  const orders: any[] = data?.orders ?? [];
  const sum = orders.filter((o) => ["confirmed", "shipped", "delivered"].includes(o.status)).reduce((s, o) => s + Number(o.total), 0);

  return (
    <div className="space-y-4">
      <Surface className="flex flex-wrap items-end gap-2 p-4">
        <label className="text-xs text-muted-foreground">
          من
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={`${inputClass} mt-1 h-9`} />
        </label>
        <label className="text-xs text-muted-foreground">
          إلى
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={`${inputClass} mt-1 h-9`} />
        </label>
        <select value={channel} onChange={(e) => setChannel(e.target.value)} className={`${selectClass} h-9 w-auto`} aria-label="القناة">
          <option value="">كل القنوات</option>
          {(Object.keys(CHANNEL_LABEL) as Channel[]).map((c) => (
            <option key={c} value={c}>
              {CHANNEL_LABEL[c]}
            </option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${selectClass} h-9 w-auto`} aria-label="الحالة">
          <option value="">كل الحالات</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="زبون، هاتف، رقم فاتورة، كتاب..." className={`${inputClass} h-9 min-w-[12rem] flex-1`} />
      </Surface>

      {isLoading ? (
        <TableSkeleton rows={6} cols={5} />
      ) : !orders.length ? (
        <EmptyState title="لا توجد مبيعات في هذه الفترة" description="غيّر الفترة أو سجّل بيعًا من «بيع في المحل»." />
      ) : (
        <Surface className="overflow-hidden">
          <div className="flex flex-wrap justify-between gap-2 border-b border-border/60 px-4 py-2 text-xs text-muted-foreground">
            <span>{data.total} عملية</span>
            <span>
              مجموع هذه الصفحة (بدون الملغاة): <span className="font-bold text-foreground">{money(sum)}</span>
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-border/60">
                  <th className="px-4 py-2 text-start font-semibold">التاريخ</th>
                  <th className="px-2 py-2 text-start font-semibold">الزبون</th>
                  <th className="px-2 py-2 text-start font-semibold">القناة</th>
                  <th className="px-2 py-2 text-start font-semibold">الكتب</th>
                  <th className="px-2 py-2 text-start font-semibold">الحالة</th>
                  <th className="px-4 py-2 text-end font-semibold">المبلغ</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-b border-border/30 last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-2 whitespace-nowrap text-xs text-muted-foreground">
                      {new Date(o.soldAt ?? o.createdAt).toLocaleDateString("ar-DZ")}
                      {o.invoiceNumber && <span className="block font-mono">{o.invoiceNumber}</span>}
                    </td>
                    <td className="px-2 py-2">
                      <Link to={`/admin/orders/${o.id}`} className="font-medium hover:text-primary">
                        {`${o.firstName} ${o.lastName}`.trim() || "—"}
                      </Link>
                    </td>
                    <td className="px-2 py-2 text-xs">{CHANNEL_LABEL[o.channel as Channel] ?? o.channel}</td>
                    <td className="max-w-[14rem] truncate px-2 py-2 text-xs text-muted-foreground" title={o.items.map((i: any) => i.bookTitle).join("، ")}>
                      {o.items.map((i: any) => `${i.bookTitle}${i.quantity > 1 ? ` ×${i.quantity}` : ""}`).join("، ")}
                    </td>
                    <td className="px-2 py-2">
                      <StatusBadge status={o.status} label={STATUS_LABEL[o.status] ?? o.status} />
                    </td>
                    <td className="px-4 py-2 text-end font-semibold tabular-nums">{money(o.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={25} total={data.total} onChange={setPage} />
        </Surface>
      )}
    </div>
  );
}
