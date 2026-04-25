import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchStats } from "@/lib/admin-api";
import type { StatsOverview } from "@/lib/admin-types";
import {
  Skeleton,
  StatusBadge,
  Surface,
} from "@/components/admin/primitives";
import { AreaChart } from "@/components/admin/charts";

const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: "قيد الانتظار",
  confirmed: "مؤكدة",
  shipped: "قيد الشحن",
  delivered: "مسلَّمة",
  cancelled: "ملغاة",
};
const REQUEST_STATUS_LABELS: Record<string, string> = {
  pending: "جديد",
  contacted: "تم التواصل",
  done: "تم البيع",
};

const RANGES = [
  { days: 7, label: "٧ أيام" },
  { days: 30, label: "٣٠ يوم" },
  { days: 90, label: "٩٠ يوم" },
];

export default function OverviewPage() {
  const [days, setDays] = useState(30);

  const { data, isLoading } = useQuery<StatsOverview>({
    queryKey: ["admin-stats", days],
    queryFn: () => fetchStats(days),
    refetchInterval: 60_000,
  });

  return (
    <div className="space-y-6">
      {/* ── Range selector ── */}
      <div className="flex items-center justify-end">
        <div className="inline-flex rounded-lg border border-border/60 bg-card p-0.5">
          {RANGES.map((r) => (
            <button
              key={r.days}
              onClick={() => setDays(r.days)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                days === r.days
                  ? "bg-primary text-primary-foreground shadow-warm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          label="إجمالي الإيرادات"
          value={isLoading ? null : formatMoney(data?.kpis.totalRevenue ?? 0)}
          tone="primary"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5">
              <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          }
        />
        <KpiCard
          label="إجمالي الطلبات"
          value={isLoading ? null : (data?.kpis.totalOrders ?? 0).toLocaleString("ar-DZ")}
          tone="blue"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5">
              <path d="M3 6h18l-2 13H5L3 6Z" />
            </svg>
          }
        />
        <KpiCard
          label="عدد الكتب"
          value={isLoading ? null : (data?.kpis.booksCount ?? 0).toLocaleString("ar-DZ")}
          tone="amber"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
            </svg>
          }
        />
        <KpiCard
          label="نسبة التحويل"
          value={isLoading ? null : `${(data?.kpis.conversionRate ?? 0).toFixed(1)}%`}
          hint={`من ${data?.kpis.totalRequests ?? 0} طلب عميل`}
          tone="emerald"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5">
              <path d="M3 17 9 11l4 4 8-8" /><path d="M14 7h7v7" />
            </svg>
          }
        />
      </div>

      {/* ── Charts row ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="الإيرادات اليومية" subtitle={`آخر ${days} يومًا`}>
          {isLoading ? (
            <Skeleton className="h-[180px]" />
          ) : (
            <AreaChart
              data={data?.dailyOrders ?? []}
              format={(v) => formatMoney(v)}
            />
          )}
        </ChartCard>

        <ChartCard title="طلبات العملاء" subtitle={`آخر ${days} يومًا`}>
          {isLoading ? (
            <Skeleton className="h-[180px]" />
          ) : (
            <AreaChart
              data={data?.dailyRequests ?? []}
              color="oklch(0.72 0.11 75)"
            />
          )}
        </ChartCard>
      </div>

      {/* ── Status grids ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Surface className="p-5">
          <h3 className="mb-3 text-sm font-bold">حالة الطلبات</h3>
          <div className="space-y-2">
            {(data?.ordersByStatus ?? []).map((s) => (
              <div key={s.status} className="flex items-center justify-between">
                <StatusBadge status={s.status} label={ORDER_STATUS_LABELS[s.status] ?? s.status} />
                <span className="text-sm font-bold tabular-nums">{s._count}</span>
              </div>
            ))}
            {!isLoading && (data?.ordersByStatus.length ?? 0) === 0 && (
              <p className="text-xs text-muted-foreground">لا توجد طلبات بعد.</p>
            )}
          </div>
        </Surface>

        <Surface className="p-5">
          <h3 className="mb-3 text-sm font-bold">حالة طلبات العملاء</h3>
          <div className="space-y-2">
            {(data?.requestsByStatus ?? []).map((s) => (
              <div key={s.status} className="flex items-center justify-between">
                <StatusBadge status={s.status} label={REQUEST_STATUS_LABELS[s.status] ?? s.status} />
                <span className="text-sm font-bold tabular-nums">{s._count}</span>
              </div>
            ))}
            {!isLoading && (data?.requestsByStatus.length ?? 0) === 0 && (
              <p className="text-xs text-muted-foreground">لا توجد طلبات عملاء بعد.</p>
            )}
          </div>
        </Surface>
      </div>

      {/* ── Activity ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Surface className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-border/60 px-5 py-3">
            <h3 className="text-sm font-bold">أحدث الطلبات</h3>
            <Link to="/admin/orders" className="text-xs font-medium text-primary hover:underline">
              عرض الكل
            </Link>
          </div>
          {isLoading ? (
            <div className="space-y-2 p-4">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10" />)}
            </div>
          ) : (data?.recentOrders.length ?? 0) === 0 ? (
            <p className="px-5 py-8 text-center text-xs text-muted-foreground">لا توجد طلبات بعد.</p>
          ) : (
            <ul className="divide-y divide-border/40">
              {data!.recentOrders.map((o) => (
                <li key={o.id} className="px-5 py-3 transition-colors hover:bg-muted/30">
                  <Link to={`/admin/orders/${o.id}`} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {o.firstName} {o.lastName}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {new Date(o.createdAt).toLocaleDateString("ar-DZ", { day: "numeric", month: "short" })}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge status={o.status} label={ORDER_STATUS_LABELS[o.status] ?? o.status} />
                      <span className="text-sm font-bold tabular-nums">{formatMoney(Number(o.total))}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Surface>

        <Surface className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-border/60 px-5 py-3">
            <h3 className="text-sm font-bold">الكتب الأكثر طلبًا</h3>
          </div>
          {isLoading ? (
            <div className="space-y-2 p-4">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10" />)}
            </div>
          ) : (data?.topBooks.length ?? 0) === 0 ? (
            <p className="px-5 py-8 text-center text-xs text-muted-foreground">لا توجد بيانات بعد.</p>
          ) : (
            <ul className="divide-y divide-border/40">
              {data!.topBooks.map((b, i) => (
                <li key={b.bookId} className="flex items-center gap-3 px-5 py-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                    {i + 1}
                  </span>
                  <p className="flex-1 truncate text-sm font-medium">{b.title}</p>
                  <span className="text-xs font-semibold text-muted-foreground">
                    {b.quantity} نسخة
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Surface>
      </div>

      {/* ── Low stock callout ── */}
      {!isLoading && data && data.kpis.lowStockCount > 0 && (
        <Surface className="border-amber-200 bg-amber-50/50 p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
                <path d="M12 9v4M12 17v0" />
              </svg>
            </span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-900">
                {data.kpis.lowStockCount} كتاب بحاجة لإعادة التزويد
              </p>
              <p className="text-xs text-amber-800/70">المخزون منخفض أو بحالة "نادر".</p>
            </div>
            <Link
              to="/admin/inventory?lowStock=true"
              className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-100"
            >
              عرض المخزون
            </Link>
          </div>
        </Surface>
      )}
    </div>
  );
}

