import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchRequests, updateRequestStatus } from "@/lib/queries";
import { convertRequestToOrder, fetchAdminBook } from "@/lib/admin-api";
import type { OrderRequest, RequestStatus, RequestsResponse } from "@/lib/types";
import {
  Button,
  EmptyState,
  Field,
  Modal,
  StatusBadge,
  Surface,
  TableSkeleton,
  inputClass,
  selectClass,
  textareaClass,
} from "@/components/admin/primitives";
import { useToast } from "@/components/admin/toaster";

const STATUS_LABEL: Record<RequestStatus, string> = {
  pending: "جديد",
  contacted: "تم التواصل",
  done: "تم البيع",
};
const STATUS_ORDER: RequestStatus[] = ["pending", "contacted", "done"];

export default function AdminRequestsPage() {
  const qc = useQueryClient();
  const toast = useToast();

  const [statusFilter, setStatusFilter] = useState("");
  const [wilayaFilter, setWilayaFilter] = useState("");
  const [search, setSearch] = useState("");

  const [convertTarget, setConvertTarget] = useState<OrderRequest | null>(null);

  const { data, isLoading } = useQuery<RequestsResponse>({
    queryKey: ["admin-requests", statusFilter, wilayaFilter, search],
    queryFn: () =>
      fetchRequests({
        status: statusFilter || undefined,
        wilaya: wilayaFilter || undefined,
        search: search || undefined,
      }),
    refetchInterval: 30_000,
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      updateRequestStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-requests"] });
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message || "تعذّر التحديث"),
  });

  const requests = data?.requests ?? [];
  const counts = data?.counts ?? [];

  const getCount = (s: RequestStatus) =>
    counts.find((c) => c.status === s)?._count ?? 0;
  const total = counts.reduce((acc, c) => acc + c._count, 0);

  const wilayas = useMemo(
    () => [...new Set(requests.map((r) => r.wilaya))].sort(),
    [requests],
  );

  const isNew = (req: OrderRequest) =>
    req.status === "pending" &&
    Date.now() - new Date(req.createdAt).getTime() < 86_400_000;

  return (
    <div className="space-y-5">
      {/* ── Stats ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniStat label="الإجمالي" value={total} accent="border-border/60" />
        <MiniStat label="جديد" value={getCount("pending")} accent="border-amber-200 bg-amber-50/40" />
        <MiniStat label="تم التواصل" value={getCount("contacted")} accent="border-blue-200 bg-blue-50/40" />
        <MiniStat label="تم البيع" value={getCount("done")} accent="border-emerald-200 bg-emerald-50/40" />
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[200px] flex-1">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث بالاسم أو الهاتف..."
            className={`${inputClass} pr-9`}
          />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={`${selectClass} h-10 w-auto`}>
          <option value="">كل الحالات</option>
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
        </select>
        <select value={wilayaFilter} onChange={(e) => setWilayaFilter(e.target.value)} className={`${selectClass} h-10 w-auto`}>
          <option value="">كل الولايات</option>
          {wilayas.map((w) => <option key={w} value={w}>{w}</option>)}
        </select>
        {(statusFilter || wilayaFilter || search) && (
          <Button variant="ghost" size="sm" onClick={() => { setStatusFilter(""); setWilayaFilter(""); setSearch(""); }}>
            مسح الفلاتر
          </Button>
        )}
      </div>

      {/* ── Table ── */}
      {isLoading ? (
        <TableSkeleton rows={6} cols={6} />
      ) : requests.length === 0 ? (
        <EmptyState
          title="لا توجد طلبات"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-7 w-7">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />
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
                  <Th>الكتاب</Th>
                  <Th>الهاتف</Th>
                  <Th>الولاية</Th>
                  <Th>الحالة</Th>
                  <Th>التاريخ</Th>
                  <Th className="text-left">إجراءات</Th>
                </tr>
              </thead>
              <tbody>
                {requests.map((req) => (
                  <tr key={req.id} className={`border-b border-border/40 last:border-0 transition-colors hover:bg-muted/30 ${isNew(req) ? "bg-amber-50/60" : ""}`}>
                    <td className="px-4 py-3 font-medium">
                      <div className="flex items-center gap-2">
                        {isNew(req) && <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" />}
                        {req.firstName} {req.lastName}
                      </div>
                      <p className="text-xs text-muted-foreground truncate max-w-[200px]">{req.address}</p>
                    </td>
                    <td className="px-4 py-3 max-w-[180px]">
                      <p className="truncate text-primary font-medium">{req.bookName}</p>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs" dir="ltr">{req.phone}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{req.wilaya}</td>
                    <td className="px-4 py-3">
                      <select
                        value={req.status}
                        onChange={(e) => statusMutation.mutate({ id: req.id, status: e.target.value })}
                        className="h-8 rounded-lg border border-input bg-background px-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-ring/30"
                      >
                        {STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(req.createdAt).toLocaleDateString("ar-DZ", { day: "numeric", month: "short" })}
                    </td>
                    <td className="px-4 py-3 text-left">
                      <div className="flex items-center justify-end gap-1">
                        <a
                          href={`https://wa.me/${cleanPhone(req.phone)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="واتساب"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-600 transition-colors hover:bg-emerald-100"
                        >
                          <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347" />
                          </svg>
                        </a>
                        <Button size="sm" variant="secondary" onClick={() => setConvertTarget(req)} disabled={req.status === "done"}>
                          {req.status === "done" ? "تم التحويل" : "تحويل لطلب"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Surface>

          {/* Mobile */}
          <div className="grid gap-3 md:hidden">
            {requests.map((req) => (
              <Surface key={req.id} className={`p-4 ${isNew(req) ? "ring-1 ring-amber-200 border-amber-300" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold">{req.firstName} {req.lastName}</p>
                    <p className="mt-0.5 text-sm font-semibold text-primary">{req.bookName}</p>
                  </div>
                  <StatusBadge status={req.status} label={STATUS_LABEL[req.status]} />
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <span dir="ltr">📞 {req.phone}</span>
                  <span>📍 {req.wilaya}</span>
                  <span className="col-span-2 truncate">🏠 {req.address}</span>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <select
                    value={req.status}
                    onChange={(e) => statusMutation.mutate({ id: req.id, status: e.target.value })}
                    className="h-8 rounded-lg border border-input bg-background px-2 text-xs font-medium"
                  >
                    {STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                  </select>
                  <Button size="sm" variant="secondary" onClick={() => setConvertTarget(req)} disabled={req.status === "done"}>
                    {req.status === "done" ? "تم التحويل" : "تحويل لطلب"}
                  </Button>
                </div>
              </Surface>
            ))}
          </div>
        </>
      )}

      <ConvertModal
        request={convertTarget}
        onClose={() => setConvertTarget(null)}
        onSaved={() => {
          setConvertTarget(null);
          qc.invalidateQueries({ queryKey: ["admin-requests"] });
          qc.invalidateQueries({ queryKey: ["admin-orders"] });
          qc.invalidateQueries({ queryKey: ["admin-stats"] });
        }}
      />
    </div>
  );
}

// ── Convert-to-order modal ────────────────────────────────

function ConvertModal({
  request,
  onClose,
  onSaved,
}: {
  request: OrderRequest | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [unitPrice, setUnitPrice] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [shipping, setShipping] = useState("");
  const [notes, setNotes] = useState("");

  // Prefill price from book if linked
  useEffect(() => {
    if (!request?.bookId) {
      setUnitPrice("");
      setQuantity("1");
      setShipping("");
      setNotes("");
      return;
    }
    fetchAdminBook(request.bookId)
      .then((b: any) => {
        setUnitPrice(b?.price ? String(b.price) : "");
        setQuantity("1");
        setShipping("");
        setNotes("");
      })
      .catch(() => {
        setUnitPrice("");
      });
  }, [request?.id]);

  const mutation = useMutation({
    mutationFn: () => {
      if (!request) throw new Error("no request");
      return convertRequestToOrder(request.id, {
        items: [
          {
            bookId: request.bookId ?? "",
            quantity: Number(quantity || 1),
            unitPrice: Number(unitPrice || 0),
          },
        ],
        shippingCost: shipping ? Number(shipping) : 0,
        notes: notes || undefined,
      });
    },
    onSuccess: () => {
      toast.success("تم تحويل الطلب");
      onSaved();
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message || "تعذّر التحويل"),
  });

  if (!request) return null;

  const subtotal = Number(unitPrice || 0) * Number(quantity || 1);
  const total = subtotal + Number(shipping || 0);
  const canSubmit = Boolean(request.bookId) && Number(quantity) > 0;

  return (
    <Modal open={Boolean(request)} onClose={onClose} title="تحويل إلى طلب" size="md">
      <div className="space-y-4">
        <Surface className="bg-muted/30 p-3 text-xs">
          <p><span className="font-bold">العميل: </span>{request.firstName} {request.lastName}</p>
          <p className="mt-0.5"><span className="font-bold">الهاتف: </span><span dir="ltr">{request.phone}</span></p>
          <p className="mt-0.5"><span className="font-bold">الكتاب: </span>{request.bookName}</p>
          {!request.bookId && (
            <p className="mt-2 rounded bg-amber-50 px-2 py-1 text-amber-800">
              ⚠ هذا الطلب غير مرتبط بكتاب من الكتالوج. يجب ربطه أولًا أو إنشاء الطلب يدويًا.
            </p>
          )}
        </Surface>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="السعر للوحدة (د.ج)" required>
            <input type="number" min={0} step="0.01" className={inputClass} value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} />
          </Field>
          <Field label="الكمية" required>
            <input type="number" min={1} className={inputClass} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </Field>
          <Field label="الشحن (د.ج)">
            <input type="number" min={0} step="0.01" className={inputClass} value={shipping} onChange={(e) => setShipping(e.target.value)} />
          </Field>
        </div>

        <Field label="ملاحظات">
          <textarea className={textareaClass} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>

        <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span>المجموع</span>
            <span className="tabular-nums">{subtotal.toLocaleString("ar-DZ")} د.ج</span>
          </div>
          <div className="flex items-center justify-between border-t border-border/40 pt-2 mt-1 font-bold">
            <span>الإجمالي</span>
            <span className="tabular-nums">{total.toLocaleString("ar-DZ")} د.ج</span>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-border/60 pt-3">
          <Button variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button onClick={() => mutation.mutate()} disabled={!canSubmit || mutation.isPending}>
            {mutation.isPending ? "جاري..." : "إنشاء الطلب"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Helpers ───────────────────────────────────────────────

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`px-4 py-3 text-right font-semibold text-muted-foreground ${className}`}>
      {children}
    </th>
  );
}

function MiniStat({ label, value, accent }: { label: string; value: number | string; accent: string }) {
  return (
    <div className={`rounded-xl border bg-card px-4 py-3 ${accent}`}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold tabular-nums">{value}</p>
    </div>
  );
}

function cleanPhone(phone: string) {
  const c = phone.replace(/\D/g, "");
  return c.startsWith("0") ? `213${c.slice(1)}` : c;
}
