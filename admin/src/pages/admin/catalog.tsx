import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createCatalog,
  deleteCatalog,
  fetchCatalog,
  updateCatalog,
  type CatalogResource,
} from "@/lib/admin-api";
import type { CatalogItem } from "@/lib/admin-types";
import {
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  Modal,
  Skeleton,
  Surface,
  inputClass,
  textareaClass,
} from "@/components/admin/primitives";
import { useToast } from "@/components/admin/toaster";

const META: Record<
  CatalogResource,
  { title: string; singular: string; hasDescription: boolean }
> = {
  categories: { title: "التصنيفات", singular: "تصنيف", hasDescription: true },
  authors: { title: "المؤلفون", singular: "مؤلف", hasDescription: false },
  publishers: { title: "دور النشر", singular: "دار نشر", hasDescription: false },
  countries: { title: "الدول", singular: "دولة", hasDescription: false },
};

const TABS: { resource: CatalogResource; label: string }[] = [
  { resource: "categories", label: "التصنيفات" },
  { resource: "authors", label: "المؤلفون" },
  { resource: "publishers", label: "دور النشر" },
  { resource: "countries", label: "الدول" },
];

export default function CatalogPage() {
  const { resource } = useParams<{ resource: CatalogResource }>();
  const r: CatalogResource = (resource as CatalogResource) ?? "categories";
  const meta = META[r];

  const qc = useQueryClient();
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<CatalogItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<CatalogItem | null>(null);

  const { data, isLoading } = useQuery<CatalogItem[]>({
    queryKey: ["catalog", r],
    queryFn: () => fetchCatalog(r),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => deleteCatalog(r, id),
    onSuccess: () => {
      toast.success("تم الحذف");
      qc.invalidateQueries({ queryKey: ["catalog", r] });
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.message || "تعذّر الحذف"),
  });

  const items = (data ?? []).filter((i) =>
    search ? i.name.toLowerCase().includes(search.toLowerCase()) : true,
  );

  return (
    <div className="space-y-5">
      {/* ── Tabs ── */}
      <div className="flex flex-wrap gap-1 rounded-lg border border-border/60 bg-card p-1">
        {TABS.map((t) => (
          <Link
            key={t.resource}
            to={`/admin/catalog/${t.resource}`}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              r === t.resource
                ? "bg-primary text-primary-foreground shadow-warm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`ابحث في ${meta.title}...`}
            className={`${inputClass} pr-9`}
          />
        </div>
        <Button onClick={() => { setEditing(null); setModalOpen(true); }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3.5 w-3.5">
            <path d="M12 5v14M5 12h14" />
          </svg>
          {`إضافة ${meta.singular}`}
        </Button>
      </div>

      {/* ── List ── */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-12" />)}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title={`لا توجد ${meta.title}`}
          description={`أضف ${meta.singular} جديد لتظهر هنا.`}
          action={<Button onClick={() => { setEditing(null); setModalOpen(true); }}>{`إضافة ${meta.singular}`}</Button>}
        />
      ) : (
        <Surface className="overflow-hidden">
          <ul className="divide-y divide-border/40">
            {items.map((item) => (
              <li key={item.id} className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/30">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{item.name}</p>
                  {item.description && (
                    <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{item.description}</p>
                  )}
                </div>
                <span className="text-xs text-muted-foreground tabular-nums">{item.booksCount} كتاب</span>
                <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <Button size="sm" variant="ghost" onClick={() => { setEditing(item); setModalOpen(true); }}>
                    تعديل
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(item)}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5 text-rose-600">
                      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    </svg>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Surface>
      )}

      <CatalogFormModal
        open={modalOpen}
        editing={editing}
        resource={r}
        onClose={() => setModalOpen(false)}
        onSaved={() => {
          setModalOpen(false);
          qc.invalidateQueries({ queryKey: ["catalog", r] });
        }}
      />

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        title={`حذف ${meta.singular}؟`}
        message={`سيتم حذف "${confirmDelete?.name ?? ""}" نهائيًا.`}
        confirmLabel="حذف"
        variant="danger"
        onConfirm={() => confirmDelete && removeMutation.mutate(confirmDelete.id)}
      />
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────

function CatalogFormModal({
  open,
  editing,
  resource,
  onClose,
  onSaved,
}: {
  open: boolean;
  editing: CatalogItem | null;
  resource: CatalogResource;
  onClose: () => void;
  onSaved: () => void;
}) {
  const meta = META[resource];
  const toast = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (open) {
      setName(editing?.name ?? "");
      setDescription(editing?.description ?? "");
    }
  }, [open, editing]);

  const mutation = useMutation({
    mutationFn: () => {
      const payload = { name: name.trim(), description: description || undefined };
      return editing
        ? updateCatalog(resource, editing.id, payload)
        : createCatalog(resource, payload);
    },
    onSuccess: () => {
      toast.success(editing ? "تم التحديث" : "تمت الإضافة");
      onSaved();
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.message || "تعذّر الحفظ"),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? `تعديل ${meta.singular}` : `${meta.singular} جديد`}
      size="sm"
    >
      <div className="space-y-3">
        <Field label="الاسم" required>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
        {meta.hasDescription && (
          <Field label="الوصف">
            <textarea className={textareaClass} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
        )}
        <div className="flex justify-end gap-2 border-t border-border/60 pt-3">
          <Button variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button onClick={() => mutation.mutate()} disabled={!name.trim() || mutation.isPending}>
            {mutation.isPending ? "جاري الحفظ..." : "حفظ"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
