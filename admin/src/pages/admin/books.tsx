import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createBook,
  deleteBook,
  fetchAdminBooks,
  fetchCatalog,
  updateBook,
} from "@/lib/admin-api";
import type { AdminBook, CatalogItem, InventoryStatus } from "@/lib/admin-types";
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
    queryKey: ["admin-books", search, categoryId, invStatus, page],
    queryFn: () =>
      fetchAdminBooks({
        search: search || undefined,
        categoryId: categoryId || undefined,
        inventoryStatus: invStatus || undefined,
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
                        <div className="h-12 w-9 shrink-0 overflow-hidden rounded bg-muted">
                          {b.imageUrl && <img src={b.imageUrl} alt="" className="h-full w-full object-cover" />}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{b.title}</p>
                          <p className="truncate text-xs text-muted-foreground">{b.author?.name ?? "—"}</p>
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

  const [form, setForm] = useState(() => buildForm(editing));

  useEffect(() => {
    if (open) setForm(buildForm(editing));
  }, [open, editing]);

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        title: form.title.trim(),
        categoryId: form.categoryId,
        authorId: form.authorId || null,
        publisherId: form.publisherId || null,
        countryId: form.countryId || null,
        description: form.description || null,
        year: form.year ? Number(form.year) : null,
        price: form.price ? Number(form.price) : null,
        imageUrl: form.imageUrl || null,
        inventory: form.hasInventory
          ? {
              status: form.invStatus as InventoryStatus,
              stock: form.invStock !== "" ? Number(form.invStock) : null,
            }
          : null,
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

  const isValid = form.title.trim() && form.categoryId;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "تعديل كتاب" : "كتاب جديد"}
      size="lg"
    >
      <div className="space-y-4">
        <Field label="العنوان" required>
          <input className={inputClass} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="التصنيف" required>
            <select className={selectClass} value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
              <option value="">اختر تصنيف...</option>
              {categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="المؤلف">
            <select className={selectClass} value={form.authorId} onChange={(e) => setForm({ ...form, authorId: e.target.value })}>
              <option value="">—</option>
              {authors?.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Field>
          <Field label="دار النشر">
            <select className={selectClass} value={form.publisherId} onChange={(e) => setForm({ ...form, publisherId: e.target.value })}>
              <option value="">—</option>
              {publishers?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="الدولة">
            <select className={selectClass} value={form.countryId} onChange={(e) => setForm({ ...form, countryId: e.target.value })}>
              <option value="">—</option>
              {countries?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="السنة">
            <input type="number" className={inputClass} value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} />
          </Field>
          <Field label="السعر (د.ج)">
            <input type="number" min={0} step="0.01" className={inputClass} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          </Field>
        </div>

        <Field label="رابط الصورة">
          <input className={inputClass} dir="ltr" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} />
        </Field>

        <Field label="الوصف">
          <textarea className={textareaClass} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>

        {/* Inventory toggle */}
        <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={form.hasInventory}
              onChange={(e) => setForm({ ...form, hasInventory: e.target.checked })}
              className="h-4 w-4 rounded"
            />
            تتبع المخزون
          </label>
          {form.hasInventory && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="الحالة" required>
                <select className={selectClass} value={form.invStatus} onChange={(e) => setForm({ ...form, invStatus: e.target.value as InventoryStatus })}>
                  <option value="available">متوفر</option>
                  <option value="on_request">حسب الطلب</option>
                  <option value="rare">نادر</option>
                </select>
              </Field>
              <Field label="الكمية" hint="اتركه فارغًا إذا غير معلوم">
                <input type="number" min={0} className={inputClass} value={form.invStock} onChange={(e) => setForm({ ...form, invStock: e.target.value })} />
              </Field>
            </div>
          )}
        </div>

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

function buildForm(editing: AdminBook | null) {
  return {
    title: editing?.title ?? "",
    categoryId: editing?.categoryId ?? "",
    authorId: editing?.authorId ?? "",
    publisherId: editing?.publisherId ?? "",
    countryId: editing?.countryId ?? "",
    description: editing?.description ?? "",
    year: editing?.year ? String(editing.year) : "",
    price: editing?.price ? String(editing.price) : "",
    imageUrl: editing?.imageUrl ?? "",
    hasInventory: Boolean(editing?.inventory),
    invStatus: editing?.inventory?.status ?? "available",
    invStock: editing?.inventory?.stock !== null && editing?.inventory?.stock !== undefined
      ? String(editing.inventory.stock)
      : "",
  };
}
