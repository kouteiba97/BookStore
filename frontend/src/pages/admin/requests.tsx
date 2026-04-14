import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchRequests, updateRequestStatus } from "@/lib/queries";
import type { OrderRequest, RequestStatus, RequestsResponse } from "@/lib/types";

// ── Status config ─────────────────────────────────────────

const STATUS: Record<RequestStatus, { label: string; classes: string; dot: string }> = {
  pending:   { label: "جديد",           classes: "bg-amber-50  text-amber-700  ring-amber-200",  dot: "bg-amber-400"  },
  contacted: { label: "تم التواصل",     classes: "bg-blue-50   text-blue-700   ring-blue-200",   dot: "bg-blue-400"   },
  done:      { label: "تم البيع",       classes: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500" },
};

const STATUS_ORDER: RequestStatus[] = ["pending", "contacted", "done"];

// ── Stat card ─────────────────────────────────────────────

function StatCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className={`rounded-xl border px-5 py-4 ${accent}`}>
      <p className="text-xs font-medium opacity-70">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}

// ── Status badge ──────────────────────────────────────────

function StatusBadge({ status }: { status: RequestStatus }) {
  const s = STATUS[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${s.classes}`}>
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

// ── Status select ─────────────────────────────────────────

function StatusSelect({ id, current, onChange }: {
  id: string;
  current: RequestStatus;
  onChange: (id: string, s: RequestStatus) => void;
}) {
  return (
    <select
      value={current}
      onChange={(e) => onChange(id, e.target.value as RequestStatus)}
      className="h-8 rounded-lg border border-input bg-background px-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-ring"
    >
      {STATUS_ORDER.map((s) => (
        <option key={s} value={s}>{STATUS[s].label}</option>
      ))}
    </select>
  );
}

// ── Row actions ───────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button
      onClick={copy}
      title="نسخ الهاتف"
      className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border/60 text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
    >
      {copied ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3.5 w-3.5 text-emerald-500">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
          <rect x="9" y="9" width="13" height="13" rx="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
    </button>
  );
}

function WhatsAppButton({ phone }: { phone: string }) {
  const clean = phone.replace(/\D/g, "");
  const number = clean.startsWith("0") ? `213${clean.slice(1)}` : clean;
  return (
    <a
      href={`https://wa.me/${number}`}
      target="_blank"
      rel="noopener noreferrer"
      title="واتساب"
      className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-600 transition-colors hover:bg-emerald-100"
    >
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
    </a>
  );
}

// ── Mobile card ───────────────────────────────────────────