// ── KPI card ──────────────────────────────────────────────

const TONES = {
  primary: "bg-primary/10 text-primary",
  blue: "bg-blue-50 text-blue-600",
  amber: "bg-amber-50 text-amber-600",
  emerald: "bg-emerald-50 text-emerald-600",
};

function KpiCard({
  label,
  value,
  hint,
  icon,
  tone,
}: {
  label: string;
  value: string | null;
  hint?: string;
  icon?: React.ReactNode;
  tone: keyof typeof TONES;
}) {
  return (
    <Surface className="p-4 transition-all hover:-translate-y-0.5 hover:shadow-warm-lg">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          {value === null ? (
            <Skeleton className="mt-1.5 h-7 w-20" />
          ) : (
            <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
          )}
          {hint && <p className="mt-0.5 text-[10px] text-muted-foreground">{hint}</p>}
        </div>
        {icon && (
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${TONES[tone]}`}>
            {icon}
          </span>
        )}
      </div>
    </Surface>
  );
}

// ── Chart card ────────────────────────────────────────────

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <Surface className="p-5">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-sm font-bold">{title}</h3>
        {subtitle && <span className="text-[11px] text-muted-foreground">{subtitle}</span>}
      </div>
      {children}
    </Surface>
  );
}

function formatMoney(n: number) {
  return `${n.toLocaleString("ar-DZ", { maximumFractionDigits: 0 })} د.ج`;
}
