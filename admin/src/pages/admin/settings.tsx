import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchStoreProfile, saveStoreProfile, type Feature, type StoreProfile } from "@/lib/money-api";
import { Button, Field, Surface, TableSkeleton, inputClass, textareaClass } from "@/components/admin/primitives";
import { useToast } from "@/components/admin/toaster";
import { usePlan } from "@/components/admin/plan-gate";

type Form = Pick<StoreProfile, "name" | "phone" | "address" | "email" | "rc" | "nif" | "nis" | "art" | "invoiceFooter">;
const FIELDS: (keyof Form)[] = ["name", "phone", "address", "email", "rc", "nif", "nis", "art", "invoiceFooter"];

/** The store's identity (shown on invoices) and its pack. */
export default function SettingsPage() {
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_1.1fr]">
      <ProfileForm />
      <PackCard />
    </div>
  );
}

function ProfileForm() {
  const toast = useToast();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["store-profile"], queryFn: fetchStoreProfile });
  const [form, setForm] = useState<Form | null>(null);
  useEffect(() => {
    if (data) setForm(Object.fromEntries(FIELDS.map((k) => [k, data[k] ?? ""])) as Form);
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      saveStoreProfile(Object.fromEntries(FIELDS.map((k) => [k, (form![k] ?? "").toString().trim() || (k === "name" ? data!.name : null)]))),
    onSuccess: (p) => {
      qc.setQueryData(["store-profile"], p);
      qc.removeQueries({ queryKey: ["invoice"] });
      toast.success("تم الحفظ");
    },
    onError: (e: any) => toast.error(e?.response?.data?.message?.toString() || "تعذّر الحفظ"),
  });

  if (isLoading || !form) return <TableSkeleton rows={6} cols={2} />;
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <Surface className="space-y-4 p-5">
      <div>
        <p className="text-base font-bold">معلومات المتجر</p>
        <p className="text-xs text-muted-foreground">تظهر في رأس الفواتير. المعلومات القانونية اختيارية.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="اسم المتجر" required><input value={form.name ?? ""} onChange={set("name")} className={inputClass} /></Field>
        <Field label="الهاتف"><input value={form.phone ?? ""} onChange={set("phone")} className={inputClass} dir="ltr" /></Field>
        <Field label="العنوان"><input value={form.address ?? ""} onChange={set("address")} className={inputClass} /></Field>
        <Field label="البريد الإلكتروني"><input value={form.email ?? ""} onChange={set("email")} className={inputClass} dir="ltr" /></Field>
        <Field label="السجل التجاري (RC)"><input value={form.rc ?? ""} onChange={set("rc")} className={inputClass} dir="ltr" /></Field>
        <Field label="رقم التعريف الجبائي (NIF)"><input value={form.nif ?? ""} onChange={set("nif")} className={inputClass} dir="ltr" /></Field>
        <Field label="رقم التعريف الإحصائي (NIS)"><input value={form.nis ?? ""} onChange={set("nis")} className={inputClass} dir="ltr" /></Field>
        <Field label="رقم المادة الضريبية (ART)"><input value={form.art ?? ""} onChange={set("art")} className={inputClass} dir="ltr" /></Field>
      </div>
      <Field label="نص أسفل الفاتورة">
        <textarea value={form.invoiceFooter ?? ""} onChange={set("invoiceFooter")} className={textareaClass} rows={2} placeholder="مثال: البضاعة المباعة لا تُرد بعد 7 أيام. شكرًا لثقتكم." />
      </Field>
      <div className="flex justify-end">
        <Button onClick={() => save.mutate()} disabled={save.isPending || !form.name?.trim()}>{save.isPending ? "جاري الحفظ..." : "حفظ"}</Button>
      </div>
    </Surface>
  );
}

const ORDER: Feature[] = ["money", "invoices", "reports", "historyImport", "socialExport", "academic"];
const limit = (n: number | null) => (n === null ? "غير محدود" : n.toLocaleString("ar-DZ"));

function PackCard() {
  const { data: plan, isLoading } = usePlan();
  if (isLoading || !plan) return <TableSkeleton rows={6} cols={4} />;
  const booksPct = plan.limits.books ? Math.min(100, Math.round((plan.usage.books / plan.limits.books) * 100)) : 0;

  return (
    <Surface className="space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-base font-bold">الباقة</p>
          <p className="text-xs text-muted-foreground">بياناتك تبقى لك في كل الباقات: الاستيراد والتصدير إلى Excel متاحان دائمًا.</p>
        </div>
        <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-bold text-primary">{plan.label}</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg bg-muted/50 p-3">
          <p className="text-xs text-muted-foreground">الكتب</p>
          <p className="mt-0.5 font-semibold tabular-nums">{plan.usage.books.toLocaleString("ar-DZ")} / {limit(plan.limits.books)}</p>
          {plan.limits.books !== null && (
            <div className="mt-2 h-1.5 rounded-full bg-muted">
              <div className={`h-1.5 rounded-full ${booksPct >= 90 ? "bg-amber-500" : "bg-primary"}`} style={{ width: `${Math.max(2, booksPct)}%` }} />
            </div>
          )}
        </div>
        <div className="rounded-lg bg-muted/50 p-3">
          <p className="text-xs text-muted-foreground">عمليات الاستيراد هذا الشهر</p>
          <p className="mt-0.5 font-semibold tabular-nums">{plan.usage.importsThisMonth} / {limit(plan.limits.importsPerMonth)}</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 text-xs">
              <th className="py-2 text-start font-semibold text-muted-foreground">الميزة</th>
              {plan.plans.map((p) => (
                <th key={p.key} className={`py-2 text-center font-bold ${p.key === plan.plan ? "text-primary" : ""}`}>
                  {p.label}
                  {p.key === plan.plan && <span className="block text-[10px] font-normal">(باقتك)</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border/30">
              <td className="py-2">الكتالوج والمتجر والطلبات والمخزون والمبيعات</td>
              {plan.plans.map((p) => <td key={p.key} className="py-2 text-center text-emerald-700">✓</td>)}
            </tr>
            <tr className="border-b border-border/30">
              <td className="py-2">استيراد/تصدير الكتب بـ Excel</td>
              {plan.plans.map((p) => <td key={p.key} className="py-2 text-center text-emerald-700">✓</td>)}
            </tr>
            {ORDER.map((f) => (
              <tr key={f} className="border-b border-border/30">
                <td className="py-2">{plan.featureLabels[f]}</td>
                {plan.plans.map((p) => (
                  <td key={p.key} className="py-2 text-center">
                    {p.features.includes(f) ? <span className="text-emerald-700">✓</span> : <span className="text-muted-foreground/50">—</span>}
                  </td>
                ))}
              </tr>
            ))}
            <tr className="border-b border-border/30">
              <td className="py-2">عدد الكتب</td>
              {plan.plans.map((p) => <td key={p.key} className="py-2 text-center text-xs tabular-nums">{limit(p.limits.books)}</td>)}
            </tr>
            <tr>
              <td className="py-2">استيراد في الشهر</td>
              {plan.plans.map((p) => <td key={p.key} className="py-2 text-center text-xs tabular-nums">{limit(p.limits.importsPerMonth)}</td>)}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">لتغيير الباقة تواصل مع فريق المنصة.</p>
    </Surface>
  );
}