function OrderCard({ req, onStatusChange, isNew }: {
  req: OrderRequest;
  onStatusChange: (id: string, s: RequestStatus) => void;
  isNew: boolean;
}) {
  return (
    <div className={`rounded-xl border bg-card p-4 shadow-sm ${isNew ? "border-amber-300 ring-1 ring-amber-200" : "border-border/60"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold text-foreground">{req.firstName} {req.lastName}</p>
          <p className="mt-0.5 text-sm text-primary font-semibold">{req.bookName}</p>
        </div>
        <StatusBadge status={req.status} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
        <span>📞 {req.phone}</span>
        <span>📍 {req.wilaya}</span>
        <span className="col-span-2 truncate">🏠 {req.address}</span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="text-[10px] text-muted-foreground/60">
          {new Date(req.createdAt).toLocaleDateString("ar-DZ", { day: "numeric", month: "short", year: "numeric" })}
        </p>
        <div className="flex items-center gap-2">
          <StatusSelect id={req.id} current={req.status} onChange={onStatusChange} />
          <WhatsAppButton phone={req.phone} />
          <CopyButton text={req.phone} />
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────

export default function AdminRequestsPage() {
  const qc = useQueryClient();

  const [statusFilter, setStatusFilter] = useState("");
  const [wilayaFilter, setWilayaFilter] = useState("");
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery<RequestsResponse>({
    queryKey: ["admin-requests", statusFilter, wilayaFilter, search],
    queryFn: () => fetchRequests({
      status: statusFilter || undefined,
      wilaya: wilayaFilter || undefined,
      search: search || undefined,
    }),
    refetchInterval: 30_000,
  });

  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      updateRequestStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-requests"] }),
  });

  const requests = data?.requests ?? [];
  const counts = data?.counts ?? [];

  const getCount = (s: RequestStatus) =>
    counts.find((c) => c.status === s)?._count ?? 0;

  const total = counts.reduce((acc, c) => acc + c._count, 0);

  // Unique wilayas from current full dataset (unfiltered) for the dropdown
  const wilayas = [...new Set(requests.map((r) => r.wilaya))].sort();

  const handleStatusChange = (id: string, status: RequestStatus) => {
    mutation.mutate({ id, status });
  };

  // Mark orders from last 24h as "new"
  const isNew = (req: OrderRequest) =>
    req.status === "pending" &&
    Date.now() - new Date(req.createdAt).getTime() < 86_400_000;

  return (
    <div className="min-h-screen bg-muted/30 pb-10" dir="rtl">

      {/* ── Header ── */}
      <div className="sticky top-0 z-30 border-b border-border/60 bg-background/95 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-foreground">إدارة الطلبات</h1>
              <p className="text-xs text-muted-foreground">مكتبة البيان — لوحة تحكم</p>
            </div>
            <button
              onClick={() => qc.invalidateQueries({ queryKey: ["admin-requests"] })}
              className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/60"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                <path d="M21 3v5h-5" />
                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                <path d="M8 16H3v5" />
              </svg>
              تحديث
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 space-y-6">

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="إجمالي الطلبات"  value={total}            accent="border-border/60 bg-card text-foreground" />
          <StatCard label="جديد"             value={getCount("pending")}   accent="border-amber-200  bg-amber-50  text-amber-800" />
          <StatCard label="تم التواصل"       value={getCount("contacted")} accent="border-blue-200   bg-blue-50   text-blue-800"  />
          <StatCard label="تم البيع"         value={getCount("done")}      accent="border-emerald-200 bg-emerald-50 text-emerald-800" />
        </div>

        {/* ── Filters ── */}
        <div className="flex flex-wrap gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث بالاسم أو الهاتف..."
              className="h-9 w-full rounded-lg border border-input bg-background py-2 pr-9 pl-3 text-sm outline-none placeholder:text-muted-foreground/50 focus:border-ring focus:ring-2 focus:ring-ring/20"
            />
          </div>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/20"
          >
            <option value="">كل الحالات</option>
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>{STATUS[s].label}</option>
            ))}
          </select>

          {/* Wilaya filter */}
          <select
            value={wilayaFilter}
            onChange={(e) => setWilayaFilter(e.target.value)}
            className="h-9 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/20"
          >
            <option value="">كل الولايات</option>
            {wilayas.map((w) => (
              <option key={w} value={w}>{w}</option>
            ))}
          </select>

          {(statusFilter || wilayaFilter || search) && (
            <button
              onClick={() => { setStatusFilter(""); setWilayaFilter(""); setSearch(""); }}
              className="h-9 rounded-lg border border-border/60 px-3 text-xs text-muted-foreground transition-colors hover:bg-muted/60"
            >
              مسح الفلاتر
            </button>
          )}
        </div>

        {/* ── Results count ── */}
        {!isLoading && (
          <p className="text-xs text-muted-foreground">
            {requests.length === 0 ? "لا توجد طلبات" : `${requests.length} طلب`}
          </p>
        )}

        {/* ── Desktop table ── */}
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-xl bg-muted/60" />
            ))}
          </div>
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-24 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/60">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-8 w-8 text-muted-foreground/40">
                <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
                <rect x="9" y="3" width="6" height="4" rx="1" />
              </svg>
            </div>
            <p className="font-semibold text-muted-foreground">لا توجد طلبات</p>
          </div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden md:block overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/40">
                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">الاسم الكامل</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">الكتاب</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">الهاتف</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">الولاية</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">العنوان</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">الحالة</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">التاريخ</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((req) => (
                    <tr
                      key={req.id}
                      className={`border-b border-border/40 transition-colors last:border-0 hover:bg-muted/30 ${
                        isNew(req) ? "bg-amber-50/60" : ""
                      }`}
                    >
                      <td className="px-4 py-3 font-medium">
                        <div className="flex items-center gap-2">
                          {isNew(req) && (
                            <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" title="طلب جديد" />
                          )}
                          {req.firstName} {req.lastName}
                        </div>
                      </td>
                      <td className="max-w-[160px] px-4 py-3">
                        <p className="truncate text-primary font-medium">{req.bookName}</p>
                      </td>
                      <td className="px-4 py-3 font-mono text-sm" dir="ltr">{req.phone}</td>
                      <td className="px-4 py-3 text-muted-foreground">{req.wilaya}</td>
                      <td className="max-w-[160px] px-4 py-3">
                        <p className="truncate text-xs text-muted-foreground" title={req.address}>{req.address}</p>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={req.status} />
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(req.createdAt).toLocaleDateString("ar-DZ", {
                          day: "numeric", month: "short", year: "numeric",
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <StatusSelect id={req.id} current={req.status} onChange={handleStatusChange} />
                          <WhatsAppButton phone={req.phone} />
                          <CopyButton text={req.phone} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="grid gap-3 md:hidden">
              {requests.map((req) => (
                <OrderCard
                  key={req.id}
                  req={req}
                  onStatusChange={handleStatusChange}
                  isNew={isNew(req)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
