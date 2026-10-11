import { useMemo, useState } from "react";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { CHANNEL_LABEL, downloadReport, fetchReport, money, ymd, type ReportOverview } from "@/lib/money-api";
import { Button, EmptyState, Surface, TableSkeleton, inputClass } from "@/components/admin/primitives";
import { useToast } from "@/components/admin/toaster";
import { FeatureGate } from "@/components/admin/plan-gate";

/** Validated (dataviz validator, light surface): income green, costs gold. */
const INCOME = "#2F7A4D";
const COSTS = "#C99A3A";

const MONTHS_AR = ["جانفي", "فيفري", "مارس", "أفريل", "ماي", "جوان", "جويلية", "أوت", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const monthLabel = (m: string) => `${MONTHS_AR[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;

type Preset = "month" | "lastMonth" | "quarter" | "year" | "custom";

function presetRange(p: Preset): [string, string] {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (p) {
    case "month":
      return [ymd(new Date(y, m, 1)), ymd(now)];
    case "lastMonth":
      return [ymd(new Date(y, m - 1, 1)), ymd(new Date(y, m, 0))];
    case "quarter":
      return [ymd(new Date(y, m - 2, 1)), ymd(now)];
    default:
      return [ymd(new Date(y, 0, 1)), ymd(now)];
  }
}

/** Income, cost of books sold, margin, expenses and profit — month by month. */
export default function ReportsPage() {
  return (
    <FeatureGate feature="reports">
      <Reports />
    </FeatureGate>
  );
}

function Reports() {
  const toast = useToast();
  const [preset, setPreset] = useState<Preset>("year");
  const [[from, to], setRange] = useState(presetRange("year"));
  const { data, isLoading, isError } = useQuery({
    queryKey: ["report", from, to],
    queryFn: () => fetchReport(from, to),
    placeholderData: keepPreviousData,
  });
  const exportXlsx = useMutation({ mutationFn: () => downloadReport(from, to), onError: () => toast.error("تعذّر التصدير") });

  const choose = (p: Preset) => {
    setPreset(p);
    if (p !== "custom") setRange(presetRange(p));
  };

  return (
    <div className="space-y-5">
      <Surface className="flex flex-wrap items-end gap-2 p-4">
        <div className="flex flex-wrap gap-1">
          {(
            [
              ["month", "هذا الشهر"],
              ["lastMonth", "الشهر الماضي"],
              ["quarter", "آخر 3 أشهر"],
              ["year", "هذه السنة"],
              ["custom", "فترة أخرى"],
            ] as const
          ).map(([k, l]) => (
            <button
              key={k}
              type="button"
              onClick={() => choose(k)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${preset === k ? "bg-primary text-primary-foreground ring-primary" : "bg-card ring-border hover:bg-muted"}`}
            >
              {l}
            </button>
          ))}
        </div>
        {preset === "custom" && (
          <>
            <input type="date" value={from} onChange={(e) => setRange([e.target.value, to])} className={`${inputClass} h-9 w-auto`} aria-label="من" />
            <input type="date" value={to} onChange={(e) => setRange([from, e.target.value])} className={`${inputClass} h-9 w-auto`} aria-label="إلى" />
          </>
        )}
        <Button size="sm" variant="secondary" className="ms-auto" onClick={() => exportXlsx.mutate()} disabled={exportXlsx.isPending}>
          {exportXlsx.isPending ? "جاري التجهيز..." : "تنزيل التقرير (Excel)"}
        </Button>
      </Surface>

      {isError ? (
        <EmptyState title="تعذّر تحميل التقرير" description="تحقق من الفترة المختارة." />
      ) : isLoading || !data ? (
        <TableSkeleton rows={6} cols={4} />
      ) : (
        <ReportBody r={data} />
      )}
    </div>
  );
}

