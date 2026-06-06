import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createBook, fetchAcademicTree, uploadCover } from "@/lib/admin-api";
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
  invOn: false,
  invStatus: "available" as InventoryStatus,
  invStock: "",
  academicOn: false,
  fieldId: "",
  yearId: "",
  subjectIds: [] as string[],
};

export default function QuickAddPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [f, setF] = useState({ ...EMPTY });
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
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
    set(
      "subjectIds",
      f.subjectIds.includes(id)
        ? f.subjectIds.filter((s) => s !== id)
        : [...f.subjectIds, id],
    );
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
        imageUrl,
        inventory: f.invOn
          ? {
              status: f.invStatus,
              stock: f.invStock !== "" ? Number(f.invStock) : null,
            }
          : null,
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
              alt="غلاف"
              className="max-h-64 rounded-lg object-contain shadow-warm"
            />
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
                تغيير الصورة
              </Button>
              <Button variant="ghost" size="sm" onClick={clearPhoto}>
                إزالة
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border py-10 text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-10 w-10">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            <span className="text-sm font-semibold">التقط صورة الغلاف أو اختر من المعرض</span>
            <span className="text-xs">اختياري</span>
          </button>
        )}
      </Surface>

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

        <Field label="المؤلف" hint="اكتب الاسم — يُضاف تلقائيًا إن لم يكن موجودًا">
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
          <Field label="الدولة" hint="تُضاف تلقائيًا">
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

        <Field label="الوصف">
          <textarea
            className={textareaClass}
            value={f.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="نبذة عن الكتاب (اختياري)"
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
            <Field label="الكمية" hint="اتركها فارغة إذا غير معلومة">
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
          كتاب أكاديمي (ربطه بمادة دراسية)
        </label>

        {f.academicOn && (
          <div className="mt-3 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="التخصّص">
                <select
                  className={selectClass}
                  value={f.fieldId}
                  onChange={(e) =>
                    setF((p) => ({ ...p, fieldId: e.target.value, yearId: "" }))
                  }
                >
                  <option value="">اختر التخصّص...</option>
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

            {selectedYear && (
              <div>
                <p className="mb-1.5 text-xs font-semibold text-muted-foreground">
                  المواد (اختر واحدة أو أكثر)
                </p>
                {subjects.length === 0 ? (
                  <p className="text-xs text-muted-foreground">لا توجد مواد في هذه السنة.</p>
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
