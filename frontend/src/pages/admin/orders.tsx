import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchOrders } from "@/lib/admin-api";
import type { AdminOrder, OrderStatus } from "@/lib/admin-types";
import {
  Button,
  EmptyState,
  Pagination,
  StatusBadge,
  Surface,
  TableSkeleton,
  inputClass,
  selectClass,
} from "@/components/admin/primitives";

const STATUSES: { value: OrderStatus; label: string }[] = [
  { value: "pending", label: "قيد الانتظار" },
  { value: "confirmed", label: "مؤكدة" },
  { value: "shipped", label: "قيد الشحن" },
  { value: "delivered", label: "مسلَّمة" },
  { value: "cancelled", label: "ملغاة" },
];
const LABEL: Record<OrderStatus, string> = STATUSES.reduce(
  (a, s) => ({ ...a, [s.value]: s.label }),
  {} as Record<OrderStatus, string>,
);

export default function OrdersPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery<{
    orders: AdminOrder[];
    total: number;
    counts: { status: OrderStatus; _count: number }[];
    totalRevenue: number;
  }>({
    queryKey: ["admin-orders", search, status, page],
    queryFn: () =>
      fetchOrders({
        search: search || undefined,
        status: status || undefined,
        page,
        pageSize: 25,
      }),
  });

  const orders = data?.orders ?? [];
  const counts = data?.counts ?? [];
  const totalRev = data?.totalRevenue ?? 0;
  const totalOrders = counts.reduce((s, c) => s + c._count, 0);

  const getCount = (s: OrderStatus) =>
    counts.find((c) => c.status === s)?._count ?? 0;

  return (
    <div className="space-y-5">
      {/* ── Quick stats strip ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniStat label="الإجمالي" value={totalOrders} accent="border-border/60" />
        <MiniStat label="مؤكدة" value={getCount("confirmed")} accent="border-blue-200 bg-blue-50/40" />
        <MiniStat label="مسلَّمة" value={getCount("delivered")} accent="border-emerald-200 bg-emerald-50/40" />
        <MiniStat
          label="الإيرادات"
          value={`${totalRev.toLocaleString("ar-DZ", { maximumFractionDigits: 0 })} د.ج`}
          accent="border-primary/20 bg-primary/5"
        />
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
          </svg>
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="ابحث بالاسم أو الهاتف..."
            className={`${inputClass} pr-9`}
          />
        </div>
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className={`${selectClass} h-10 w-auto`}
        >
          <option value="">كل الحالات</option>
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        {(search || status) && (
          <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setStatus(""); setPage(1); }}>
            مسح الفلاتر
          </Button>
        )}
      </div>

      {/* ── Table ── */}
      {isLoading ? (
        <TableSkeleton rows={6} cols={6} />
      ) : orders.length === 0 ? (
        <EmptyState
          title="لا توجد طلبات"
          description="عند إنشاء طلب أو تحويل طلب عميل، سيظهر هنا."
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" className="h-7 w-7">
              <path d="M3 6h18l-2 13H5L3 6Z" />
            </svg>
          }
        />
      ) : (
        <>
          {/* Desktop */}
          <Surface className="hidden md:block overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-muted/40 text-xs">
                  <Th>العميل</Th>
                  <Th>الكتب</Th>
                  <Th>الإجمالي</Th>
                  <Th>الحالة</Th>
                  <Th>التاريخ</Th>
                  <Th className="text-left">إجراءات</Th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-b border-border/40 last:border-0 transition-colors hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <p className="font-semibold">{o.firstName} {o.lastName}</p>
                      <p className="text-xs text-muted-foreground">{o.phone} • {o.wilaya}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-muted-foreground">
                        {o.items.length} كتاب
                      </span>
                      {o.items[0] && (
                        <p className="max-w-[260px] truncate text-xs">{o.items[0].bookTitle}{o.items.length > 1 ? ` +${o.items.length - 1}` : ""}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 font-bold tabular-nums">
                      {Number(o.total).toLocaleString("ar-DZ", { maximumFractionDigits: 0 })} د.ج
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={o.status} label={LABEL[o.status]} />
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(o.createdAt).toLocaleDateString("ar-DZ", { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-4 py-3 text-left">
                      <Link
                        to={`/admin/orders/${o.id}`}
                        className="inline-flex h-8 items-center rounded-lg border border-border/60 px-3 text-xs font-medium transition-colors hover:bg-muted hover:border-primary/40 hover:text-primary"
                      >
                        عرض التفاصيل
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Surface>

          {/* Mobile */}
          <div className="grid gap-3 md:hidden">
            {orders.map((o) => (
              <Link key={o.id} to={`/admin/orders/${o.id}`} className="block">
                <Surface className="p-4 transition-all active:scale-[0.99]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold truncate">{o.firstName} {o.lastName}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{o.phone} • {o.wilaya}</p>
                    </div>
                    <StatusBadge status={o.status} label={LABEL[o.status]} />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{o.items.length} كتاب</span>
                    <span className="font-bold tabular-nums">{Number(o.total).toLocaleString("ar-DZ", { maximumFractionDigits: 0 })} د.ج</span>
                  </div>
                </Surface>
              </Link>
            ))}
          </div>

          <Pagination page={page} pageSize={25} total={data?.total ?? 0} onChange={setPage} />
        </>
      )}
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`px-4 py-3 text-right font-semibold text-muted-foreground ${className}`}>
      {children}
    </th>
  );
}

function MiniStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent: string;
}) {
  return (
    <div className={`rounded-xl border bg-card px-4 py-3 ${accent}`}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold tabular-nums">{value}</p>
    </div>
  );
}
