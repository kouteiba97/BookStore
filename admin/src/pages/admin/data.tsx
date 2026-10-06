import { useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  downloadBooksExport,
  downloadOrdersExport,
  fetchDataQuality,
  fetchImportHistory,
  undoImport,
  type ImportJob,
} from "@/lib/admin-api";
import { Button, ConfirmDialog, EmptyState, Surface, TableSkeleton, inputClass, selectClass } from "@/components/admin/primitives";
import { useToast } from "@/components/admin/toaster";
import ImportWizard from "@/components/admin/import-wizard";
import { QualityGrid } from "@/components/admin/quality-grid";

type Tab = "import" | "history" | "export" | "quality";
const TABS: { key: Tab; label: string }[] = [
  { key: "import", label: "استيراد من Excel" },
  { key: "history", label: "سجل الاستيراد" },
  { key: "export", label: "تصدير" },
  { key: "quality", label: "جودة البيانات" },
];

/** Moving a shop's spreadsheets in, and getting the platform's data out. */
export default function DataPage() {
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find((t) => t.key === params.get("tab"))?.key ?? "import") as Tab;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-1 rounded-xl border border-border/60 bg-card p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setParams({ tab: t.key }, { replace: true })}
            className={`flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
              tab === t.key ? "bg-primary text-primary-foreground shadow-warm" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "import" && <ImportWizard />}
      {tab === "history" && <History />}
      {tab === "export" && <Exports />}
      {tab === "quality" && <Quality />}
    </div>
  );
}

function History() {
  const toast = useToast();
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState<ImportJob | null>(null);
  const { data = [], isLoading } = useQuery({ queryKey: ["import-history"], queryFn: fetchImportHistory });

  const undo = useMutation({
    mutationFn: (id: string) => undoImport(id),
    onSuccess: (r) => {
      toast.success(
        `حُذف ${r.removed} كتاب` + (r.keptBecauseOrdered ? ` — وبقي ${r.keptBecauseOrdered} لأنها في طلبات` : ""),
      );
      qc.invalidateQueries({ queryKey: ["import-history"] });
      qc.invalidateQueries({ queryKey: ["admin-books"] });
      qc.invalidateQueries({ queryKey: ["data-quality"] });
      setConfirm(null);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || "تعذّر التراجع"),
  });

  if (isLoading) return <TableSkeleton rows={4} cols={4} />;
  if (!data.length) return <EmptyState title="لا يوجد استيراد بعد" description="كل ملف تستورده يظهر هنا، مع إمكانية التراجع عنه." />;

  return (
    <Surface className="overflow-hidden">
      <ul className="divide-y divide-border/40">
        {data.map((j) => (
          <li key={j.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold" dir="auto">
                {j.fileName} <span className="font-normal text-muted-foreground">— {j.sheetName}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {new Date(j.createdAt).toLocaleString("ar-DZ")} • {j.created} جديد • {j.updated} تحديث • {j.skipped} متجاهل • {j.errors} خطأ
              </p>
            </div>
            {j.status === "undone" ? (
              <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">تم التراجع</span>
            ) : (
              <Button size="sm" variant="secondary" onClick={() => setConfirm(j)} disabled={j.created === 0}>
                تراجع
              </Button>
            )}
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm && undo.mutate(confirm.id)}
        title="التراجع عن الاستيراد؟"
        message={
          confirm
            ? `ستُحذف ${confirm.booksStillLinked} كتب أضافها هذا الملف (ما عدا المطلوبة في طلبات). التحديثات على الكتب الموجودة مسبقًا لا تُلغى.`
            : ""
        }
        confirmLabel={undo.isPending ? "جاري التراجع..." : "نعم، تراجع"}
        variant="danger"
      />
    </Surface>
  );
}

function Exports() {
  const toast = useToast();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState("");
  const books = useMutation({ mutationFn: downloadBooksExport, onError: () => toast.error("تعذّر التصدير") });
  const orders = useMutation({
    mutationFn: () => downloadOrdersExport({ from: from || undefined, to: to || undefined, status: status || undefined }),
    onError: (e: any) => toast.error(e?.response?.status === 400 ? "تاريخ غير صحيح" : "تعذّر التصدير"),
  });

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Surface className="space-y-3 p-5">
        <p className="text-base font-bold">الكتب والمخزون</p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          كل الكتب بأسعار البيع والشراء والكميات والتصنيفات، مع ورقة «ملخص المخزون» (عدد النسخ وقيمة المخزون). الأعمدة بنفس
          أسماء الاستيراد: عدّل الملف في Excel ثم استورده من جديد.
        </p>
        <Button onClick={() => books.mutate()} disabled={books.isPending}>
          {books.isPending ? "جاري التجهيز..." : "تنزيل الكتب (Excel)"}
        </Button>
      </Surface>

      <Surface className="space-y-3 p-5">
        <p className="text-base font-bold">الطلبات والمداخيل</p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          الطلبات وتفاصيلها، مع ورقة «المداخيل الشهرية» (الطلبات المؤكدة والمشحونة والمسلّمة).
        </p>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-muted-foreground">
            من
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={`${inputClass} mt-1`} />
          </label>
          <label className="text-xs text-muted-foreground">
            إلى
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={`${inputClass} mt-1`} />
          </label>
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectClass}>
          <option value="">كل الحالات</option>
          <option value="pending">قيد الانتظار</option>
          <option value="confirmed">مؤكد</option>
          <option value="shipped">تم الشحن</option>
          <option value="delivered">تم التسليم</option>
          <option value="cancelled">ملغى</option>
        </select>
        <Button onClick={() => orders.mutate()} disabled={orders.isPending}>
          {orders.isPending ? "جاري التجهيز..." : "تنزيل الطلبات (Excel)"}
        </Button>
      </Surface>

      <Surface className="space-y-2 p-5 md:col-span-2">
        <p className="text-base font-bold">صور الكتب لمواقع التواصل</p>
        <p className="text-sm text-muted-foreground">
          الأغلفة وبيانات الكتب في ملف ZIP جاهز للنشر — من صفحة{" "}
          <Link to="/admin/social-content" className="font-semibold text-primary hover:underline">
            محتوى التواصل
          </Link>
          .
        </p>
      </Surface>
    </div>
  );
}

function Quality() {
  const { data, isLoading } = useQuery({ queryKey: ["data-quality"], queryFn: fetchDataQuality });
  if (isLoading || !data) return <TableSkeleton rows={2} cols={3} />;
  return (
    <Surface className="space-y-4 p-5">
      <p className="text-sm text-muted-foreground">
        {data.total.toLocaleString("ar-DZ")} كتاب في المتجر. اضغط على أي خانة لعرض الكتب المعنية وإكمالها.
      </p>
      <QualityGrid quality={data} />
    </Surface>
  );
}