function ReportBody({ r }: { r: ReportOverview }) {
  const k = r.kpis;
  return (
    <>
      {/* Headline numbers */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="رقم الأعمال" value={money(k.revenue)} hint={`${k.orders} عملية • ${k.booksSold} كتاب`} />
        <Kpi label="الهامش الإجمالي" value={money(k.grossMargin)} hint={`${k.grossMarginRate}% من المبيعات • تكلفة الكتب ${money(k.cogs)}`} />
        <Kpi label="المصاريف" value={money(k.expenses)} />
        <Kpi label="صافي الربح" value={money(k.netProfit)} tone={k.netProfit < 0 ? "bad" : "good"} hint="الهامش − المصاريف" />
      </div>
      {k.costCoverage < 100 && (
        <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-900">
          {k.costCoverage}% فقط من المبيعات لكتب معروفة سعر الشراء؛ تكلفة الباقي غير محسوبة فالهامش أعلى من الحقيقة. أضف «سعر
          الشراء» للكتب (من صفحة الكتب أو بالاستيراد أو بتسجيل المشتريات).
        </p>
      )}

      {/* Monthly chart + table */}
      <Surface className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-bold">المداخيل والتكاليف شهريًا</p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: INCOME }} />رقم الأعمال</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: COSTS }} />التكاليف (الكتب المباعة + المصاريف)</span>
          </div>
        </div>
        <MonthlyBars rows={r.monthly} />
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground">
              <tr className="border-b border-border/60">
                <th className="py-1.5 text-start font-semibold">الشهر</th>
                <th className="py-1.5 text-end font-semibold">رقم الأعمال</th>
                <th className="py-1.5 text-end font-semibold">تكلفة الكتب</th>
                <th className="py-1.5 text-end font-semibold">الهامش</th>
                <th className="py-1.5 text-end font-semibold">المصاريف</th>
                <th className="py-1.5 text-end font-semibold">صافي الربح</th>
                <th className="py-1.5 text-end font-semibold">المشتريات</th>
              </tr>
            </thead>
            <tbody>
              {r.monthly.map((m) => (
                <tr key={m.month} className="border-b border-border/30 last:border-0">
                  <td className="py-1.5">{monthLabel(m.month)}</td>
                  <td className="py-1.5 text-end tabular-nums">{money(m.revenue)}</td>
                  <td className="py-1.5 text-end tabular-nums">{money(m.cogs)}</td>
                  <td className="py-1.5 text-end tabular-nums">{money(m.grossMargin)}</td>
                  <td className="py-1.5 text-end tabular-nums">{money(m.expenses)}</td>
                  <td className={`py-1.5 text-end font-semibold tabular-nums ${m.netProfit < 0 ? "text-rose-700" : ""}`}>{money(m.netProfit)}</td>
                  <td className="py-1.5 text-end tabular-nums text-muted-foreground">{money(m.purchases)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Surface>

      <div className="grid gap-4 lg:grid-cols-2">
        <Surface className="space-y-2 p-4">
          <p className="text-sm font-bold">حسب القناة</p>
          {r.channels.length === 0 ? <p className="text-xs text-muted-foreground">لا مبيعات.</p> : <ShareList items={r.channels.map((c) => ({ label: CHANNEL_LABEL[c.channel] ?? c.channel, value: c.revenue, note: `${c.orders} عملية` }))} />}
        </Surface>
        <Surface className="space-y-2 p-4">
          <p className="text-sm font-bold">المصاريف حسب البند</p>
          {r.expensesByCategory.length === 0 ? <p className="text-xs text-muted-foreground">لا مصاريف مسجّلة.</p> : <ShareList items={r.expensesByCategory.map((e) => ({ label: e.label, value: e.amount }))} />}
        </Surface>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Surface className="p-4">
          <p className="mb-2 text-sm font-bold">الأكثر مبيعًا</p>
          {r.topBooks.length === 0 ? (
            <p className="text-xs text-muted-foreground">لا مبيعات في هذه الفترة.</p>
          ) : (
            <table className="w-full text-xs">
              <thead className="text-muted-foreground"><tr className="border-b border-border/60"><th className="py-1 text-start">الكتاب</th><th className="py-1 text-end">الكمية</th><th className="py-1 text-end">المبيعات</th><th className="py-1 text-end">الهامش</th></tr></thead>
              <tbody>
                {r.topBooks.slice(0, 10).map((b) => (
                  <tr key={b.bookId} className="border-b border-border/30 last:border-0">
                    <td className="max-w-[14rem] truncate py-1.5">{b.title}</td>
                    <td className="py-1.5 text-end tabular-nums">{b.quantity}</td>
                    <td className="py-1.5 text-end tabular-nums">{money(b.revenue)}</td>
                    <td className="py-1.5 text-end tabular-nums text-muted-foreground">{b.margin === null ? "—" : money(b.margin)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Surface>
        <Surface className="p-4">
          <p className="mb-1 text-sm font-bold">مخزون راكد</p>
          <p className="mb-2 text-xs text-muted-foreground">كتب في المخزون لم يُبع منها شيء منذ {r.slowDays} يومًا — مرشحة للتخفيض أو الإشهار.</p>
          {r.slowStock.length === 0 ? (
            <p className="text-xs text-muted-foreground">لا يوجد ✓</p>
          ) : (
            <table className="w-full text-xs">
              <thead className="text-muted-foreground"><tr className="border-b border-border/60"><th className="py-1 text-start">الكتاب</th><th className="py-1 text-end">المخزون</th><th className="py-1 text-end">القيمة</th><th className="py-1 text-end">آخر بيع</th></tr></thead>
              <tbody>
                {r.slowStock.slice(0, 10).map((b) => (
                  <tr key={b.bookId} className="border-b border-border/30 last:border-0">
                    <td className="max-w-[14rem] truncate py-1.5">{b.title}</td>
                    <td className="py-1.5 text-end tabular-nums">{b.stock}</td>
                    <td className="py-1.5 text-end tabular-nums">{money(b.value)}</td>
                    <td className="py-1.5 text-end text-muted-foreground">{b.lastSale ?? "أبدًا"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Surface>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="قيمة المخزون (بسعر الشراء)" value={money(r.stock.valueAtCost)} hint={`${r.stock.units} نسخة • ${r.stock.titles} عنوان`} />
        <Kpi label="قيمة المخزون (بسعر البيع)" value={money(r.stock.valueAtPrice)} />
        <Kpi label="المشتريات في الفترة" value={money(k.purchases)} />
        <Kpi label="المستحق للموردين" value={money(k.owedToSuppliers)} tone={k.owedToSuppliers > 0 ? "warn" : undefined} />
      </div>
    </>
  );
}

function Kpi({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "good" | "bad" | "warn" }) {
  const color = tone === "bad" ? "text-rose-700" : tone === "warn" ? "text-amber-700" : tone === "good" ? "text-emerald-700" : "";
  return (
    <Surface className="p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-xl font-bold tabular-nums ${color}`}>{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
    </Surface>
  );
}

/** Share of a total as thin bars with the value in text ink beside them. */
function ShareList({ items }: { items: { label: string; value: number; note?: string }[] }) {
  const total = items.reduce((s, i) => s + i.value, 0) || 1;
  return (
    <ul className="space-y-2">
      {[...items].sort((a, b) => b.value - a.value).map((i) => (
        <li key={i.label}>
          <div className="flex justify-between text-xs">
            <span>{i.label}{i.note && <span className="ms-1 text-muted-foreground">({i.note})</span>}</span>
            <span className="tabular-nums">{money(i.value)} • {Math.round((i.value / total) * 100)}%</span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-muted">
            <div className="h-1.5 rounded-full bg-primary/70" style={{ width: `${Math.max(2, (i.value / total) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Grouped bars per month (one axis, dinars): income vs costs, with hover. */
function MonthlyBars({ rows }: { rows: ReportOverview["monthly"] }) {
  const [hover, setHover] = useState<number | null>(null);
  const data = useMemo(() => rows.map((m) => ({ ...m, costs: m.cogs + m.expenses })), [rows]);
  const max = Math.max(1, ...data.map((d) => Math.max(d.revenue, d.costs)));
  const W = 640;
  const H = 200;
  const pad = { t: 10, b: 24, x: 8 };
  const innerH = H - pad.t - pad.b;
  const slot = (W - pad.x * 2) / Math.max(1, data.length);
  const bw = Math.min(22, slot / 3);
  // Right-to-left reading: the first month sits on the right.
  const xOf = (i: number) => W - pad.x - slot * (i + 0.5);
  const y = (v: number) => pad.t + innerH - (v / max) * innerH;

  if (!data.some((d) => d.revenue || d.costs)) {
    return <p className="py-10 text-center text-xs text-muted-foreground">لا توجد حركة مالية في هذه الفترة.</p>;
  }

  const hd = hover !== null ? data[hover] : null;
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-52 w-full" role="img" aria-label="رقم الأعمال والتكاليف لكل شهر">
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line key={f} x1={pad.x} x2={W - pad.x} y1={y(max * f)} y2={y(max * f)} stroke="currentColor" className="text-border" strokeWidth={1} strokeDasharray="2 4" />
        ))}
        <line x1={pad.x} x2={W - pad.x} y1={y(0)} y2={y(0)} stroke="currentColor" className="text-border" strokeWidth={1} />
        {data.map((d, i) => {
          const cx = xOf(i);
          return (
            <g key={d.month}>
              <Bar x={cx + 1} w={bw} y0={y(0)} y1={y(d.revenue)} color={INCOME} />
              <Bar x={cx - bw - 1} w={bw} y0={y(0)} y1={y(d.costs)} color={COSTS} />
              <text x={cx} y={H - 6} textAnchor="middle" className="fill-muted-foreground text-[10px]">
                {MONTHS_AR[Number(d.month.slice(5, 7)) - 1]}
              </text>
              {/* Hit target wider than the marks */}
              <rect x={cx - slot / 2} y={pad.t} width={slot} height={innerH} fill="transparent" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
            </g>
          );
        })}
      </svg>
      {hd && (
        <div className="pointer-events-none absolute top-1 left-1 rounded-lg border border-border/70 bg-card px-3 py-2 text-xs shadow-warm">
          <p className="mb-1 font-bold">{monthLabel(hd.month)}</p>
          <p className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: INCOME }} />رقم الأعمال: {money(hd.revenue)}</p>
          <p className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: COSTS }} />التكاليف: {money(hd.costs)}</p>
          <p className={`mt-1 font-semibold ${hd.netProfit < 0 ? "text-rose-700" : "text-emerald-700"}`}>صافي الربح: {money(hd.netProfit)}</p>
        </div>
      )}
    </div>
  );
}

/** A bar anchored to the baseline with a 4px rounded top. */
function Bar({ x, w, y0, y1, color }: { x: number; w: number; y0: number; y1: number; color: string }) {
  const h = Math.max(0, y0 - y1);
  if (h < 0.5) return null;
  const r = Math.min(4, h, w / 2);
  const d = `M${x},${y0} V${y1 + r} Q${x},${y1} ${x + r},${y1} H${x + w - r} Q${x + w},${y1} ${x + w},${y1 + r} V${y0} Z`;
  return <path d={d} fill={color} />;
}
