import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createBook,
  deleteBook,
  fetchAcademicTree,
  fetchAdminBooks,
  fetchCatalog,
  updateBook,
} from "@/lib/admin-api";
import type {
  AcademicField,
  AdminBook,
  CatalogItem,
  InventoryStatus,
  UpsertBookPayload,
} from "@/lib/admin-types";
import {
  MultiRefSelect,
  type RefEntry,
} from "@/components/admin/multi-ref-select";
import {
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  Modal,
  Pagination,
  StatusBadge,
  Surface,
  TableSkeleton,
  inputClass,
  selectClass,
  textareaClass,
} from "@/components/admin/primitives";
import { useToast } from "@/components/admin/toaster";
import GalleryEditor, {
  galleryFromUrls,
  uploadGallery,
} from "@/components/admin/gallery-editor";
import { Thumb } from "@/components/admin/thumb";

const MISSING_LABEL: Record<string, string> = {
  price: "بدون سعر بيع",
  cover: "بدون صورة غلاف",
  author: "بدون مؤلف",
  category: "بدون تصنيف",
  stock: "بدون كمية مخزون",
  outOfStock: "التي نفدت كميتها",
};

const INV_LABEL: Record<InventoryStatus, string> = {
  available: "متوفر",
  on_request: "حسب الطلب",
  rare: "نادر",
};

