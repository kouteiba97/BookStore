import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createBook, fetchAcademicTree, uploadCover } from "@/lib/admin-api";
import CoverScanner from "@/components/admin/cover-scanner";
import type { AcademicField, InventoryStatus } from "@/lib/admin-types";
import {
  Button,
  Field,
  inputClass,
  selectClass,
  Surface,
  textareaClass,
} from "@/components/admin/primitives";
import { CatalogCombo } from "@/components/admin/catalog-combo";
import { useToast } from "@/components/admin/toaster";

const INV_OPTIONS: { value: InventoryStatus; label: string }[] = [
  { value: "available", label: "متوفر" },
  { value: "on_request", label: "حسب الطلب" },
  { value: "rare", label: "نادر" },
];

const EMPTY = {
  title: "",
  category: { id: "", name: "" },
  author: { id: "", name: "" },
  publisher: { id: "", name: "" },
  country: { id: "", name: "" },
  year: "",
  price: "",
  description: "",
  notes: "",
  invOn: false,
  invStatus: "available" as InventoryStatus,
  invStock: "",
  academicOn: false,
  // Browsing position in the academic tree (not saved directly).
  fieldId: "",
  yearId: "",
  // What the book actually gets linked to — any depth, any combination.
  fieldIds: [] as string[],
  yearIds: [] as string[],
  subjectIds: [] as string[],
};

