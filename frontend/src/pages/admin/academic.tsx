import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createField,
  createSubject,
  createYear,
  deleteField,
  deleteSubject,
  deleteYear,
  fetchAcademicTree,
  updateField,
  updateSubject,
  updateYear,
} from "@/lib/admin-api";
import type { AcademicField, AcademicSubject, AcademicYear } from "@/lib/admin-types";
import {
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  Modal,
  Skeleton,
  Surface,
  inputClass,
} from "@/components/admin/primitives";
import { useToast } from "@/components/admin/toaster";

type Mode =
  | { kind: "create-field" }
  | { kind: "edit-field"; item: AcademicField }
  | { kind: "create-year"; fieldId: string; fieldName: string }
  | { kind: "edit-year"; item: AcademicYear }
  | { kind: "create-subject"; yearId: string; yearName: string }
  | { kind: "edit-subject"; item: AcademicSubject };

export default function AcademicAdminPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [mode, setMode] = useState<Mode | null>(null);
  const [confirm, setConfirm] = useState<{ kind: "field" | "year" | "subject"; id: string; label: string } | null>(null);

  const { data, isLoading } = useQuery<AcademicField[]>({
    queryKey: ["academic-tree"],
    queryFn: () => fetchAcademicTree(),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["academic-tree"] });

  const removeField = useMutation({
    mutationFn: (id: string) => deleteField(id),
    onSuccess: () => { toast.success("تم الحذف"); invalidate(); },
    onError: (e: any) => toast.error(e?.response?.data?.message || "تعذّر الحذف"),
  });
  const removeYear = useMutation({
    mutationFn: (id: string) => deleteYear(id),
    onSuccess: () => { toast.success("تم الحذف"); invalidate(); },
    onError: (e: any) => toast.error(e?.response?.data?.message || "تعذّر الحذف"),
  });
  const removeSubject = useMutation({
    mutationFn: (id: string) => deleteSubject(id),
    onSuccess: () => { toast.success("تم الحذف"); invalidate(); },
    onError: (e: any) => toast.error(e?.response?.data?.message || "تعذّر الحذف"),
  });

  const fields = data ?? [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">إدارة التخصصات والسنوات والمواد الدراسية.</p>
        <Button onClick={() => setMode({ kind: "create-field" })}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3.5 w-3.5">
            <path d="M12 5v14M5 12h14" />
          </svg>
          تخصّص جديد
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : fields.length === 0 ? (
        <EmptyState
          title="لا توجد تخصّصات"
          description="ابدأ بإضافة تخصّص أكاديمي."
          action={<Button onClick={() => setMode({ kind: "create-field" })}>إضافة تخصّص</Button>}
        />
      ) : (
        <div className="space-y-3">
          {fields.map((f) => (
            <FieldCard
              key={f.id}
              field={f}
              onEditField={() => setMode({ kind: "edit-field", item: f })}
              onDeleteField={() => setConfirm({ kind: "field", id: f.id, label: f.name })}
              onAddYear={() => setMode({ kind: "create-year", fieldId: f.id, fieldName: f.name })}
              onEditYear={(y) => setMode({ kind: "edit-year", item: y })}
              onDeleteYear={(y) => setConfirm({ kind: "year", id: y.id, label: y.name })}
              onAddSubject={(y) => setMode({ kind: "create-subject", yearId: y.id, yearName: y.name })}
              onEditSubject={(s) => setMode({ kind: "edit-subject", item: s })}
              onDeleteSubject={(s) => setConfirm({ kind: "subject", id: s.id, label: s.name })}
            />
          ))}
        </div>
      )}

      <NameModal mode={mode} onClose={() => setMode(null)} onSaved={() => { setMode(null); invalidate(); }} />

      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        title="حذف؟"
        message={`سيتم حذف "${confirm?.label ?? ""}" مع كل العناصر التابعة.`}
        confirmLabel="حذف"
        variant="danger"
        onConfirm={() => {
          if (!confirm) return;
          if (confirm.kind === "field") removeField.mutate(confirm.id);
          if (confirm.kind === "year") removeYear.mutate(confirm.id);
          if (confirm.kind === "subject") removeSubject.mutate(confirm.id);
        }}
      />
    </div>
  );
}

// ── Field card with collapsible years ─────────────────────

