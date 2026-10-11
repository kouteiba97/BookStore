import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  EXPENSE_LABEL,
  PAYMENT_LABEL,
  deleteExpense,
  fetchExpenses,
  money,
  saveExpense,
  ymd,
  type Expense,
  type ExpenseCategory,
  type PaymentMethod,
} from "@/lib/money-api";
import { Button, ConfirmDialog, EmptyState, Field, Modal, Pagination, Surface, TableSkeleton, inputClass, selectClass } from "@/components/admin/primitives";
import { useToast } from "@/components/admin/toaster";
import { FeatureGate } from "@/components/admin/plan-gate";

const CATS = Object.keys(EXPENSE_LABEL) as ExpenseCategory[];

/** What the shop spends besides books: rent, salaries, transport… */
export default function ExpensesPage() {
  return (
    <FeatureGate feature="money">
      <Expenses />
    </FeatureGate>
  );
}

function Expenses() {
  const toast = useToast();
  const qc = useQueryClient();
  const now = new Date();
  const [from, setFrom] = useState(ymd(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [to, setTo] = useState(ymd(now));
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<{ id?: string; category: ExpenseCategory; amount: string; date: string; description: string; paymentMethod: PaymentMethod | "" } | null>(null);
  const [del, setDel] = useState<Expense | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["expenses", from, to, category, page],
    queryFn: () => fetchExpenses({ from: from || undefined, to: to || undefined, category: category || undefined, page, pageSize: 25 }),
    placeholderData: keepPreviousData,
  });

  const save = useMutation({
    mutationFn: () =>
      saveExpense(
        {
          category: editing!.category,
          amount: Number(editing!.amount),
          date: `${editing!.date}T12:00:00Z`,
          description: editing!.description.trim() || null,
          paymentMethod: editing!.paymentMethod || null,
        },
        editing!.id,
      ),
    onSuccess: () => {
      toast.success("تم الحفظ");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["expenses"] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message?.toString() || "تعذّر الحفظ"),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteExpense(id),
    onSuccess: () => {
      toast.success("حُذف");
      setDel(null);
      qc.invalidateQueries({ queryKey: ["expenses"] });
    },
  });

  const open = (e?: Expense) =>
    setEditing(
      e
        ? { id: e.id, category: e.category, amount: String(Number(e.amount)), date: e.date.slice(0, 10), description: e.description ?? "", paymentMethod: e.paymentMethod ?? "" }
        : { category: "rent", amount: "", date: ymd(new Date()), description: "", paymentMethod: "cash" },
    );

  return (
    <div className="space-y-4">
      <Surface className="flex flex-wrap items-end gap-2 p-4">
        <label className="text-xs text-muted-foreground">
          من
          <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className={`${inputClass} mt-1 h-9`} />
        </label>
        <label className="text-xs text-muted-foreground">
          إلى
          <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className={`${inputClass} mt-1 h-9`} />
        </label>
        <select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} className={`${selectClass} h-9 w-auto`} aria-label="البند">
          <option value="">كل البنود</option>
          {CATS.map((c) => <option key={c} value={c}>{EXPENSE_LABEL[c]}</option>)}
        </select>
        <Button className="ms-auto" onClick={() => open()}>+ مصروف</Button>
      </Surface>

      {data && data.byCategory.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Surface className="p-4"><p className="text-xs text-muted-foreground">مجموع الفترة</p><p className="mt-1 text-xl font-bold tabular-nums">{money(data.sum)}</p></Surface>
          {[...data.byCategory].sort((a, b) => b.amount - a.amount).slice(0, 3).map((c) => (
            <Surface key={c.category} className="p-4"><p className="text-xs text-muted-foreground">{EXPENSE_LABEL[c.category] ?? c.category}</p><p className="mt-1 text-lg font-semibold tabular-nums">{money(c.amount)}</p></Surface>
          ))}
        </div>
      )}

      {isLoading ? (
        <TableSkeleton rows={5} cols={4} />
      ) : !data?.expenses.length ? (
        <EmptyState title="لا توجد مصاريف في هذه الفترة" description="سجّل الإيجار والأجور والنقل وغيرها لتظهر في صافي الربح." />
      ) : (
        <Surface className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b border-border/60">
                <th className="px-4 py-2 text-start font-semibold">التاريخ</th>
                <th className="px-2 py-2 text-start font-semibold">البند</th>
                <th className="px-2 py-2 text-start font-semibold">البيان</th>
                <th className="px-2 py-2 text-start font-semibold">الدفع</th>
                <th className="px-2 py-2 text-end font-semibold">المبلغ</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {data.expenses.map((e) => (
                <tr key={e.id} className="border-b border-border/30 last:border-0">
                  <td className="px-4 py-2 text-xs">{new Date(e.date).toLocaleDateString("ar-DZ")}</td>
                  <td className="px-2 py-2">{EXPENSE_LABEL[e.category] ?? e.category}</td>
                  <td className="max-w-[16rem] truncate px-2 py-2 text-muted-foreground">{e.description ?? "—"}</td>
                  <td className="px-2 py-2 text-xs">{e.paymentMethod ? PAYMENT_LABEL[e.paymentMethod] : "—"}</td>
                  <td className="px-2 py-2 text-end font-semibold tabular-nums">{money(e.amount)}</td>
                  <td className="px-4 py-2 text-end">
                    <button type="button" onClick={() => open(e)} className="text-xs font-semibold text-primary hover:underline">تعديل</button>
                    <button type="button" onClick={() => setDel(e)} className="ms-3 text-xs text-rose-600 hover:underline">حذف</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={page} pageSize={25} total={data.total} onChange={setPage} />
        </Surface>
      )}

      {editing && (
        <Modal open onClose={() => setEditing(null)} title={editing.id ? "تعديل مصروف" : "مصروف جديد"} size="md">
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="البند" required>
                <select value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value as ExpenseCategory })} className={selectClass}>
                  {CATS.map((c) => <option key={c} value={c}>{EXPENSE_LABEL[c]}</option>)}
                </select>
              </Field>
              <Field label="المبلغ (د.ج)" required>
                <input type="number" min={0} step="0.01" value={editing.amount} onChange={(e) => setEditing({ ...editing, amount: e.target.value })} className={inputClass} autoFocus />
              </Field>
              <Field label="التاريخ">
                <input type="date" value={editing.date} onChange={(e) => setEditing({ ...editing, date: e.target.value })} className={inputClass} />
              </Field>
              <Field label="طريقة الدفع">
                <select value={editing.paymentMethod} onChange={(e) => setEditing({ ...editing, paymentMethod: e.target.value as PaymentMethod | "" })} className={selectClass}>
                  <option value="">—</option>
                  {(["cash", "card", "transfer", "other"] as PaymentMethod[]).map((p) => <option key={p} value={p}>{PAYMENT_LABEL[p]}</option>)}
                </select>
              </Field>
            </div>
            <Field label="البيان">
              <input value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className={inputClass} placeholder="مثال: كراء المحل لشهر أكتوبر" />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setEditing(null)}>إلغاء</Button>
              <Button onClick={() => save.mutate()} disabled={!(Number(editing.amount) > 0) || save.isPending}>حفظ</Button>
            </div>
          </div>
        </Modal>
      )}
      <ConfirmDialog
        open={!!del}
        onClose={() => setDel(null)}
        onConfirm={() => del && remove.mutate(del.id)}
        title="حذف المصروف؟"
        message={del ? `${EXPENSE_LABEL[del.category]} — ${money(del.amount)}` : ""}
        confirmLabel="حذف"
        variant="danger"
      />
    </div>
  );
}
