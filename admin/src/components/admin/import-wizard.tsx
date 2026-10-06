import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  analyzeImport,
  commitImport,
  downloadImportReport,
  downloadImportTemplate,
  fetchCatalog,
  previewImport,
  type ImportAction,
  type ImportAnalysis,
  type ImportField,
  type ImportOptions,
  type ImportPreview,
  type ImportResult,
} from "@/lib/admin-api";
import type { CatalogItem } from "@/lib/admin-types";
import { Button, Surface, selectClass } from "@/components/admin/primitives";
import { useToast } from "@/components/admin/toaster";
import { QualityGrid } from "@/components/admin/quality-grid";

type Step = "upload" | "map" | "preview" | "done";

const ACTION_LABEL: Record<ImportAction, string> = {
  create: "جديد",
  update: "تحديث",
  unchanged: "بدون تغيير",
  skip: "تجاهل",
  error: "خطأ",
};
const ACTION_STYLE: Record<ImportAction, string> = {
  create: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  update: "bg-blue-50 text-blue-700 ring-blue-200",
  unchanged: "bg-muted text-muted-foreground ring-border",
  skip: "bg-amber-50 text-amber-700 ring-amber-200",
  error: "bg-rose-50 text-rose-700 ring-rose-200",
};

const errMsg = (e: any) => {
  const m = e?.response?.data?.message;
  return Array.isArray(m) ? m.join("، ") : m || e?.message || "حدث خطأ";
};

/**
 * Bring a shop's Excel sheets into the platform:
 * upload → check how columns were understood → see exactly what will happen
 * → import → see what is still missing (with an undo in the history).
 */