export default function QuickAddPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [f, setF] = useState({ ...EMPTY });
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);

  /** Receives the rectified, cleaned-up cover from the scanner. */
  function acceptScan(file: File) {
    if (preview) URL.revokeObjectURL(preview);
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
  }
  const [savedCount, setSavedCount] = useState(0);

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) =>
    setF((prev) => ({ ...prev, [k]: v }));

  const { data: tree = [] } = useQuery<AcademicField[]>({
    queryKey: ["academic-tree"],
    queryFn: () => fetchAcademicTree(),
    enabled: f.academicOn,
  });

  // Academic derived lists
  const selectedField = tree.find((x) => x.id === f.fieldId);
  const years = selectedField?.years ?? [];
  const selectedYear = years.find((y) => y.id === f.yearId);
  const subjects = selectedYear?.subjects ?? [];

  // id -> name map for the "selected subjects" chips (across all years)
  const subjectNames = useMemo(() => {
    const m = new Map<string, string>();
    for (const field of tree)
      for (const y of field.years)
        for (const s of y.subjects) m.set(s.id, s.name);
    return m;
  }, [tree]);

  function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (preview) URL.revokeObjectURL(preview);
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
  }

  function clearPhoto() {
    if (preview) URL.revokeObjectURL(preview);
    setPhoto(null);
    setPreview("");
    if (fileRef.current) fileRef.current.value = "";
  }

  function reset() {
    setF({ ...EMPTY });
    clearPhoto();
  }

  function toggleSubject(id: string) {
    toggleLink("subjectIds", id);
  }

  /** Attach / detach the book at any depth of the academic tree. */
  function toggleLink(key: "fieldIds" | "yearIds" | "subjectIds", id: string) {
    setF((p) => {
      const current = p[key];
      const next = current.includes(id)
        ? current.filter((x) => x !== id)
        : [...current, id];
      return { ...p, [key]: next };
    });
  }

  const save = useMutation({
    mutationFn: async () => {
      let imageUrl: string | null = null;
      if (photo) imageUrl = (await uploadCover(photo)).url;

      return createBook({
        title: f.title.trim(),
        categoryId: f.category.id || null,
        categoryName: f.category.name.trim() || null,
        authorId: f.author.id || null,
        authorName: f.author.name.trim() || null,
        publisherId: f.publisher.id || null,
        publisherName: f.publisher.name.trim() || null,
        countryId: f.country.id || null,
        countryName: f.country.name.trim() || null,
        year: f.year ? Number(f.year) : null,
        price: f.price ? Number(f.price) : null,
        description: f.description.trim() || null,
        notes: f.notes.trim() || null,
        imageUrl,
        inventory: f.invOn
          ? {
              status: f.invStatus,
              stock: f.invStock !== "" ? Number(f.invStock) : null,
            }
          : null,
        fieldIds: f.academicOn ? f.fieldIds : [],
        yearIds: f.academicOn ? f.yearIds : [],
        subjectIds: f.academicOn ? f.subjectIds : [],
      });
    },
    onSuccess: () => {
      toast.success("تمت إضافة الكتاب ✓");
      setSavedCount((c) => c + 1);
      qc.invalidateQueries({ queryKey: ["admin-books"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      reset();
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message || "تعذّر حفظ الكتاب"),
  });

  const canSave = f.title.trim().length > 0 && !save.isPending;

  return (
    <div className="mx-auto max-w-xl space-y-4 pb-24">
      {savedCount > 0 && (
        <div className="rounded-lg bg-emerald-50 px-3 py-2 text-center text-sm font-semibold text-emerald-700 ring-1 ring-emerald-200">
          تمت إضافة {savedCount} كتاب في هذه الجلسة
        </div>
      )}

      {/* ── Photo ── */}
      <Surface className="p-4">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={onPickPhoto}
        />
        {preview ? (
          <div className="flex flex-col items-center gap-3">
            <img
              src={preview}
              alt="غلاف الكتاب"
              className="max-h-64 rounded-lg object-contain shadow-warm"
            />
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => setScannerOpen(true)}>
                إعادة المسح
              </Button>
              <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()}>
                صورة عادية
              </Button>
              <Button variant="ghost" size="sm" onClick={clearPhoto}>
                إزالة
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setScannerOpen(true)}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border py-10 text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-10 w-10">
                <path d="M3 8V6a2 2 0 0 1 2-2h2M17 4h2a2 2 0 0 1 2 2v2M21 16v2a2 2 0 0 1-2 2h-2M7 20H5a2 2 0 0 1-2-2v-2" />
                <rect x="7.5" y="7.5" width="9" height="9" rx="1" />
              </svg>
              <span className="text-sm font-semibold">مسح غلاف الكتاب</span>
              <span className="text-xs">اقتصاص وتعديل الميلان تلقائيًا</span>
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="text-center text-xs text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
            >
              أو التقط صورة عادية بدون مسح
            </button>
          </div>
        )}
      </Surface>

      <CoverScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDone={acceptScan}
      />

      {/* ── Core fields ── */}
      <Surface className="space-y-4 p-4">
        <Field label="العنوان" required>
          <input
            className={inputClass}
            value={f.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="عنوان الكتاب"
            autoFocus
          />
        </Field>

        <Field label="التصنيف" hint="اتركه فارغًا ليُحفظ ضمن «غير مصنف»">
          <CatalogCombo
            resource="categories"
            value={f.category}
            onChange={(v) => set("category", v)}
            placeholder="اكتب تصنيفًا (يُضاف تلقائيًا إن كان جديدًا)"
          />
        </Field>

        <Field label="المؤلف" hint="اكتب الاسم — يُضاف تلقائيًا إن لم يكن موجودًا. لإضافة عدة مؤلفين استعمل صفحة «الكتب».">
          <CatalogCombo
            resource="authors"
            value={f.author}
            onChange={(v) => set("author", v)}
            placeholder="اسم المؤلف"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="دار النشر" hint="تُضاف تلقائيًا">
            <CatalogCombo
              resource="publishers"
              value={f.publisher}
              onChange={(v) => set("publisher", v)}
              placeholder="دار النشر"
            />
          </Field>
          <Field label="بلد النشر" hint="تُضاف تلقائيًا">
            <CatalogCombo
              resource="countries"
              value={f.country}
              onChange={(v) => set("country", v)}
              placeholder="بلد النشر"
            />
          </Field>
          <Field label="سنة النشر">
            <input
              type="number"
              inputMode="numeric"
              className={inputClass}
              value={f.year}
              onChange={(e) => set("year", e.target.value)}
              placeholder="مثال: 2019"
            />
          </Field>
          <Field label="السعر (د.ج)">
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              className={inputClass}
              value={f.price}
              onChange={(e) => set("price", e.target.value)}
              placeholder="السعر"
            />
          </Field>
        </div>

        <Field
          label="نبذة عن الكتاب"
          hint="تعريف بمضمون الكتاب، يظهر للزبون في صفحة الكتاب."
        >
          <textarea
            className={textareaClass}
            value={f.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="تعريف مختصر بموضوع الكتاب (اختياري)"
          />
        </Field>

        <Field
          label="معلومات إضافية"
          hint="تفاصيل لا يوضّحها العنوان: الطبعة، عدد الأجزاء، التجليد، حالة النسخة..."
        >
          <textarea
            className={textareaClass}
            value={f.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="مثال: الطبعة الثانية، 4 أجزاء، تجليد فني (اختياري)"
          />
        </Field>
      </Surface>

      {/* ── Inventory ── */}
      <Surface className="p-4">
        <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            checked={f.invOn}
            onChange={(e) => set("invOn", e.target.checked)}
            className="h-4 w-4 rounded"
          />
          تتبّع المخزون
        </label>
        {f.invOn && (
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <Field label="الحالة">
              <select
                className={selectClass}
                value={f.invStatus}
                onChange={(e) => set("invStatus", e.target.value as InventoryStatus)}
              >
                {INV_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </Field>
            <Field label="الكمية" hint="اتركها فارغة إذا كانت غير معروفة">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                className={inputClass}
                value={f.invStock}
                onChange={(e) => set("invStock", e.target.value)}
              />
            </Field>
          </div>
        )}
      </Surface>

      {/* ── Academic ── */}
      <Surface className="p-4">
        <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            checked={f.academicOn}
            onChange={(e) => set("academicOn", e.target.checked)}
            className="h-4 w-4 rounded"
          />
          كتاب أكاديمي (ربطه بالتخصصات الدراسية)
        </label>

        {f.academicOn && (
          <div className="mt-3 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="التخصص">
                <select
                  className={selectClass}
                  value={f.fieldId}
                  onChange={(e) =>
                    setF((p) => ({ ...p, fieldId: e.target.value, yearId: "" }))
                  }
                >
                  <option value="">اختر التخصص...</option>
                  {tree.map((x) => (
                    <option key={x.id} value={x.id}>{x.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="السنة">
                <select
                  className={selectClass}
                  value={f.yearId}
                  disabled={!f.fieldId}
                  onChange={(e) => set("yearId", e.target.value)}
                >
                  <option value="">اختر السنة...</option>
                  {years.map((y) => (
                    <option key={y.id} value={y.id}>{y.name}</option>
                  ))}
                </select>
              </Field>
            </div>

            {selectedField && (
              <QuickLinkToggle
                checked={f.fieldIds.includes(selectedField.id)}
                onChange={() => toggleLink("fieldIds", selectedField.id)}
                title={`ربط الكتاب بتخصص «${selectedField.name}» كاملًا`}
                hint="يظهر لكل طلبة هذا التخصص مهما كانت السنة أو المادة."
              />
            )}

            {selectedYear && (
              <QuickLinkToggle
                checked={f.yearIds.includes(selectedYear.id)}
                onChange={() => toggleLink("yearIds", selectedYear.id)}
                title={`ربط الكتاب بسنة «${selectedYear.name}» كاملة`}
                hint="يظهر لكل طلبة هذه السنة مهما كانت المادة."
              />
            )}

            {selectedYear && (
              <div>
                <p className="mb-1.5 text-xs font-semibold text-muted-foreground">
                  المواد (اختر واحدة أو أكثر)
                </p>
                {subjects.length === 0 ? (
                  <p className="rounded-lg bg-amber-500/10 px-2.5 py-2 text-xs leading-relaxed text-amber-800">
                    لا توجد مواد مسجّلة في هذه السنة. يمكنك ربط الكتاب بالسنة أو
                    بالتخصص من الخيارات أعلاه.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {subjects.map((s) => {
                      const on = f.subjectIds.includes(s.id);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => toggleSubject(s.id)}
                          className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition-colors ${
                            on
                              ? "bg-primary text-primary-foreground ring-primary"
                              : "bg-background text-muted-foreground ring-border hover:bg-muted"
                          }`}
                        >
                          {s.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {f.subjectIds.length > 0 && (
              <div className="rounded-lg bg-muted/30 p-2.5">
                <p className="mb-1.5 text-[11px] font-semibold text-muted-foreground">
                  المواد المختارة ({f.subjectIds.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {f.subjectIds.map((id) => (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary"
                    >
                      {subjectNames.get(id) ?? "…"}
                      <button type="button" onClick={() => toggleSubject(id)} aria-label="إزالة">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3 w-3">
                          <path d="M18 6 6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Surface>

      {/* ── Sticky save bar ── */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border/60 bg-background/95 p-3 backdrop-blur-sm lg:pr-64">
        <div className="mx-auto flex max-w-xl items-center gap-2">
          <Button variant="ghost" onClick={reset} disabled={save.isPending}>
            تفريغ
          </Button>
          <Button className="flex-1" onClick={() => save.mutate()} disabled={!canSave}>
            {save.isPending ? "جاري الحفظ..." : "حفظ وإضافة كتاب آخر"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Compact labelled checkbox for the speciality / year attach options. */
function QuickLinkToggle({
  checked,
  onChange,
  title,
  hint,
}: {
  checked: boolean;
  onChange: () => void;
  title: string;
  hint: string;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 transition-colors ${
        checked
          ? "border-primary/40 bg-primary/5"
          : "border-border/60 bg-background/60 hover:bg-muted/40"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="mt-0.5 h-4 w-4 shrink-0 rounded"
      />
      <span className="min-w-0">
        <span className="block text-xs font-semibold">{title}</span>
        <span className="mt-0.5 block text-[11px] text-muted-foreground">
          {hint}
        </span>
      </span>
    </label>
  );
}
