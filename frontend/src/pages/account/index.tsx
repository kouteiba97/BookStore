import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { WilayaSelect } from "@/components/wilaya-select";
import { OrderTimeline } from "@/components/order-timeline";
import { OrderSummary } from "@/components/order-confirmation";
import { FormError, Labeled, PasswordField, Submit } from "@/components/account-form";
import { changePassword, fetchMyOrders, updateMe, useAccount, ME_KEY, type Customer } from "@/lib/account";
import { apiErrorMessage } from "@/lib/queries";
import { formatDzd } from "@/lib/format";
import type { PublicOrder } from "@/lib/types";

/** /account — «حسابي»: my orders first, then my details and password. */
export default function AccountPage() {
  const account = useAccount();
  if (!account.loggedIn) return <Navigate to="/account/login" replace />;
  if (!account.customer) return <AccountSkeleton />;
  const c = account.customer;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6" dir="rtl">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold">أهلًا {c.firstName}</h1>
          <p className="mt-1 text-sm text-muted-foreground" dir="rtl">
            حسابك على <bdi dir="ltr">{c.phone}</bdi>
          </p>
        </div>
        <button
          type="button"
          onClick={account.logout}
          className="rounded-lg border border-border px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          تسجيل الخروج
        </button>
      </header>

      <MyOrders />
      <Profile customer={c} />
      <ChangePassword />
    </div>
  );
}

function MyOrders() {
  const { data: orders, isLoading, isError } = useQuery({ queryKey: ["account", "orders"], queryFn: fetchMyOrders });
  return (
    <section className="flex flex-col gap-3" aria-labelledby="my-orders">
      <h2 id="my-orders" className="text-lg font-bold">طلباتي</h2>
      {isLoading ? (
        <div className="flex flex-col gap-3" aria-hidden="true">
          {[0, 1].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />)}
        </div>
      ) : isError ? (
        <FormError>تعذّر جلب طلباتك. أعد تحميل الصفحة.</FormError>
      ) : !orders?.length ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border px-4 py-10 text-center">
          <p className="font-semibold">لا طلبات بعد</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            الطلبات التي ترسلها وأنت مسجّل الدخول تظهر هنا. طلب أرسلته قبل إنشاء الحساب؟ تتبّعه من{" "}
            <Link to="/track" className="font-semibold text-primary hover:underline">صفحة التتبّع</Link>.
          </p>
          <Link to="/search" className="mt-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground">تصفّح الكتب</Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {orders.map((o) => <OrderCard key={o.reference} order={o} />)}
        </ul>
      )}
    </section>
  );
}

function OrderCard({ order }: { order: PublicOrder }) {
  const [open, setOpen] = useState(false);
  const priced = order.status.step >= 1;
  return (
    <li className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 p-4 text-right transition-colors hover:bg-muted/30"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <bdi dir="ltr" className="font-mono text-sm font-bold">{order.reference}</bdi>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${order.status.cancelled ? "bg-destructive/10 text-destructive" : order.status.step >= 3 ? "bg-primary/10 text-primary" : "bg-gold-light text-gold-ink"}`}>
              {order.status.label}
            </span>
          </div>
          <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
            {new Date(order.createdAt).toLocaleDateString("ar-DZ", { day: "numeric", month: "long", year: "numeric" })}
            {" · "}
            {order.items.length === 1 ? order.items[0].title : `${order.items.length} كتب`}
          </p>
        </div>
        <span className="shrink-0 text-sm font-bold">{priced ? formatDzd(order.total) : <span className="text-xs font-medium text-muted-foreground">بانتظار التأكيد</span>}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="flex flex-col gap-4 border-t border-border/60 p-4">
          {!order.status.cancelled && (
            <OrderTimeline step={order.status.step} carrier={order.carrier} trackingNumber={order.trackingNumber} />
          )}
          <OrderSummary order={order} />
        </div>
      )}
    </li>
  );
}