export default function ImportWizard() {
  const toast = useToast();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("upload");
  const [dragOver, setDragOver] = useState(false);
  const [analysis, setAnalysis] = useState<ImportAnalysis | null>(null);
  const [opts, setOpts] = useState<ImportOptions | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [rowFilter, setRowFilter] = useState<"all" | "issues" | ImportAction>("issues");

  const { data: categories = [] } = useQuery<CatalogItem[]>({
    queryKey: ["catalog", "categories"],
    queryFn: () => fetchCatalog("categories"),
    staleTime: 5 * 60_000,
  });

  const optionsFor = (a: ImportAnalysis, sheetName: string): ImportOptions => {
    const sheet = a.sheets.find((s) => s.name === sheetName)!;
    const mapping: ImportOptions["mapping"] = {};
    for (const c of sheet.columns) if (c.field) mapping[c.field] = c.index;
    return {
      sheet: sheet.name,
      headerRow: sheet.headerRow,
      mapping,
      existing: "update",
      stockMode: "set",
      defaultCategory: null,
      defaultStatus: "available",
    };
  };

  const analyze = useMutation({
    mutationFn: analyzeImport,
    onSuccess: (a) => {
      setAnalysis(a);
      const first = a.sheets.find((s) => s.looksLikeCatalog) ?? a.sheets[0];
      setOpts(optionsFor(a, first.name));
      setPreview(null);
      setResult(null);
      setStep("map");
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const runPreview = useMutation({
    mutationFn: () => previewImport(analysis!.sessionId, opts!),
    onSuccess: (p) => {
      setPreview(p);
      setRowFilter(p.summary.error || p.issues.length ? "issues" : "all");
      setStep("preview");
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const commit = useMutation({
    mutationFn: () => commitImport(analysis!.sessionId, opts!),
    onSuccess: (r) => {
      setResult(r);
      setStep("done");
      toast.success(`تم: ${r.created} كتاب جديد، ${r.updated} تحديث`);
      qc.invalidateQueries({ queryKey: ["admin-books"] });
      qc.invalidateQueries({ queryKey: ["import-history"] });
      qc.invalidateQueries({ queryKey: ["data-quality"] });
      qc.invalidateQueries({ queryKey: ["catalog"] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const report = useMutation({
    mutationFn: () => downloadImportReport(analysis!.sessionId, opts!),
    onError: (e) => toast.error(errMsg(e)),
  });

  const pickFile = (f: File | undefined | null) => {
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) return toast.error("الملف أكبر من 10 ميغابايت.");
    analyze.mutate(f);
  };

  const reset = () => {
    setStep("upload");
    setAnalysis(null);
    setOpts(null);
    setPreview(null);
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const sheet = analysis && opts ? analysis.sheets.find((s) => s.name === opts.sheet)! : null;
  const fieldOfColumn = useMemo(() => {
    const m = new Map<number, ImportField>();
    if (opts) for (const [f, i] of Object.entries(opts.mapping)) if (i !== undefined) m.set(i, f as ImportField);
    return m;
  }, [opts]);

  const setColumnField = (index: number, field: ImportField | "") => {
    setOpts((o) => {
      if (!o) return o;
      const mapping = { ...o.mapping };
      for (const [f, i] of Object.entries(mapping)) if (i === index) delete mapping[f as ImportField];
      if (field) mapping[field] = index; // a field moves to its new column
      return { ...o, mapping };
    });
  };

  return (
    <div className="space-y-4">
      <Stepper step={step} />

      {/* ── 1. Upload ── */}
      {step === "upload" && (
        <Surface className="space-y-4 p-5">
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.xlsm,.csv,.ods"
            className="hidden"
            onChange={(e) => pickFile(e.target.files?.[0])}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              pickFile(e.dataTransfer.files?.[0]);
            }}
            disabled={analyze.isPending}
            className={`flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed py-14 text-center transition-colors ${
              dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/60"
            }`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-11 w-11 text-emerald-600">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <path d="M14 2v6h6M8 13l3 4M11 13l-3 4M14 17h3" />
            </svg>
            <span className="text-base font-bold">
              {analyze.isPending ? "جاري قراءة الملف..." : "اسحب ملف Excel هنا أو اضغط للاختيار"}
            </span>
            <span className="max-w-md text-xs leading-relaxed text-muted-foreground">
              ‎.xlsx أو ‎.xls أو CSV — حتى 10 ميغابايت. لا تحتاج لتعديل ملفك: نتعرّف تلقائيًا على أعمدة العنوان
              والمؤلف ودار النشر والكمية والأسعار، بالعربية أو الفرنسية.
            </span>
          </button>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>لا شيء يُحفظ قبل أن تراجع المعاينة وتؤكّد.</span>
            <button type="button" onClick={() => downloadImportTemplate()} className="font-semibold text-primary hover:underline">
              تنزيل نموذج Excel جاهز
            </button>
          </div>
        </Surface>
      )}

      {/* ── 2. Map columns ── */}
      {step === "map" && analysis && opts && sheet && (
        <>
          <Surface className="space-y-4 p-5">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm">
                الملف: <span className="font-bold">{analysis.fileName}</span>
              </p>
              {analysis.sheets.length > 1 && (
                <label className="flex items-center gap-2 text-sm">
                  الورقة:
                  <select
                    className={`${selectClass} h-9 w-auto`}
                    value={opts.sheet}
                    onChange={(e) => setOpts(optionsFor(analysis, e.target.value))}
                  >
                    {analysis.sheets.map((s) => (
                      <option key={s.name} value={s.name}>
                        {s.name} ({s.totalRows} سطر){s.looksLikeCatalog ? "" : " — لا تبدو قائمة كتب"}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="flex items-center gap-2 text-sm">
                سطر العناوين:
                <select
                  className={`${selectClass} h-9 w-auto`}
                  value={opts.headerRow}
                  onChange={(e) => setOpts({ ...opts, headerRow: Number(e.target.value) })}
                >
                  <option value={0}>لا يوجد (البيانات من السطر 1)</option>
                  {sheet.firstRows.map((r, i) => (
                    <option key={i} value={i + 1}>
                      السطر {i + 1}: {r.filter(Boolean).slice(0, 3).join(" | ").slice(0, 40) || "—"}
                    </option>
                  ))}
                </select>
              </label>
              <Button variant="ghost" size="sm" onClick={reset} className="ms-auto">
                ملف آخر
              </Button>
            </div>
            {sheet.truncated && (
              <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-800">
                الورقة طويلة جدًا: تُقرأ أول 10,000 سطر فقط. قسّمها على عدة ملفات.
              </p>
            )}
          </Surface>

          <Surface className="overflow-hidden">
            <div className="border-b border-border/60 px-5 py-3">
              <p className="text-sm font-bold">ماذا يحتوي كل عمود؟</p>
              <p className="text-xs text-muted-foreground">
                تعرّفنا على الأعمدة تلقائيًا. صحّح أي عمود بالقائمة، أو اختر «تجاهل».
              </p>
            </div>
            <div className="divide-y divide-border/40">
              {sheet.columns.map((c) => {
                const field = fieldOfColumn.get(c.index) ?? "";
                const auto = c.field && c.field === field;
                return (
                  <div key={c.index} className="grid gap-2 px-5 py-3 sm:grid-cols-[3rem_1fr_14rem] sm:items-center">
                    <span className="text-xs font-bold text-muted-foreground">{c.letter}</span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{c.header || <span className="text-muted-foreground">(بدون عنوان)</span>}</p>
                      <p className="truncate text-xs text-muted-foreground" title={c.samples.join(" • ")}>
                        {c.samples.length ? c.samples.join(" • ") : "عمود فارغ"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        className={`${selectClass} h-9`}
                        value={field}
                        onChange={(e) => setColumnField(c.index, e.target.value as ImportField | "")}
                        aria-label={`محتوى العمود ${c.letter}`}
                      >
                        <option value="">تجاهل</option>
                        {analysis.fields.map((f) => (
                          <option key={f.key} value={f.key}>
                            {f.label}
                          </option>
                        ))}
                      </select>
                      {auto && (
                        <span
                          title={c.reason === "header" ? "تعرّفنا عليه من اسم العمود" : "تخمين من محتوى العمود — تأكّد منه"}
                          className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                            c.reason === "header" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {c.reason === "header" ? "تلقائي" : "تخمين"}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Surface>

          <Surface className="grid gap-4 p-5 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="font-semibold">الكتب الموجودة مسبقًا</span>
              <select className={selectClass} value={opts.existing} onChange={(e) => setOpts({ ...opts, existing: e.target.value as "update" | "skip" })}>
                <option value="update">تحديث سعرها ومخزونها من الملف</option>
                <option value="skip">تركها كما هي</option>
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-semibold">عمود الكمية يعني</span>
              <select className={selectClass} value={opts.stockMode} onChange={(e) => setOpts({ ...opts, stockMode: e.target.value as "set" | "add" })}>
                <option value="set">المخزون الحالي (جرد)</option>
                <option value="add">كمية وصلت — تُضاف للمخزون (توريد)</option>
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-semibold">تصنيف الكتب بدون تصنيف</span>
              <select
                className={selectClass}
                value={opts.defaultCategory ?? ""}
                onChange={(e) => setOpts({ ...opts, defaultCategory: e.target.value || null })}
              >
                <option value="">غير مصنف</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-semibold">حالة التوفر الافتراضية</span>
              <select
                className={selectClass}
                value={opts.defaultStatus}
                onChange={(e) => setOpts({ ...opts, defaultStatus: e.target.value as ImportOptions["defaultStatus"] })}
              >
                <option value="available">متوفر</option>
                <option value="on_request">حسب الطلب</option>
                <option value="rare">نادر</option>
              </select>
            </label>
          </Surface>

          <div className="flex items-center justify-end gap-2">
            {opts.mapping.title === undefined && <span className="text-xs text-rose-600">اختر عمود العنوان أولًا</span>}
            <Button onClick={() => runPreview.mutate()} disabled={opts.mapping.title === undefined || runPreview.isPending}>
              {runPreview.isPending ? "جاري الفحص..." : "معاينة قبل الاستيراد"}
            </Button>
          </div>
        </>
      )}

      {/* ── 3. Preview ── */}
      {step === "preview" && preview && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <SummaryCard label="كتب جديدة" value={preview.summary.create} tone="emerald" />
            <SummaryCard label="تحديث" value={preview.summary.update} tone="blue" />
            <SummaryCard label="بدون تغيير" value={preview.summary.unchanged} tone="slate" />
            <SummaryCard label="متجاهلة" value={preview.summary.skip} tone="amber" />
            <SummaryCard label="أخطاء" value={preview.summary.error} tone="rose" />
          </div>

          {(preview.issues.length > 0 || preview.newNames.authors + preview.newNames.publishers + preview.newNames.categories.length > 0) && (
            <Surface className="grid gap-4 p-5 sm:grid-cols-2">
              {preview.issues.length > 0 && (
                <div>
                  <p className="mb-2 text-sm font-bold">ملاحظات</p>
                  <ul className="space-y-1 text-sm">
                    {preview.issues.map((i) => (
                      <li key={i.code} className="flex justify-between gap-3">
                        <span>{i.message}</span>
                        <span className="font-bold tabular-nums">{i.rows}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div>
                <p className="mb-2 text-sm font-bold">سيُضاف للمتجر أيضًا</p>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>{preview.newNames.authors} مؤلف جديد</li>
                  <li>{preview.newNames.publishers} دار نشر جديدة</li>
                  <li>
                    {preview.newNames.categories.length} تصنيف جديد
                    {preview.newNames.categories.length > 0 && `: ${preview.newNames.categories.slice(0, 6).join("، ")}`}
                  </li>
                </ul>
              </div>
            </Surface>
          )}

          <Surface className="overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-4 py-3">
              {(["issues", "all", "create", "update", "skip", "error"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setRowFilter(f)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 transition-colors ${
                    rowFilter === f ? "bg-primary text-primary-foreground ring-primary" : "bg-card ring-border hover:bg-muted"
                  }`}
                >
                  {f === "issues" ? "بها ملاحظات" : f === "all" ? "الكل" : ACTION_LABEL[f]}
                </button>
              ))}
              <button
                type="button"
                onClick={() => report.mutate()}
                disabled={report.isPending}
                className="ms-auto text-xs font-semibold text-primary hover:underline disabled:opacity-50"
              >
                {report.isPending ? "جاري التجهيز..." : "تنزيل التقرير الكامل (Excel)"}
              </button>
            </div>
            <div className="max-h-[28rem] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card text-xs text-muted-foreground">
                  <tr className="border-b border-border/60">
                    <th className="px-4 py-2 text-start font-semibold">السطر</th>
                    <th className="px-2 py-2 text-start font-semibold">العنوان</th>
                    <th className="px-2 py-2 text-start font-semibold">الإجراء</th>
                    <th className="px-4 py-2 text-start font-semibold">التفاصيل</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows
                    .filter((r) => (rowFilter === "all" ? true : rowFilter === "issues" ? r.issues.length > 0 || r.action === "error" : r.action === rowFilter))
                    .map((r) => (
                      <tr key={r.row} className="border-b border-border/30 align-top last:border-0">
                        <td className="px-4 py-2 tabular-nums text-muted-foreground">{r.row}</td>
                        <td className="max-w-[16rem] truncate px-2 py-2 font-medium" title={r.title}>
                          {r.title || <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-2 py-2">
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ${ACTION_STYLE[r.action]}`}>{ACTION_LABEL[r.action]}</span>
                        </td>
                        <td className="px-4 py-2 text-xs leading-relaxed">
                          {r.issues.map((i, k) => (
                            <p key={k} className={i.level === "error" ? "text-rose-700" : "text-amber-700"}>
                              {i.message}
                            </p>
                          ))}
                          {r.changes.map((c, k) => (
                            <p key={`c${k}`} className="text-blue-700">
                              {c}
                            </p>
                          ))}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            {preview.truncatedRows && (
              <p className="border-t border-border/60 px-4 py-2 text-xs text-muted-foreground">
                تُعرض أول 300 سطر (الأسطر التي بها ملاحظات أولًا). كل الأسطر في التقرير الكامل.
              </p>
            )}
          </Surface>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button variant="secondary" onClick={() => setStep("map")}>
              رجوع لتعديل الأعمدة
            </Button>
            <Button
              onClick={() => commit.mutate()}
              disabled={commit.isPending || preview.summary.create + preview.summary.update === 0}
            >
              {commit.isPending
                ? "جاري الاستيراد..."
                : `استيراد ${preview.summary.create} جديد${preview.summary.update ? ` + ${preview.summary.update} تحديث` : ""}`}
            </Button>
          </div>
        </>
      )}

      {/* ── 4. Done ── */}
      {step === "done" && result && (
        <>
          <Surface className="space-y-2 p-5 text-center">
            <p className="text-lg font-bold text-emerald-700">تم الاستيراد بنجاح ✓</p>
            <p className="text-sm text-muted-foreground">
              {result.created} كتاب جديد • {result.updated} تحديث • {result.skipped} متجاهل • {result.errors} خطأ
            </p>
            <p className="text-xs text-muted-foreground">
              يمكنك التراجع عن هذا الاستيراد من «سجل الاستيراد» (تُحذف الكتب التي أضافها، ما لم تُطلب).
            </p>
          </Surface>
          <Surface className="p-5">
            <p className="mb-3 text-sm font-bold">ما الذي ينقص الكتب المستوردة؟</p>
            <QualityGrid quality={result.missing} />
          </Surface>
          <div className="flex justify-center gap-2">
            <Button variant="secondary" onClick={reset}>
              استيراد ملف آخر
            </Button>
            <Link to="/admin/books" className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">
              عرض الكتب
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

function Stepper({ step }: { step: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: "upload", label: "رفع الملف" },
    { key: "map", label: "مطابقة الأعمدة" },
    { key: "preview", label: "المعاينة" },
    { key: "done", label: "النتيجة" },
  ];
  const at = steps.findIndex((s) => s.key === step);
  return (
    <ol className="flex items-center gap-2 text-xs">
      {steps.map((s, i) => (
        <li key={s.key} className="flex items-center gap-2">
          <span
            className={`flex h-6 w-6 items-center justify-center rounded-full font-bold ${
              i < at ? "bg-emerald-600 text-white" : i === at ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            {i < at ? "✓" : i + 1}
          </span>
          <span className={i === at ? "font-bold" : "text-muted-foreground"}>{s.label}</span>
          {i < steps.length - 1 && <span className="h-px w-5 bg-border sm:w-10" />}
        </li>
      ))}
    </ol>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: "emerald" | "blue" | "slate" | "amber" | "rose" }) {
  const tones = {
    emerald: "text-emerald-700",
    blue: "text-blue-700",
    slate: "text-muted-foreground",
    amber: "text-amber-700",
    rose: "text-rose-700",
  };
  return (
    <Surface className="p-4 text-center">
      <p className={`text-2xl font-bold tabular-nums ${tones[tone]}`}>{value.toLocaleString("ar-DZ")}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </Surface>
  );
}