export default function BooksAdminPage() {
  const qc = useQueryClient();
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [invStatus, setInvStatus] = useState("");
  const [page, setPage] = useState(1);
  // Opened from "data quality": show only books missing something.
  const [params, setParams] = useSearchParams();
  const missing = params.get("missing") ?? "";

  const [editing, setEditing] = useState<AdminBook | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<AdminBook | null>(null);

  const { data: catalogData } = useQuery<CatalogItem[]>({
    queryKey: ["catalog", "categories"],
    queryFn: () => fetchCatalog("categories"),
  });

  const { data, isLoading } = useQuery<{
    books: AdminBook[];
    total: number;
  }>({
    queryKey: ["admin-books", search, categoryId, invStatus, missing, page],
    queryFn: () =>
      fetchAdminBooks({
        search: search || undefined,
        categoryId: categoryId || undefined,
        inventoryStatus: invStatus || undefined,
        missing: missing || undefined,
        page,
        pageSize: 25,
      }),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => deleteBook(id),
    onSuccess: () => {
      toast.success("تم حذف الكتاب");
      qc.invalidateQueries({ queryKey: ["admin-books"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.message || "تعذّر الحذف"),
  });

  const books = data?.books ?? [];

  return (
    <div className="space-y-5">
      {missing && (
        <div className="flex items-center justify-between gap-3 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-900">
          <span>
            عرض الكتب {MISSING_LABEL[missing] ?? "الناقصة"} فقط — أكملها من زر «تعديل».
          </span>
          <button
            type="button"
            onClick={() => { params.delete("missing"); setParams(params, { replace: true }); setPage(1); }}
            className="text-xs font-semibold underline"
          >
            عرض كل الكتب
          </button>
        </div>
      )}
      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
          </svg>
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="ابحث بالعنوان أو المؤلف..."
            className={`${inputClass} pr-9`}
          />
        </div>
        <select
          value={categoryId}
          onChange={(e) => { setCategoryId(e.target.value); setPage(1); }}
          className={`${selectClass} h-10 w-auto`}
        >
          <option value="">كل التصنيفات</option>
          {catalogData?.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={invStatus}
          onChange={(e) => { setInvStatus(e.target.value); setPage(1); }}
          className={`${selectClass} h-10 w-auto`}
        >
          <option value="">كل حالات المخزون</option>
          <option value="available">متوفر</option>
          <option value="on_request">حسب الطلب</option>
          <option value="rare">نادر</option>
        </select>

        <Button
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
          className="ms-auto"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3.5 w-3.5">
            <path d="M12 5v14M5 12h14" />
          </svg>
          كتاب جديد
        </Button>
      </div>

      {/* ── Table ── */}
      {isLoading ? (
        <TableSkeleton rows={6} cols={5} />
      ) : books.length === 0 ? (
        <EmptyState
          title="لا توجد كتب"
          description="ابدأ بإضافة كتاب جديد إلى المتجر."
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" className="h-7 w-7">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
            </svg>
          }
          action={<Button onClick={() => { setEditing(null); setModalOpen(true); }}>إضافة كتاب</Button>}
        />
      ) : (
        <>
          <Surface className="overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-muted/40 text-xs">
                  <th className="px-4 py-3 text-right font-semibold text-muted-foreground">الكتاب</th>
                  <th className="px-4 py-3 text-right font-semibold text-muted-foreground">التصنيف</th>
                  <th className="px-4 py-3 text-right font-semibold text-muted-foreground">السعر</th>
                  <th className="px-4 py-3 text-right font-semibold text-muted-foreground">المخزون</th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {books.map((b) => (
                  <tr key={b.id} className="border-b border-border/40 last:border-0 transition-colors hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="relative h-12 w-9 shrink-0 overflow-hidden rounded bg-muted">
                          <Thumb src={b.imageUrl} thumb={b.thumbUrl} />
                          {(b.images?.length ?? 0) > 1 && (
                            <span
                              className="absolute bottom-0 inset-x-0 bg-black/60 text-center text-[9px] font-bold leading-4 text-white"
                              title={`${b.images!.length} صور`}
                            >
                              {b.images!.length}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{b.title}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {b.authors?.length
                              ? b.authors.map((a) => a.name).join("، ")
                              : "—"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{b.category?.name ?? "—"}</td>
                    <td className="px-4 py-3 font-bold tabular-nums">
                      {b.price ? `${Number(b.price).toLocaleString("ar-DZ")} د.ج` : <span className="text-xs text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {b.inventory ? (
                        <div className="flex items-center gap-2">
                          <StatusBadge status={b.inventory.status} label={INV_LABEL[b.inventory.status]} />
                          {b.inventory.stock !== null && (
                            <span className="text-xs text-muted-foreground">{b.inventory.stock}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-left">
                      <div className="inline-flex items-center gap-1">
                        <Button size="sm" variant="ghost" onClick={() => { setEditing(b); setModalOpen(true); }}>
                          تعديل
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(b)}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5 text-rose-600">
                            <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                          </svg>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Surface>

          <Pagination page={page} pageSize={25} total={data?.total ?? 0} onChange={setPage} />
        </>
      )}

      <BookFormModal
        open={modalOpen}
        editing={editing}
        onClose={() => setModalOpen(false)}
        onSaved={() => {
          setModalOpen(false);
          qc.invalidateQueries({ queryKey: ["admin-books"] });
          qc.invalidateQueries({ queryKey: ["admin-stats"] });
        }}
      />

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        title="حذف الكتاب؟"
        message={`سيتم حذف "${confirmDelete?.title ?? ""}" نهائيًا.`}
        confirmLabel="حذف"
        variant="danger"
        onConfirm={() => confirmDelete && removeMutation.mutate(confirmDelete.id)}
      />
    </div>
  );
}

// ── Book form modal ───────────────────────────────────────

function BookFormModal({
  open,
  editing,
  onClose,
  onSaved,
}: {
  open: boolean;
  editing: AdminBook | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();

  const { data: categories } = useQuery<CatalogItem[]>({
    queryKey: ["catalog", "categories"],
    queryFn: () => fetchCatalog("categories"),
    enabled: open,
  });
  const { data: authors } = useQuery<CatalogItem[]>({
    queryKey: ["catalog", "authors"],
    queryFn: () => fetchCatalog("authors"),
    enabled: open,
  });
  const { data: publishers } = useQuery<CatalogItem[]>({
    queryKey: ["catalog", "publishers"],
    queryFn: () => fetchCatalog("publishers"),
    enabled: open,
  });
  const { data: countries } = useQuery<CatalogItem[]>({
    queryKey: ["catalog", "countries"],
    queryFn: () => fetchCatalog("countries"),
    enabled: open,
  });

  const { data: tree = [] } = useQuery<AcademicField[]>({
    queryKey: ["academic-tree"],
    queryFn: () => fetchAcademicTree(),
    enabled: open,
  });

  const [form, setForm] = useState(() => buildForm(editing));
  const [fieldId, setFieldId] = useState("");
  const [yearId, setYearId] = useState("");

  useEffect(() => {
    if (open) {
      setForm(buildForm(editing));
      setFieldId("");
      setYearId("");
    }
  }, [open, editing]);

  // In edit mode, open the browser on whatever the book is already attached to,
  // at whichever depth that link sits.
  useEffect(() => {
    if (!open || fieldId || tree.length === 0) return;

    const linkedField = form.fieldIds[0];
    if (linkedField) {
      setFieldId(linkedField);
      return;
    }

    const linkedYear = form.yearIds[0];
    if (linkedYear) {
      const f = tree.find((x) => x.years.some((y) => y.id === linkedYear));
      if (f) {
        setFieldId(f.id);
        setYearId(linkedYear);
        return;
      }
    }

    const linkedSubject = form.subjectIds[0];
    if (linkedSubject) {
      for (const f of tree)
        for (const y of f.years)
          if (y.subjects.some((sub) => sub.id === linkedSubject)) {
            setFieldId(f.id);
            setYearId(y.id);
            return;
          }
    }
  }, [open, tree, form.fieldIds, form.yearIds, form.subjectIds, fieldId]);

  const selectedField = tree.find((x) => x.id === fieldId);
  const years = selectedField?.years ?? [];
  const selectedYear = years.find((y) => y.id === yearId);
  const subjects = selectedYear?.subjects ?? [];

  // id → readable label, for the summary of everything currently linked.
  const linkLabels = useMemo(() => {
    const m = new Map<string, string>();
    for (const f of tree) {
      m.set(f.id, `${f.name} (كل التخصص)`);
      for (const y of f.years) {
        m.set(y.id, `${f.name} — ${y.name} (كل السنة)`);
        for (const sub of y.subjects) m.set(sub.id, `${y.name} — ${sub.name}`);
      }
    }
    return m;
  }, [tree]);

  type LinkKey = "fieldIds" | "yearIds" | "subjectIds";
  const toggleLink = (key: LinkKey, id: string) =>
    setForm((prev) => {
      const current = prev[key];
      const next = current.includes(id)
        ? current.filter((x) => x !== id)
        : [...current, id];
      return { ...prev, [key]: next };
    });

  const allLinks: { key: LinkKey; id: string }[] = [
    ...form.fieldIds.map((id) => ({ key: "fieldIds" as LinkKey, id })),
    ...form.yearIds.map((id) => ({ key: "yearIds" as LinkKey, id })),
    ...form.subjectIds.map((id) => ({ key: "subjectIds" as LinkKey, id })),
  ];

  const mutation = useMutation({
    mutationFn: async () => {
      const payload: UpsertBookPayload = {
        title: form.title.trim(),
        categoryId: form.categoryId,
        // Names are sent in the chosen order. Author/publisher names are unique,
        // so the backend reuses existing rows and creates only genuinely new
        // ones, while preserving this order.
        authorNames: form.authors.map((a) => a.name),
        publisherNames: form.publishers.map((pub) => pub.name),
        countryId: form.countryId || null,
        description: form.description.trim() || null,
        notes: form.notes.trim() || null,
        year: form.year ? Number(form.year) : null,
        price: form.price ? Number(form.price) : null,
        costPrice: form.costPrice ? Number(form.costPrice) : null,
        imageUrls: await uploadGallery(form.pictures),
        inventory: form.hasInventory
          ? {
              status: form.invStatus as InventoryStatus,
              stock: form.invStock !== "" ? Number(form.invStock) : null,
            }
          : null,
        // These replace the stored sets; clearing the toggle clears the links.
        fieldIds: form.academicOn ? form.fieldIds : [],
        yearIds: form.academicOn ? form.yearIds : [],
        subjectIds: form.academicOn ? form.subjectIds : [],
      };
      return editing ? updateBook(editing.id, payload) : createBook(payload);
    },
    onSuccess: () => {
      toast.success(editing ? "تم تحديث الكتاب" : "تمت إضافة الكتاب");
      onSaved();
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.message || "تعذّر الحفظ"),
  });

  // Guards the failure this form used to allow silently: ticking "academic",
  // choosing a speciality, then saving with nothing actually linked.
  const academicIncomplete = form.academicOn && allLinks.length === 0;
  const isValid =
    Boolean(form.title.trim() && form.categoryId) && !academicIncomplete;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "تعديل كتاب" : "كتاب جديد"}
      size="lg"
    >
      <div className="space-y-4">
        <Field label="العنوان" required>
          <input
            className={inputClass}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="التصنيف" required>
            <select
              className={selectClass}
              value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
            >
              <option value="">اختر تصنيفًا...</option>
              {categories?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="بلد النشر">
            <select
              className={selectClass}
              value={form.countryId}
              onChange={(e) => setForm({ ...form, countryId: e.target.value })}
            >
              <option value="">—</option>
              {countries?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="سنة النشر">
            <input
              type="number"
              className={inputClass}
              value={form.year}
              onChange={(e) => setForm({ ...form, year: e.target.value })}
            />
          </Field>
          <Field label="السعر (د.ج)">
            <input
              type="number"
              min={0}
              step="0.01"
              className={inputClass}
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
            />
          </Field>
          <Field label="سعر الشراء (د.ج)" hint="لا يظهر للزبائن — لحساب الأرباح وقيمة المخزون.">
            <input
              type="number"
              min={0}
              step="0.01"
              className={inputClass}
              value={form.costPrice}
              onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
            />
          </Field>
        </div>

        <Field
          label="المؤلفون"
          hint="يمكن إضافة أكثر من مؤلف. الأول في القائمة هو المؤلف الرئيسي."
        >
          <MultiRefSelect
            options={authors}
            value={form.authors}
            onChange={(next) => setForm({ ...form, authors: next })}
            pickLabel="اختر مؤلفًا من القائمة..."
            newPlaceholder="أو اكتب اسم مؤلف جديد"
            emptyLabel="لم تتم إضافة أي مؤلف بعد."
          />
        </Field>

        <Field
          label="دور النشر"
          hint="يمكن إضافة أكثر من دار نشر عند وجود طبعة مشتركة."
        >
          <MultiRefSelect
            options={publishers}
            value={form.publishers}
            onChange={(next) => setForm({ ...form, publishers: next })}
            pickLabel="اختر دار نشر من القائمة..."
            newPlaceholder="أو اكتب اسم دار نشر جديدة"
            emptyLabel="لم تتم إضافة أي دار نشر بعد."
          />
        </Field>

        <Field
          label="الصور"
          hint="الأولى هي الغلاف. للسلاسل (شروح، موسوعات...) أضف صورة لكل جزء."
        >
          <GalleryEditor
            items={form.pictures}
            onChange={(pictures) => setForm((prev) => ({ ...prev, pictures }))}
            allowLink
          />
        </Field>

        <Field
          label="نبذة عن الكتاب"
          hint="تعريف بمضمون الكتاب، يظهر للزبون في صفحة الكتاب تحت عنوان «عن الكتاب»."
        >
          <textarea
            className={textareaClass}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </Field>

        <Field
          label="معلومات إضافية"
          hint="تفاصيل لا يوضّحها العنوان: رقم الطبعة، عدد الأجزاء، نوع التجليد، حالة النسخة، اسم السلسلة..."
        >
          <textarea
            className={textareaClass}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </Field>

        {/* Inventory toggle */}
        <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={form.hasInventory}
              onChange={(e) =>
                setForm({ ...form, hasInventory: e.target.checked })
              }
              className="h-4 w-4 rounded"
            />
            تتبّع المخزون
          </label>
          {form.hasInventory && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="الحالة" required>
                <select
                  className={selectClass}
                  value={form.invStatus}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      invStatus: e.target.value as InventoryStatus,
                    })
                  }
                >
                  <option value="available">متوفر</option>
                  <option value="on_request">حسب الطلب</option>
                  <option value="rare">نادر</option>
                </select>
              </Field>
              <Field label="الكمية" hint="اتركها فارغة إذا كانت غير معروفة.">
                <input
                  type="number"
                  min={0}
                  className={inputClass}
                  value={form.invStock}
                  onChange={(e) =>
                    setForm({ ...form, invStock: e.target.value })
                  }
                />
              </Field>
            </div>
          )}
        </div>

        {/* Academic placement — speciality, year, or subject */}
        <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={form.academicOn}
              onChange={(e) =>
                setForm({ ...form, academicOn: e.target.checked })
              }
              className="h-4 w-4 rounded"
            />
            كتاب أكاديمي (ربطه بالتخصصات الدراسية)
          </label>

          {form.academicOn && (
            <div className="mt-3 space-y-3">
              <p className="rounded-lg bg-background/60 px-2.5 py-2 text-xs leading-relaxed text-muted-foreground">
                يمكنك ربط الكتاب بتخصص كامل، أو بسنة كاملة، أو بمواد محدّدة.
                الكتاب يظهر في قسم «الكتب الأكاديمية» عند أي مستوى تختاره.
              </p>

              <Field label="التخصص">
                <select
                  className={selectClass}
                  value={fieldId}
                  onChange={(e) => {
                    setFieldId(e.target.value);
                    setYearId("");
                  }}
                >
                  <option value="">اختر التخصص...</option>
                  {tree.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
              </Field>

              {selectedField && (
                <LinkToggle
                  checked={form.fieldIds.includes(selectedField.id)}
                  onChange={() => toggleLink("fieldIds", selectedField.id)}
                  title={`ربط الكتاب بتخصص «${selectedField.name}» كاملًا`}
                  hint="يظهر لكل طلبة هذا التخصص مهما كانت السنة أو المادة."
                />
              )}

              {selectedField && (
                <Field label="السنة">
                  <select
                    className={selectClass}
                    value={yearId}
                    onChange={(e) => setYearId(e.target.value)}
                  >
                    <option value="">اختر السنة...</option>
                    {years.map((y) => (
                      <option key={y.id} value={y.id}>
                        {y.name}
                      </option>
                    ))}
                  </select>
                </Field>
              )}

              {selectedYear && (
                <LinkToggle
                  checked={form.yearIds.includes(selectedYear.id)}
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
                      لا توجد مواد مسجّلة في هذه السنة. يمكنك ربط الكتاب بالسنة
                      أو بالتخصص من الخيارات أعلاه، أو إضافة المواد أولًا من
                      صفحة «الأقسام الأكاديمية».
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {subjects.map((sub) => {
                        const on = form.subjectIds.includes(sub.id);
                        return (
                          <button
                            key={sub.id}
                            type="button"
                            onClick={() => toggleLink("subjectIds", sub.id)}
                            className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition-colors ${
                              on
                                ? "bg-primary text-primary-foreground ring-primary"
                                : "bg-background text-muted-foreground ring-border hover:bg-muted"
                            }`}
                          >
                            {sub.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {allLinks.length > 0 && (
                <div className="rounded-lg bg-muted/30 p-2.5">
                  <p className="mb-1.5 text-[11px] font-semibold text-muted-foreground">
                    الارتباطات المختارة ({allLinks.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {allLinks.map(({ key, id }) => (
                      <span
                        key={`${key}-${id}`}
                        className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary"
                      >
                        {linkLabels.get(id) ?? "..."}
                        <button
                          type="button"
                          onClick={() => toggleLink(key, id)}
                          aria-label="إزالة"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            className="h-3 w-3"
                          >
                            <path d="M18 6 6 18M6 6l12 12" />
                          </svg>
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {academicIncomplete && (
                <p className="rounded-lg bg-rose-500/10 px-2.5 py-2 text-xs font-medium text-rose-700">
                  اخترت أن الكتاب أكاديمي دون ربطه بأي تخصص أو سنة أو مادة. اختر
                  ارتباطًا واحدًا على الأقل، أو ألغِ خيار «كتاب أكاديمي».
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-border/60 pt-4">
          <Button variant="ghost" onClick={onClose}>
            إلغاء
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!isValid || mutation.isPending}
          >
            {mutation.isPending ? "جاري الحفظ..." : "حفظ"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/** A labelled checkbox row used for the speciality/year "attach whole" options. */
function LinkToggle({
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

function buildForm(editing: AdminBook | null) {
  const toEntries = (list?: { id: string; name: string }[]): RefEntry[] =>
    (list ?? []).map((r) => ({ id: r.id, name: r.name }));

  const fieldIds = editing?.fields?.map((f) => f.id) ?? [];
  const yearIds = editing?.years?.map((y) => y.id) ?? [];
  const subjectIds = editing?.subjects?.map((sub) => sub.id) ?? [];

  return {
    title: editing?.title ?? "",
    categoryId: editing?.categoryId ?? "",
    authors: toEntries(editing?.authors),
    publishers: toEntries(editing?.publishers),
    countryId: editing?.countryId ?? "",
    description: editing?.description ?? "",
    notes: editing?.notes ?? "",
    year: editing?.year ? String(editing.year) : "",
    price: editing?.price ? String(editing.price) : "",
    costPrice: editing?.costPrice ? String(editing.costPrice) : "",
    pictures: galleryFromUrls(
      editing?.images?.length ? editing.images : editing?.imageUrl ? [editing.imageUrl] : [],
    ),
    hasInventory: Boolean(editing?.inventory),
    invStatus: editing?.inventory?.status ?? "available",
    invStock:
      editing?.inventory?.stock !== null &&
      editing?.inventory?.stock !== undefined
        ? String(editing.inventory.stock)
        : "",
    academicOn: fieldIds.length + yearIds.length + subjectIds.length > 0,
    fieldIds,
    yearIds,
    subjectIds,
  };
}