function FieldCard({
  field,
  onEditField,
  onDeleteField,
  onAddYear,
  onEditYear,
  onDeleteYear,
  onAddSubject,
  onEditSubject,
  onDeleteSubject,
}: {
  field: AcademicField;
  onEditField: () => void;
  onDeleteField: () => void;
  onAddYear: () => void;
  onEditYear: (y: AcademicYear) => void;
  onDeleteYear: (y: AcademicYear) => void;
  onAddSubject: (y: AcademicYear) => void;
  onEditSubject: (s: AcademicSubject) => void;
  onDeleteSubject: (s: AcademicSubject) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <Surface className="overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border/60 px-5 py-3">
        <button
          onClick={() => setExpanded((e) => !e)}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-transform hover:bg-muted"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`h-4 w-4 transition-transform ${expanded ? "" : "rotate-180"}`}>
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
        <h3 className="flex-1 text-sm font-bold">{field.name}</h3>
        <span className="text-xs text-muted-foreground">{field.years.length} سنة</span>
        <Button size="sm" variant="ghost" onClick={onEditField}>تعديل</Button>
        <Button size="sm" variant="ghost" onClick={onDeleteField}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5 text-rose-600">
            <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          </svg>
        </Button>
      </div>

      {expanded && (
        <div className="space-y-2 p-4">
          {field.years.map((y) => (
            <div key={y.id} className="rounded-lg border border-border/60 bg-muted/20 p-3">
              <div className="flex items-center gap-2">
                <p className="flex-1 text-sm font-semibold">{y.name}</p>
                <span className="text-xs text-muted-foreground">{y.subjects.length} مادة</span>
                <Button size="sm" variant="ghost" onClick={() => onAddSubject(y)}>
                  + مادة
                </Button>
                <Button size="sm" variant="ghost" onClick={() => onEditYear(y)}>تعديل</Button>
                <Button size="sm" variant="ghost" onClick={() => onDeleteYear(y)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5 text-rose-600">
                    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  </svg>
                </Button>
              </div>
              {y.subjects.length > 0 && (
                <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
                  {y.subjects.map((s) => (
                    <li key={s.id} className="group flex items-center gap-2 rounded-md border border-border/40 bg-card px-3 py-1.5 text-sm">
                      <span className="flex-1 truncate">{s.name}</span>
                      <span className="text-[10px] text-muted-foreground">{s._count?.books ?? 0}</span>
                      <div className="flex opacity-0 transition-opacity group-hover:opacity-100">
                        <button onClick={() => onEditSubject(s)} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="تعديل">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z" />
                          </svg>
                        </button>
                        <button onClick={() => onDeleteSubject(s)} className="rounded p-1 text-muted-foreground hover:bg-rose-50 hover:text-rose-600" aria-label="حذف">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5">
                            <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                          </svg>
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
          <Button size="sm" variant="secondary" onClick={onAddYear}>
            + إضافة سنة
          </Button>
        </div>
      )}
    </Surface>
  );
}

// ── Single name modal for all create/edit cases ───────────

function NameModal({
  mode,
  onClose,
  onSaved,
}: {
  mode: Mode | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState("");

  useEffect(() => {
    if (!mode) return;
    const initial =
      mode.kind === "edit-field"
        ? mode.item.name
        : mode.kind === "edit-year"
          ? mode.item.name
          : mode.kind === "edit-subject"
            ? mode.item.name
            : "";
    setName(initial);
  }, [mode]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!mode) return;
      const trimmed = name.trim();
      if (!trimmed) throw new Error("الاسم مطلوب");

      switch (mode.kind) {
        case "create-field": return createField(trimmed);
        case "edit-field": return updateField(mode.item.id, trimmed);
        case "create-year": return createYear(mode.fieldId, trimmed);
        case "edit-year": return updateYear(mode.item.id, trimmed);
        case "create-subject": return createSubject(mode.yearId, trimmed);
        case "edit-subject": return updateSubject(mode.item.id, trimmed);
      }
    },
    onSuccess: () => {
      toast.success("تم الحفظ");
      onSaved();
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message || e?.message || "تعذّر الحفظ"),
  });

  if (!mode) return null;

  const titles: Record<Mode["kind"], string> = {
    "create-field": "تخصّص جديد",
    "edit-field": "تعديل التخصّص",
    "create-year": `سنة جديدة في "${mode.kind === "create-year" ? mode.fieldName : ""}"`,
    "edit-year": "تعديل السنة",
    "create-subject": `مادة جديدة في "${mode.kind === "create-subject" ? mode.yearName : ""}"`,
    "edit-subject": "تعديل المادة",
  };

  return (
    <Modal open={Boolean(mode)} onClose={onClose} title={titles[mode.kind]} size="sm">
      <div className="space-y-3">
        <Field label="الاسم" required>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
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

