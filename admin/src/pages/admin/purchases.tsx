import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  cancelPurchase,
  createPurchase,
  createSupplier,
  deletePurchase,
  deleteSupplier,
  fetchPurchase,
  fetchPurchases,
  fetchSuppliers,
  money,
  payPurchase,
  updateSupplier,
  ymd,
  type Purchase,
  type Supplier,
} from "@/lib/money-api";
import { Button, ConfirmDialog, EmptyState, Field, Modal, Pagination, Surface, TableSkeleton, inputClass, selectClass, textareaClass } from "@/components/admin/primitives";
import { useToast } from "@/components/admin/toaster";
import BookSearch from "@/components/admin/book-search";
import { FeatureGate } from "@/components/admin/plan-gate";

const errMsg = (e: any, fallback: string) => {
  const m = e?.response?.data?.message;
  return (Array.isArray(m) ? m.join("، ") : m) || fallback;
};

/** Stock coming in: deliveries from suppliers, and what is still owed to them. */
export default function PurchasesPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "suppliers" ? "suppliers" : "purchases";
  return (
    <FeatureGate feature="money">
      <div className="space-y-5">
        <div className="flex gap-1 rounded-xl border border-border/60 bg-card p-1">
          {(
            [
              ["purchases", "المشتريات"],
              ["suppliers", "الموردون"],
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
        {tab === "purchases" ? <Purchases /> : <Suppliers />}
      </div>
    </FeatureGate>
  );
}

// ── Purchases list ────────────────────────────────────────

function Purchases() {
  const [supplierId, setSupplierId] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const { data: suppliers = [] } = useQuery({ queryKey: ["suppliers"], queryFn: fetchSuppliers });
  const { data, isLoading } = useQuery({
    queryKey: ["purchases", supplierId, page],
    queryFn: () => fetchPurchases({ supplierId: supplierId || undefined, page, pageSize: 25 }),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select value={supplierId} onChange={(e) => { setSupplierId(e.target.value); setPage(1); }} className={`${selectClass} h-10 w-auto`} aria-label="المورد">
          <option value="">كل الموردين</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        {data && (
          <span className="text-xs text-muted-foreground">
            المجموع {money(data.totals.total)} • المدفوع {money(data.totals.paid)} •{" "}
            <span className={data.totals.balance > 0 ? "font-bold text-amber-700" : ""}>الباقي {money(data.totals.balance)}</span>
          </span>
        )}
        <Button className="ms-auto" onClick={() => setCreating(true)}>+ تسجيل شراء</Button>
      </div>

      {isLoading ? (
        <TableSkeleton rows={5} cols={5} />
      ) : !data?.purchases.length ? (
        <EmptyState title="لا توجد مشتريات بعد" description="سجّل وصول كتب من مورد: تدخل للمخزون تلقائيًا ويُحدَّث سعر الشراء." />
      ) : (
        <Surface className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b border-border/60">
                <th className="px-4 py-2 text-start font-semibold">التاريخ</th>
                <th className="px-2 py-2 text-start font-semibold">المورد</th>
                <th className="px-2 py-2 text-start font-semibold">المرجع</th>
                <th className="px-2 py-2 text-start font-semibold">الأسطر</th>
                <th className="px-2 py-2 text-end font-semibold">المجموع</th>
                <th className="px-4 py-2 text-end font-semibold">الباقي</th>
              </tr>
            </thead>
            <tbody>
              {data.purchases.map((p) => {
                const due = Number(p.total) - Number(p.paidAmount);
                return (
                  <tr key={p.id} onClick={() => setOpenId(p.id)} className={`cursor-pointer border-b border-border/30 last:border-0 hover:bg-muted/30 ${p.cancelled ? "opacity-50" : ""}`}>
                    <td className="px-4 py-2 text-xs">{new Date(p.date).toLocaleDateString("ar-DZ")}</td>
                    <td className="px-2 py-2 font-medium">{p.supplier?.name ?? "—"}{p.cancelled && <span className="ms-2 text-xs text-rose-600">ملغى</span>}</td>
                    <td className="px-2 py-2 font-mono text-xs">{p.reference ?? "—"}</td>
                    <td className="px-2 py-2 text-xs">{p._count?.items ?? 0}</td>
                    <td className="px-2 py-2 text-end tabular-nums">{money(p.total)}</td>
                    <td className={`px-4 py-2 text-end tabular-nums ${due > 0 && !p.cancelled ? "font-bold text-amber-700" : "text-muted-foreground"}`}>{money(due)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <Pagination page={page} pageSize={25} total={data.total} onChange={setPage} />
        </Surface>
      )}

      {creating && <NewPurchase suppliers={suppliers} onClose={() => setCreating(false)} />}
      {openId && <PurchaseDetail id={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}

// ── New purchase ──────────────────────────────────────────

interface Line {
  key: string;
  bookId?: string;
  title: string;
  quantity: number;
  unitCost: number;
  salePrice: string;
  isNew: boolean;
}

function NewPurchase({ suppliers, onClose }: { suppliers: Supplier[]; onClose: () => void }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [supplier, setSupplier] = useState("");
  const [newSupplier, setNewSupplier] = useState("");
  const [reference, setReference] = useState("");
  const [date, setDate] = useState(ymd(new Date()));
  const [lines, setLines] = useState<Line[]>([]);
  const [shipping, setShipping] = useState("");
  const [paid, setPaid] = useState("");
  const [notes, setNotes] = useState("");
  const [addToStock, setAddToStock] = useState(true);

  const subtotal = lines.reduce((s, l) => s + l.unitCost * l.quantity, 0);
  const total = subtotal + (Number(shipping) || 0);
  const upd = (i: number, p: Partial<Line>) => setLines((ls) => ls.map((l, k) => (k === i ? { ...l, ...p } : l)));

  const save = useMutation({
    mutationFn: () =>
      createPurchase({
        supplierId: supplier && supplier !== "__new" ? supplier : null,
        supplierName: supplier === "__new" ? newSupplier.trim() : null,
        reference: reference.trim() || null,
        date: `${date}T12:00:00Z`,
        items: lines.map((l) => ({
          ...(l.bookId ? { bookId: l.bookId } : { title: l.title }),
          quantity: l.quantity,
          unitCost: l.unitCost,
          ...(l.salePrice !== "" ? { salePrice: Number(l.salePrice) } : {}),
        })),
        shippingCost: Number(shipping) || 0,
        paidAmount: Number(paid) || 0,
        notes: notes.trim() || null,
        addToStock,
      }),
    onSuccess: () => {
      toast.success("تم تسجيل الشراء");
      qc.invalidateQueries({ queryKey: ["purchases"] });
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      qc.invalidateQueries({ queryKey: ["admin-books"] });
      qc.invalidateQueries({ queryKey: ["admin-inventory"] });
      onClose();
    },
    onError: (e) => toast.error(errMsg(e, "تعذّر الحفظ")),
  });

  return (
    <Modal open onClose={onClose} title="تسجيل شراء من مورد" size="lg">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="المورد">
            <select value={supplier} onChange={(e) => setSupplier(e.target.value)} className={selectClass}>
              <option value="">— بدون —</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
              <option value="__new">+ مورد جديد</option>
            </select>
          </Field>
          <Field label="رقم الفاتورة / الوصل">
            <input value={reference} onChange={(e) => setReference(e.target.value)} className={inputClass} />
          </Field>
          <Field label="التاريخ">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
          </Field>
        </div>
        {supplier === "__new" && (
          <input value={newSupplier} onChange={(e) => setNewSupplier(e.target.value)} placeholder="اسم المورد الجديد" className={inputClass} autoFocus />
        )}

        <BookSearch
          onPick={(b) => setLines((ls) => [...ls, { key: crypto.randomUUID(), bookId: b.id, title: b.title, quantity: 1, unitCost: Number(b.costPrice ?? 0), salePrice: "", isNew: false }])}
          onNewTitle={(t) => setLines((ls) => [...ls, { key: crypto.randomUUID(), title: t, quantity: 1, unitCost: 0, salePrice: "", isNew: true }])}
          placeholder="أضف كتابًا (موجود، أو عنوانًا جديدًا)..."
        />
        {lines.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-border/60">
                  <th className="py-2 text-start font-semibold">الكتاب</th>
                  <th className="w-20 py-2 text-start font-semibold">الكمية</th>
                  <th className="w-28 py-2 text-start font-semibold">سعر الشراء</th>
                  <th className="w-28 py-2 text-start font-semibold">سعر البيع (اختياري)</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={l.key} className="border-b border-border/30 last:border-0">
                    <td className="py-2 pe-2">
                      <span className="font-medium">{l.title}</span>
                      {l.isNew && <span className="ms-2 rounded-full bg-emerald-50 px-1.5 text-[10px] font-bold text-emerald-700">جديد</span>}
                    </td>
                    <td className="py-2 pe-2">
                      <input type="number" min={1} value={l.quantity} onChange={(e) => upd(i, { quantity: Math.max(1, Math.floor(Number(e.target.value) || 1)) })} className={`${inputClass} h-9`} />
                    </td>
                    <td className="py-2 pe-2">
                      <input type="number" min={0} step="0.01" value={l.unitCost} onChange={(e) => upd(i, { unitCost: Math.max(0, Number(e.target.value) || 0) })} className={`${inputClass} h-9`} />
                    </td>
                    <td className="py-2 pe-2">
                      <input type="number" min={0} step="0.01" value={l.salePrice} onChange={(e) => upd(i, { salePrice: e.target.value })} className={`${inputClass} h-9`} />
                    </td>
                    <td className="py-2">
                      <button type="button" onClick={() => setLines((ls) => ls.filter((_, k) => k !== i))} aria-label="حذف" className="rounded p-1 text-rose-600 hover:bg-rose-50">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="مصاريف النقل">
            <input type="number" min={0} value={shipping} onChange={(e) => setShipping(e.target.value)} className={inputClass} placeholder="0" />
          </Field>
          <Field label="المدفوع للمورد">
            <input type="number" min={0} value={paid} onChange={(e) => setPaid(e.target.value)} className={inputClass} placeholder="0" />
          </Field>
          <div className="rounded-lg bg-muted/40 p-3 text-sm">
            <p className="flex justify-between"><span className="text-muted-foreground">المجموع</span><span className="font-bold">{money(total)}</span></p>
            <p className="flex justify-between"><span className="text-muted-foreground">الباقي</span><span>{money(Math.max(0, total - (Number(paid) || 0)))}</span></p>
          </div>
        </div>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ملاحظات (اختياري)" className={textareaClass} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={addToStock} onChange={(e) => setAddToStock(e.target.checked)} className="h-4 w-4" />
          إدخال الكتب إلى المخزون الآن
        </label>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>إلغاء</Button>
          <Button
            onClick={() => save.mutate()}
            disabled={!lines.length || save.isPending || (supplier === "__new" && !newSupplier.trim())}
          >
            {save.isPending ? "جاري الحفظ..." : `حفظ الشراء (${money(total)})`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Purchase detail ───────────────────────────────────────

function PurchaseDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [paid, setPaid] = useState("");
  const [confirm, setConfirm] = useState<"cancel" | "delete" | null>(null);
  const { data: p } = useQuery<Purchase>({ queryKey: ["purchase", id], queryFn: () => fetchPurchase(id) });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["purchase", id] });
    qc.invalidateQueries({ queryKey: ["purchases"] });
    qc.invalidateQueries({ queryKey: ["suppliers"] });
    qc.invalidateQueries({ queryKey: ["admin-inventory"] });
  };
  const pay = useMutation({ mutationFn: (v: number) => payPurchase(id, v), onSuccess: () => { toast.success("تم تحديث المبلغ المدفوع"); setPaid(""); refresh(); }, onError: (e) => toast.error(errMsg(e, "تعذّر")) });
  const cancel = useMutation({ mutationFn: () => cancelPurchase(id), onSuccess: () => { toast.success("أُلغي الشراء وخرجت كتبه من المخزون"); setConfirm(null); refresh(); }, onError: (e) => toast.error(errMsg(e, "تعذّر")) });
  const del = useMutation({ mutationFn: () => deletePurchase(id), onSuccess: () => { toast.success("حُذف"); refresh(); onClose(); }, onError: (e) => toast.error(errMsg(e, "تعذّر")) });

  return (
    <Modal open onClose={onClose} title="تفاصيل الشراء" size="lg">
      {!p ? (
        <TableSkeleton rows={4} cols={3} />
      ) : (
        <div className="space-y-4 text-sm">
          <div className="grid gap-2 sm:grid-cols-3">
            <p><span className="text-muted-foreground">المورد: </span>{p.supplier?.name ?? "—"}</p>
            <p><span className="text-muted-foreground">التاريخ: </span>{new Date(p.date).toLocaleDateString("ar-DZ")}</p>
            <p><span className="text-muted-foreground">المرجع: </span>{p.reference ?? "—"}</p>
          </div>
          {p.cancelled && <p className="rounded-lg bg-rose-50 px-3 py-2 text-rose-700">هذا الشراء ملغى.</p>}
          {!p.stockApplied && !p.cancelled && <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-800">سُجّل بدون إدخال الكتب إلى المخزون.</p>}
          <table className="w-full">
            <thead className="text-xs text-muted-foreground"><tr className="border-b border-border/60"><th className="py-1 text-start">الكتاب</th><th className="py-1 text-start">الكمية</th><th className="py-1 text-end">سعر الشراء</th><th className="py-1 text-end">المجموع</th></tr></thead>
            <tbody>
              {p.items?.map((i) => (
                <tr key={i.id} className="border-b border-border/30 last:border-0">
                  <td className="py-1.5">{i.bookTitle}</td>
                  <td className="py-1.5">{i.quantity}</td>
                  <td className="py-1.5 text-end tabular-nums">{money(i.unitCost)}</td>
                  <td className="py-1.5 text-end tabular-nums">{money(Number(i.unitCost) * i.quantity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="ms-auto max-w-xs space-y-1">
            <p className="flex justify-between"><span className="text-muted-foreground">النقل</span><span>{money(p.shippingCost)}</span></p>
            <p className="flex justify-between font-bold"><span>المجموع</span><span>{money(p.total)}</span></p>
            <p className="flex justify-between"><span className="text-muted-foreground">المدفوع</span><span>{money(p.paidAmount)}</span></p>
            <p className="flex justify-between text-amber-700"><span>الباقي</span><span>{money(Number(p.total) - Number(p.paidAmount))}</span></p>
          </div>
          {!p.cancelled && (
            <div className="flex flex-wrap items-end gap-2 border-t border-border/60 pt-3">
              <label className="text-xs text-muted-foreground">
                المبلغ المدفوع (الإجمالي)
                <input type="number" min={0} value={paid} onChange={(e) => setPaid(e.target.value)} placeholder={String(Number(p.paidAmount))} className={`${inputClass} mt-1 h-9 w-36`} />
              </label>
              <Button size="sm" onClick={() => pay.mutate(Number(paid))} disabled={paid === "" || pay.isPending}>حفظ الدفع</Button>
              <Button size="sm" variant="secondary" onClick={() => pay.mutate(Number(p.total))} disabled={pay.isPending}>سُدّد بالكامل</Button>
              <Button size="sm" variant="danger" className="ms-auto" onClick={() => setConfirm("cancel")}>إلغاء الشراء</Button>
            </div>
          )}
          {p.cancelled && (
            <div className="flex justify-end border-t border-border/60 pt-3">
              <Button size="sm" variant="danger" onClick={() => setConfirm("delete")}>حذف نهائي</Button>
            </div>
          )}
        </div>
      )}
      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => (confirm === "cancel" ? cancel.mutate() : del.mutate())}
        title={confirm === "cancel" ? "إلغاء هذا الشراء؟" : "حذف الشراء نهائيًا؟"}
        message={confirm === "cancel" ? "ستخرج كتبه من المخزون، ويبقى في السجل كشراء ملغى." : "لا يمكن التراجع عن الحذف."}
        confirmLabel={confirm === "cancel" ? "نعم، ألغِ" : "نعم، احذف"}
        variant="danger"
      />
    </Modal>
  );
}

// ── Suppliers ─────────────────────────────────────────────

function Suppliers() {
  const toast = useToast();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<Supplier> | null>(null);
  const [del, setDel] = useState<Supplier | null>(null);
  const { data = [], isLoading } = useQuery({ queryKey: ["suppliers"], queryFn: fetchSuppliers });

  const save = useMutation({
    mutationFn: (s: Partial<Supplier>) => {
      const body = { name: s.name ?? "", phone: s.phone ?? null, email: s.email ?? null, address: s.address ?? null, notes: s.notes ?? null };
      return s.id ? updateSupplier(s.id, body) : createSupplier(body);
    },
    onSuccess: () => { toast.success("تم الحفظ"); setEditing(null); qc.invalidateQueries({ queryKey: ["suppliers"] }); },
    onError: (e) => toast.error(errMsg(e, "تعذّر الحفظ")),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteSupplier(id),
    onSuccess: () => { toast.success("حُذف المورد"); setDel(null); qc.invalidateQueries({ queryKey: ["suppliers"] }); },
    onError: (e) => toast.error(errMsg(e, "تعذّر الحذف")),
  });
  const owed = data.reduce((s, x) => s + Math.max(0, x.balance), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">
          المستحق لكل الموردين: <span className="font-bold text-amber-700">{money(owed)}</span>
        </span>
        <Button className="ms-auto" onClick={() => setEditing({})}>+ مورد</Button>
      </div>
      {isLoading ? (
        <TableSkeleton rows={4} cols={4} />
      ) : !data.length ? (
        <EmptyState title="لا يوجد موردون بعد" description="يُضاف المورد تلقائيًا عند أول شراء، أو أضفه هنا." />
      ) : (
        <Surface className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b border-border/60">
                <th className="px-4 py-2 text-start font-semibold">المورد</th>
                <th className="px-2 py-2 text-start font-semibold">الهاتف</th>
                <th className="px-2 py-2 text-end font-semibold">المشتريات</th>
                <th className="px-2 py-2 text-end font-semibold">المدفوع</th>
                <th className="px-2 py-2 text-end font-semibold">الباقي</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {data.map((s) => (
                <tr key={s.id} className="border-b border-border/30 last:border-0">
                  <td className="px-4 py-2 font-medium">{s.name}<span className="ms-2 text-xs text-muted-foreground">({s.purchases})</span></td>
                  <td className="px-2 py-2 text-xs" dir="ltr">{s.phone ?? "—"}</td>
                  <td className="px-2 py-2 text-end tabular-nums">{money(s.totalPurchased)}</td>
                  <td className="px-2 py-2 text-end tabular-nums">{money(s.totalPaid)}</td>
                  <td className={`px-2 py-2 text-end tabular-nums ${s.balance > 0 ? "font-bold text-amber-700" : ""}`}>{money(s.balance)}</td>
                  <td className="px-4 py-2 text-end">
                    <button type="button" onClick={() => setEditing(s)} className="text-xs font-semibold text-primary hover:underline">تعديل</button>
                    <button type="button" onClick={() => setDel(s)} className="ms-3 text-xs text-rose-600 hover:underline">حذف</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Surface>
      )}
      {editing && (
        <Modal open onClose={() => setEditing(null)} title={editing.id ? "تعديل مورد" : "مورد جديد"} size="md">
          <div className="space-y-3">
            {(["name", "phone", "email", "address"] as const).map((f) => (
              <Field key={f} label={{ name: "الاسم", phone: "الهاتف", email: "البريد", address: "العنوان" }[f]} required={f === "name"}>
                <input value={(editing[f] as string) ?? ""} onChange={(e) => setEditing({ ...editing, [f]: e.target.value })} className={inputClass} dir={f === "phone" || f === "email" ? "ltr" : undefined} />
              </Field>
            ))}
            <Field label="ملاحظات">
              <textarea value={editing.notes ?? ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} className={textareaClass} />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setEditing(null)}>إلغاء</Button>
              <Button onClick={() => save.mutate(editing)} disabled={!editing.name?.trim() || save.isPending}>حفظ</Button>
            </div>
          </div>
        </Modal>
      )}
      <ConfirmDialog
        open={!!del}
        onClose={() => setDel(null)}
        onConfirm={() => del && remove.mutate(del.id)}
        title="حذف المورد؟"
        message="تبقى مشترياته في السجل بدون اسم مورد."
        confirmLabel="حذف"
        variant="danger"
      />
    </div>
  );
}