function Profile({ customer }: { customer: Customer }) {
  const qc = useQueryClient();
  const [v, setV] = useState({
    firstName: customer.firstName,
    lastName: customer.lastName,
    email: customer.email ?? "",
    wilaya: customer.wilaya ?? "",
    address: customer.address ?? "",
  });
  const [saved, setSaved] = useState(false);
  const m = useMutation({
    mutationFn: () => updateMe({ ...v, email: v.email.trim() || null, wilaya: v.wilaya || null, address: v.address.trim() || null }),
    onSuccess: (c) => {
      qc.setQueriesData({ queryKey: ME_KEY }, c);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });
  const set = (k: keyof typeof v) => (value: string) => setV((s) => ({ ...s, [k]: value }));

  return (
    <section className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm sm:p-5" aria-labelledby="my-details">
      <h2 id="my-details" className="text-lg font-bold">بياناتي</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">تُملأ تلقائيًا عند الطلب. يمكنك تعديلها في كل طلب.</p>
      <form
        className="mt-4 flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          m.mutate();
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <Labeled label="الاسم">
            <Input value={v.firstName} onChange={(e) => set("firstName")(e.target.value)} className="h-11" />
          </Labeled>
          <Labeled label="اللقب">
            <Input value={v.lastName} onChange={(e) => set("lastName")(e.target.value)} className="h-11" />
          </Labeled>
        </div>
        <Labeled label="رقم الهاتف" hint="رقم الدخول إلى حسابك. لتغييره راسلنا على واتساب.">
          <Input value={customer.phone} readOnly dir="ltr" className="h-11 bg-muted/50 text-left text-muted-foreground" />
        </Labeled>
        <Labeled label="البريد الإلكتروني" optional>
          <Input type="email" dir="ltr" value={v.email} onChange={(e) => set("email")(e.target.value)} className="h-11 text-left" />
        </Labeled>
        <div className="flex flex-col gap-1.5 text-sm font-medium">
          <span>الولاية <span className="text-xs font-normal text-muted-foreground">(اختياري)</span></span>
          <WilayaSelect value={v.wilaya} onChange={set("wilaya")} />
        </div>
        <Labeled label="عنوان التوصيل" optional>
          <textarea
            value={v.address}
            onChange={(e) => set("address")(e.target.value)}
            rows={2}
            placeholder="الحي، الشارع، رقم المنزل، البلدية…"
            className="w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm font-normal outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
          />
        </Labeled>
        {m.isError && <FormError>{apiErrorMessage(m.error, "تعذّر الحفظ. أعد المحاولة.")}</FormError>}
        <Submit pending={m.isPending}>{saved ? "حُفظت ✓" : "حفظ البيانات"}</Submit>
      </form>
    </section>
  );
}

function ChangePassword() {
  const account = useAccount();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [done, setDone] = useState(false);
  const m = useMutation({
    mutationFn: () => changePassword(current, next),
    onSuccess: (session) => {
      account.start(session);
      setCurrent("");
      setNext("");
      setDone(true);
    },
  });
  return (
    <details className="group rounded-2xl border border-border/60 bg-card p-4 shadow-sm sm:p-5">
      <summary className="cursor-pointer list-none text-lg font-bold marker:hidden">
        كلمة المرور
        <span className="mr-2 text-xs font-normal text-muted-foreground group-open:hidden">تغيير</span>
      </summary>
      <form
        className="mt-4 flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (current && next.length >= 8) m.mutate();
        }}
      >
        <PasswordField label="كلمة المرور الحالية" value={current} onChange={setCurrent} autoComplete="current-password" />
        <PasswordField label="كلمة المرور الجديدة" value={next} onChange={setNext} autoComplete="new-password" hint="8 أحرف على الأقل. ستُسجَّل خارج أجهزتك الأخرى." />
        {m.isError && <FormError>{apiErrorMessage(m.error, "تعذّر تغيير كلمة المرور.")}</FormError>}
        {done && <p role="status" className="text-sm font-medium text-primary">تغيّرت كلمة المرور ✓</p>}
        <Submit pending={m.isPending}>تغيير كلمة المرور</Submit>
      </form>
    </details>
  );
}

function AccountSkeleton() {
  return (
    <div className="mx-auto flex max-w-3xl animate-pulse flex-col gap-6" aria-hidden="true">
      <div className="h-14 w-48 rounded-lg bg-muted" />
      <div className="h-28 rounded-2xl bg-muted" />
      <div className="h-80 rounded-2xl bg-muted" />
    </div>
  );
}
