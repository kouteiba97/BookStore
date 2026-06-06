import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  cancelOrder,
  fetchAdminBooks,
  fetchOrder,
  updateOrder,
  updateOrderStatus,
} from "@/lib/admin-api";
import type { AdminBook, AdminOrder, OrderStatus } from "@/lib/admin-types";
import {
  Button,
  ConfirmDialog,
  Field,
  Modal,
  Skeleton,
  StatusBadge,
  Surface,
  inputClass,
  textareaClass,
} from "@/components/admin/primitives";
import { useToast } from "@/components/admin/toaster";

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "قيد الانتظار",
  confirmed: "مؤكدة",
  shipped: "قيد الشحن",
  delivered: "مسلَّمة",
  cancelled: "ملغاة",
};

const STATUS_FLOW: OrderStatus[] = ["pending", "confirmed", "shipped", "delivered"];

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["shipped", "cancelled"],
  shipped: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
};

interface DraftItem {
  bookId: string;
  bookTitle: string;
  unitPrice: number;
  quantity: number;
}

export default function OrderDetailPage() {
  const { id } = useParams();
  const qc = useQueryClient();
  const toast = useToast();

  const { data: order, isLoading } = useQuery<AdminOrder>({
    queryKey: ["admin-order", id],
    queryFn: () => fetchOrder(id!),
    enabled: Boolean(id),
  });

  const [editOpen, setEditOpen] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const statusMutation = useMutation({
    mutationFn: (status: OrderStatus) => updateOrderStatus(id!, status),
    onSuccess: () => {
      toast.success("تم تحديث حالة الطلب");
      qc.invalidateQueries({ queryKey: ["admin-order", id] });
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.message || "تعذّر التحديث"),
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelOrder(id!),
    onSuccess: () => {
      toast.success("تم إلغاء الطلب");
      qc.invalidateQueries({ queryKey: ["admin-order", id] });
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.message || "تعذّر الإلغاء"),
  });

  if (isLoading || !order) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  const allowedNext = TRANSITIONS[order.status];
  const isLocked = order.status === "delivered" || order.status === "cancelled";

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/admin/orders" className="text-xs text-muted-foreground hover:text-foreground">
            ← الرجوع للطلبات
          </Link>
          <div className="mt-1 flex items-center gap-3">
            <h2 className="font-mono text-sm text-muted-foreground" dir="ltr">
              #{order.id.slice(0, 8)}
            </h2>
            <StatusBadge status={order.status} label={STATUS_LABEL[order.status]} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            أُنشئ في {new Date(order.createdAt).toLocaleString("ar-DZ")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!isLocked && (
            <>
              <Button variant="secondary" onClick={() => setEditOpen(true)}>
                تعديل الطلب
              </Button>
              <Button variant="danger" onClick={() => setConfirmCancel(true)} disabled={cancelMutation.isPending}>
                إلغاء الطلب
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ── Status pipeline ── */}
      {order.status !== "cancelled" && (
        <Surface className="p-5">
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            مسار الطلب
          </h3>
          <ol className="flex items-center justify-between gap-2">
            {STATUS_FLOW.map((s, idx) => {
              const currentIdx = STATUS_FLOW.indexOf(order.status as OrderStatus);
              const reached = idx <= currentIdx;
              const isCurrent = s === order.status;
              return (
                <li key={s} className="flex flex-1 items-center gap-2">
                  <div className="flex flex-col items-center gap-1.5">
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold transition-all ${
                        reached
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      } ${isCurrent ? "ring-4 ring-primary/20" : ""}`}
                    >
                      {idx + 1}
                    </span>
                    <span className={`text-[10px] font-medium ${isCurrent ? "text-primary" : reached ? "text-foreground" : "text-muted-foreground"}`}>
                      {STATUS_LABEL[s]}
                    </span>
                  </div>
                  {idx < STATUS_FLOW.length - 1 && (
                    <span className={`h-0.5 flex-1 rounded transition-colors ${idx < currentIdx ? "bg-primary" : "bg-border"}`} />
                  )}
                </li>
              );
            })}
          </ol>

          {allowedNext.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2 border-t border-border/40 pt-4">
              <span className="self-center text-xs font-medium text-muted-foreground">الانتقال إلى:</span>
              {allowedNext.map((next) => (
                <Button
                  key={next}
                  size="sm"
                  variant={next === "cancelled" ? "danger" : "primary"}
                  onClick={() => {
                    if (next === "cancelled") setConfirmCancel(true);
                    else statusMutation.mutate(next);
                  }}
                  disabled={statusMutation.isPending}
                >
                  {STATUS_LABEL[next]}
                </Button>
              ))}
            </div>
          )}
        </Surface>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* ── Items ── */}
        <Surface className="lg:col-span-2 overflow-hidden">
          <div className="border-b border-border/60 px-5 py-3">
            <h3 className="text-sm font-bold">الكتب المطلوبة</h3>
          </div>
          <ul className="divide-y divide-border/40">
            {order.items.map((it) => (
              <li key={it.id} className="flex items-center gap-3 px-5 py-3">
                <div className="h-12 w-9 shrink-0 overflow-hidden rounded bg-muted">
                  {it.book?.imageUrl && (
                    <img src={it.book.imageUrl} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{it.bookTitle}</p>
                  <p className="text-xs text-muted-foreground">
                    {Number(it.unitPrice).toLocaleString("ar-DZ")} د.ج × {it.quantity}
                  </p>
                </div>
                <p className="text-sm font-bold tabular-nums">
                  {(Number(it.unitPrice) * it.quantity).toLocaleString("ar-DZ", { maximumFractionDigits: 0 })} د.ج
                </p>
              </li>
            ))}
          </ul>

          <div className="border-t border-border/60 px-5 py-3 text-sm">
            <Row label="المجموع" value={Number(order.subtotal)} />
            <Row label="الشحن" value={Number(order.shippingCost)} />
            <Row label="الإجمالي" value={Number(order.total)} bold />
          </div>
        </Surface>

        {/* ── Customer ── */}
        <Surface className="overflow-hidden">
          <div className="border-b border-border/60 px-5 py-3">
            <h3 className="text-sm font-bold">العميل</h3>
          </div>
          <div className="space-y-3 px-5 py-4 text-sm">
            <Info label="الاسم" value={`${order.firstName} ${order.lastName}`} />
            <Info label="الهاتف" value={order.phone} mono />
            <Info label="الولاية" value={order.wilaya} />
            <Info label="العنوان" value={order.address} />
            {order.notes && <Info label="ملاحظات" value={order.notes} />}
            {order.request && (
              <p className="text-[11px] text-muted-foreground">
                ↳ تم تحويله من <Link to="/admin/requests" className="text-primary hover:underline">طلب عميل</Link>
              </p>
            )}
          </div>
          <div className="border-t border-border/40 px-5 py-3">
            <a
              href={`https://wa.me/${cleanPhone(order.phone)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347" />
              </svg>
              تواصل عبر واتساب
            </a>
          </div>
        </Surface>
      </div>

      {/* ── Edit modal ── */}
      <EditOrderModal
        open={editOpen}
        order={order}
        onClose={() => setEditOpen(false)}
        onSaved={() => {
          setEditOpen(false);
          qc.invalidateQueries({ queryKey: ["admin-order", id] });
          qc.invalidateQueries({ queryKey: ["admin-orders"] });
        }}
      />

      <ConfirmDialog
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        title="إلغاء الطلب؟"
        message="لن يتم احتساب هذا الطلب في الإيرادات. لا يمكن التراجع بسهولة."
        confirmLabel="إلغاء الطلب"
        cancelLabel="عدول"
        variant="danger"
        onConfirm={() => cancelMutation.mutate()}
      />
    </div>
  );
}

// ── Edit modal ────────────────────────────────────────────

function EditOrderModal({
  open,
  order,
  onClose,
  onSaved,
}: {
  open: boolean;
  order: AdminOrder;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [draft, setDraft] = useState(() => buildDraft(order));

  // Reset draft when re-opening
  useEffect(() => {
    if (open) setDraft(buildDraft(order));
  }, [open, order]);

  const subtotal = useMemo(
    () => draft.items.reduce((s, it) => s + it.unitPrice * it.quantity, 0),
    [draft.items],
  );
  const total = subtotal + Number(draft.shippingCost || 0);

  const mutation = useMutation({
    mutationFn: () =>
      updateOrder(order.id, {
        firstName: draft.firstName,
        lastName: draft.lastName,
        phone: draft.phone,
        wilaya: draft.wilaya,
        address: draft.address,
        notes: draft.notes || null,
        shippingCost: Number(draft.shippingCost || 0),
        items: draft.items.map((it) => ({
          bookId: it.bookId,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
        })),
      }),
    onSuccess: () => {
      toast.success("تم حفظ التعديلات");
      onSaved();
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.message || "تعذّر الحفظ"),
  });

  const isValid =
    draft.firstName.trim() &&
    draft.lastName.trim() &&
    draft.phone.trim() &&
    draft.wilaya.trim() &&
    draft.address.trim() &&
    draft.items.length > 0 &&
    draft.items.every((it) => it.quantity > 0);

  return (
    <Modal open={open} onClose={onClose} title="تعديل الطلب" size="lg">
      <div className="space-y-5">
        {/* Customer */}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="الاسم الأول" required>
            <input className={inputClass} value={draft.firstName} onChange={(e) => setDraft({ ...draft, firstName: e.target.value })} />
          </Field>
          <Field label="اللقب" required>
            <input className={inputClass} value={draft.lastName} onChange={(e) => setDraft({ ...draft, lastName: e.target.value })} />
          </Field>
          <Field label="الهاتف" required>
            <input className={inputClass} dir="ltr" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
          </Field>
          <Field label="الولاية" required>
            <input className={inputClass} value={draft.wilaya} onChange={(e) => setDraft({ ...draft, wilaya: e.target.value })} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="العنوان" required>
              <input className={inputClass} value={draft.address} onChange={(e) => setDraft({ ...draft, address: e.target.value })} />
            </Field>
          </div>
        </div>

        {/* Items */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-sm font-bold">الكتب</h4>
            <BookPicker
              onPick={(book) => {
                if (draft.items.find((i) => i.bookId === book.id)) {
                  toast.info("الكتاب موجود مسبقًا");
                  return;
                }
                setDraft({
                  ...draft,
                  items: [
                    ...draft.items,
                    {
                      bookId: book.id,
                      bookTitle: book.title,
                      unitPrice: Number(book.price ?? 0),
                      quantity: 1,
                    },
                  ],
                });
              }}
            />
          </div>

          {draft.items.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/60 px-4 py-8 text-center text-xs text-muted-foreground">
              أضف كتابًا واحدًا على الأقل.
            </div>
          ) : (
            <ul className="space-y-2">
              {draft.items.map((it, i) => (
                <li key={it.bookId} className="grid gap-2 rounded-lg border border-border/60 bg-muted/20 p-3 sm:grid-cols-[1fr,90px,90px,40px]">
                  <span className="self-center text-sm font-medium">{it.bookTitle}</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className={inputClass}
                    value={it.unitPrice}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        items: draft.items.map((x, j) => j === i ? { ...x, unitPrice: Number(e.target.value) } : x),
                      })
                    }
                    placeholder="السعر"
                  />
                  <input
                    type="number"
                    min={1}
                    className={inputClass}
                    value={it.quantity}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        items: draft.items.map((x, j) => j === i ? { ...x, quantity: Number(e.target.value) } : x),
                      })
                    }
                    placeholder="الكمية"
                  />
                  <button
                    onClick={() => setDraft({ ...draft, items: draft.items.filter((_, j) => j !== i) })}
                    className="self-center inline-flex h-9 items-center justify-center rounded-lg text-rose-600 hover:bg-rose-50"
                    aria-label="حذف"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Totals */}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="تكلفة الشحن (د.ج)">
            <input
              type="number"
              min={0}
              step="0.01"
              className={inputClass}
              value={draft.shippingCost}
              onChange={(e) => setDraft({ ...draft, shippingCost: e.target.value })}
            />
          </Field>
          <div className="self-end rounded-lg border border-border/60 bg-muted/30 px-4 py-3 text-sm">
            <Row label="المجموع" value={subtotal} />
            <Row label="الإجمالي" value={total} bold />
          </div>
        </div>

        <Field label="ملاحظات">
          <textarea
            className={textareaClass}
            value={draft.notes}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            placeholder="ملاحظات داخلية..."
          />
        </Field>

        <div className="flex justify-end gap-2 border-t border-border/60 pt-4">
          <Button variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button onClick={() => mutation.mutate()} disabled={!isValid || mutation.isPending}>
            {mutation.isPending ? "جاري الحفظ..." : "حفظ"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function buildDraft(order: AdminOrder) {
  return {
    firstName: order.firstName,
    lastName: order.lastName,
    phone: order.phone,
    wilaya: order.wilaya,
    address: order.address,
    notes: order.notes || "",
    shippingCost: String(order.shippingCost),
    items: order.items.map((it): DraftItem => ({
      bookId: it.bookId,
      bookTitle: it.bookTitle,
      unitPrice: Number(it.unitPrice),
      quantity: it.quantity,
    })),
  };
}

// ── Book picker (search + click) ──────────────────────────

function BookPicker({ onPick }: { onPick: (b: AdminBook) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data, isFetching } = useQuery<{ books: AdminBook[] }>({
    queryKey: ["admin-book-picker", search],
    queryFn: () => fetchAdminBooks({ search, pageSize: 20 }),
    enabled: open && search.trim().length > 1,
  });

  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
          <path d="M12 5v14M5 12h14" />
        </svg>
        إضافة كتاب
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="اختيار كتاب" size="md">
        <input
          autoFocus
          className={inputClass}
          placeholder="ابحث عن كتاب..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <ul className="mt-3 max-h-72 overflow-y-auto">
          {isFetching && <li className="px-3 py-2 text-xs text-muted-foreground">جاري البحث...</li>}
          {!isFetching && search.trim().length > 1 && (data?.books?.length ?? 0) === 0 && (
            <li className="px-3 py-2 text-xs text-muted-foreground">لا توجد نتائج.</li>
          )}
          {data?.books?.map((b) => (
            <li key={b.id}>
              <button
                onClick={() => {
                  onPick(b);
                  setOpen(false);
                  setSearch("");
                }}
                className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-right text-sm transition-colors hover:bg-muted"
              >
                <span className="min-w-0 truncate">{b.title}</span>
                <span className="text-xs text-muted-foreground">
                  {b.price ? `${Number(b.price).toLocaleString("ar-DZ")} د.ج` : "بدون سعر"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Modal>
    </>
  );
}

// ── Helpers ───────────────────────────────────────────────

function Row({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-1 ${bold ? "border-t border-border/40 pt-2 text-base font-bold" : "text-muted-foreground"}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value.toLocaleString("ar-DZ", { maximumFractionDigits: 0 })} د.ج</span>
    </div>
  );
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-0.5 text-sm font-medium ${mono ? "font-mono" : ""}`} dir={mono ? "ltr" : undefined}>
        {value}
      </p>
    </div>
  );
}

function cleanPhone(phone: string) {
  const c = phone.replace(/\D/g, "");
  return c.startsWith("0") ? `213${c.slice(1)}` : c;
}
