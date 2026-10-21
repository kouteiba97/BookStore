import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createHomeSection,
  deleteHomeSection,
  fetchHomeSections,
  reorderHomeSections,
  setHomeShelfBooks,
  updateHomeSection,
  type AdminHomeSection,
  type AdminHomeShelfBook,
  type HomeSectionKind,
} from "@/lib/admin-api";
import {
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  Modal,
  Surface,
  TableSkeleton,
  inputClass,
} from "@/components/admin/primitives";
import { useToast } from "@/components/admin/toaster";
import BookSearch from "@/components/admin/book-search";
import { Thumb } from "@/components/admin/thumb";
import { features } from "@/lib/features";

const PUBLIC_SITE_URL = import.meta.env.VITE_PUBLIC_SITE_URL ?? "http://localhost:5173/";

/** What each built-in block shows, and its title when the admin set none. */
const BUILTIN: Record<Exclude<HomeSectionKind, "books">, { title: string; about: string }> = {
  categories: { title: "تصفّح حسب التصنيف", about: "بطاقات التصنيفات وعدد الكتب في كل منها" },
  academic: { title: "المراجع الأكاديمية حسب التخصص", about: "التخصصات الأكاديمية (يظهر إن كان فيها كتب)" },
  latest: { title: "أحدث الإضافات", about: "آخر 8 كتب أُضيفت، تلقائيًا" },
  popular: { title: "الأكثر طلبًا", about: "8 كتب أخرى من الجديد" },
  request: { title: "لم تجد الكتاب الذي تبحث عنه؟", about: "زر «اطلب كتابك الآن»" },
};

const titleOf = (s: AdminHomeSection) =>
  s.title || (s.kind === "books" ? "قسم بلا اسم" : BUILTIN[s.kind].title);

const errMsg = (e: any, fallback: string) => e?.response?.data?.message || fallback;

export default function StorefrontPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<AdminHomeSection | null>(null);
  const [deleting, setDeleting] = useState<AdminHomeSection | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const { data = [], isLoading } = useQuery({
    queryKey: ["home-sections"],
    queryFn: fetchHomeSections,
  });
  // The basic edition has no academic browse, so its block is not offered.
  const sections = data.filter((s) => features.academic || s.kind !== "academic");

  const refresh = () => qc.invalidateQueries({ queryKey: ["home-sections"] });
  const setLocal = (next: AdminHomeSection[]) => qc.setQueryData(["home-sections"], next);

  const reorder = useMutation({
    mutationFn: reorderHomeSections,
    onError: (e) => toast.error(errMsg(e, "تعذّر حفظ الترتيب")),
    onSettled: refresh,
  });

  const move = (index: number, delta: number) => {
    const j = index + delta;
    if (j < 0 || j >= sections.length) return;
    const next = [...sections];
    [next[index], next[j]] = [next[j], next[index]];
    // Keep blocks this edition hides in place after the visible ones.
    const hidden = data.filter((s) => !next.includes(s));
    const all = [...next, ...hidden];
    setLocal(all);
    reorder.mutate(all.map((s) => s.id));
  };

  const toggle = useMutation({
    mutationFn: (s: AdminHomeSection) => updateHomeSection(s.id, { visible: !s.visible }),
    onSuccess: (_r, s) => toast.success(s.visible ? "أُخفي القسم من المتجر" : "القسم ظاهر في المتجر"),
    onError: (e) => toast.error(errMsg(e, "تعذّر الحفظ")),
    onSettled: refresh,
  });

  const remove = useMutation({
    mutationFn: (s: AdminHomeSection) => deleteHomeSection(s.id),
    onSuccess: () => toast.success("تم حذف القسم"),
    onError: (e) => toast.error(errMsg(e, "تعذّر الحذف")),
    onSettled: refresh,
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">
          رتّبوا أقسام الصفحة الرئيسية للمتجر: أظهروا أو أخفوا كل قسم، وغيّروا اسمه، وأضيفوا أقسامًا
          بكتب تختارونها بأنفسكم، مثل «جديد معرض الكتاب 2026». شريط البحث يبقى دائمًا في الأعلى.
        </p>
        <div className="flex gap-2">
          <a
            href={PUBLIC_SITE_URL}
            target="_blank"
            rel="noopener"
            className="inline-flex h-10 items-center rounded-lg border border-border bg-card px-4 text-sm font-semibold hover:bg-muted"
          >
            عرض المتجر
          </a>
          <Button onClick={() => setCreating(true)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4">
              <path d="M12 5v14M5 12h14" />
            </svg>
            قسم كتب جديد
          </Button>
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton rows={5} cols={3} />
      ) : sections.length === 0 ? (
        <Surface>
          <EmptyState title="لا توجد أقسام" />
        </Surface>
      ) : (
        <Surface className="divide-y divide-border/40">
          {sections.map((s, i) => {
            const shelf = s.kind === "books";
            const expanded = shelf && open === s.id;
            return (
              <div key={s.id} className={s.visible ? "" : "bg-muted/30"}>
                <div className="flex items-center gap-3 p-3 sm:p-4">
                  <div className="flex flex-col">
                    <IconBtn label="إلى الأعلى" disabled={i === 0} onClick={() => move(i, -1)}>
                      <path d="m18 15-6-6-6 6" />
                    </IconBtn>
                    <IconBtn label="إلى الأسفل" disabled={i === sections.length - 1} onClick={() => move(i, 1)}>
                      <path d="m6 9 6 6 6-6" />
                    </IconBtn>
                  </div>

                  <button
                    className="min-w-0 flex-1 text-start"
                    onClick={() => shelf && setOpen(expanded ? null : s.id)}
                    disabled={!shelf}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`font-bold ${s.visible ? "" : "text-muted-foreground line-through"}`}>
                        {titleOf(s)}
                      </span>
                      <span
                        className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                          shelf ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {shelf ? `كتب مختارة · ${s.books?.length ?? 0} كتاب` : "قسم تلقائي"}
                      </span>
                      {!s.visible && (
                        <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                          مخفي
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {s.subtitle || (shelf ? (expanded ? "" : "اضغطوا لإضافة الكتب أو ترتيبها") : BUILTIN[s.kind as keyof typeof BUILTIN].about)}
                    </p>
                  </button>

                  <div className="flex shrink-0 items-center gap-1">
                    <IconBtn
                      label={s.visible ? "إخفاء من المتجر" : "إظهار في المتجر"}
                      onClick={() => toggle.mutate(s)}
                    >
                      {s.visible ? (
                        <>
                          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                          <circle cx="12" cy="12" r="3" />
                        </>
                      ) : (
                        <>
                          <path d="M3 3l18 18M10.6 5.1A10.7 10.7 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3 3.9M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a10 10 0 0 0 5.4-1.6" />
                          <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
                        </>
                      )}
                    </IconBtn>
                    <IconBtn label="تعديل الاسم" onClick={() => setEditing(s)}>
                      <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                    </IconBtn>
                    {shelf && (
                      <IconBtn label="حذف القسم" danger onClick={() => setDeleting(s)}>
                        <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
                      </IconBtn>
                    )}
                  </div>
                </div>

                {expanded && <ShelfEditor section={s} onSaved={refresh} />}
              </div>
            );
          })}
        </Surface>
      )}

      <SectionForm
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={(id) => {
          setCreating(false);
          setOpen(id ?? null);
          refresh();
        }}
      />
      <SectionForm
        open={!!editing}
        section={editing ?? undefined}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          refresh();
        }}
      />
      <ConfirmDialog
        open={!!deleting}
        title="حذف القسم"
        message={`سيُحذف القسم «${deleting ? titleOf(deleting) : ""}» من الصفحة الرئيسية. الكتب نفسها لا تُحذف.`}
        confirmLabel="حذف"
        variant="danger"
        onConfirm={() => deleting && remove.mutate(deleting)}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}

function IconBtn({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors disabled:opacity-30 ${
        danger ? "hover:bg-rose-50 hover:text-rose-600" : "hover:bg-muted hover:text-foreground"
      }`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
        {children}
      </svg>
    </button>
  );
}

/** Name a new shelf, or rename any section (a built-in can go back to its default name). */
function SectionForm({
  open,
  section,
  onClose,
  onSaved,
}: {
  open: boolean;
  section?: AdminHomeSection;
  onClose: () => void;
  onSaved: (id?: string) => void;
}) {
  const toast = useToast();
  const builtin = section && section.kind !== "books" ? BUILTIN[section.kind] : null;
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [seenFor, setSeenFor] = useState<string | null>(null);

  // Load the section's values each time the form opens for it.
  const key = open ? section?.id ?? "new" : null;
  if (key !== seenFor) {
    setSeenFor(key);
    setTitle(section?.title ?? "");
    setSubtitle(section?.subtitle ?? "");
  }

  const save = useMutation({
    mutationFn: async () => {
      if (section) {
        await updateHomeSection(section.id, { title: title.trim() || null, subtitle: subtitle.trim() || null });
        return undefined;
      }
      return (await createHomeSection({ title: title.trim(), subtitle: subtitle.trim() || null })).id;
    },
    onSuccess: (id) => {
      toast.success(section ? "تم الحفظ" : "تمت إضافة القسم، أضيفوا كتبه الآن");
      onSaved(id);
    },
    onError: (e) => toast.error(errMsg(e, "تعذّر الحفظ")),
  });

  const needsTitle = !builtin;
  return (
    <Modal open={open} onClose={onClose} title={section ? "تعديل القسم" : "قسم كتب جديد"} size="sm">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (needsTitle && !title.trim()) return;
          save.mutate();
        }}
      >
        <Field label="اسم القسم" required={needsTitle} hint={builtin ? `اتركوه فارغًا ليبقى «${builtin.title}»` : undefined}>
          <input
            className={inputClass}
            value={title}
            autoFocus
            maxLength={80}
            placeholder={builtin?.title ?? "مثال: جديد معرض الكتاب SILA 2026"}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>
        <Field label="وصف قصير" hint="اختياري، يظهر تحت الاسم">
          <input
            className={inputClass}
            value={subtitle}
            maxLength={140}
            placeholder={section ? undefined : "مثال: الكتب التي وصلتنا من المعرض هذا العام"}
            onChange={(e) => setSubtitle(e.target.value)}
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            إلغاء
          </Button>
          <Button type="submit" disabled={save.isPending || (needsTitle && !title.trim())}>
            {section ? "حفظ" : "إنشاء القسم"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** The books of one shelf: add by search, reorder, remove. Every change saves at once. */
function ShelfEditor({ section, onSaved }: { section: AdminHomeSection; onSaved: () => void }) {
  const toast = useToast();
  const qc = useQueryClient();
  const books = section.books ?? [];

  const save = useMutation({
    mutationFn: (next: AdminHomeShelfBook[]) => setHomeShelfBooks(section.id, next.map((b) => b.id)),
    onMutate: (next) => {
      qc.setQueryData<AdminHomeSection[]>(["home-sections"], (old) =>
        old?.map((s) => (s.id === section.id ? { ...s, books: next } : s)),
      );
    },
    onError: (e) => toast.error(errMsg(e, "تعذّر حفظ الكتب")),
    onSettled: onSaved,
  });

  const moveBook = (i: number, delta: number) => {
    const j = i + delta;
    if (j < 0 || j >= books.length) return;
    const next = [...books];
    [next[i], next[j]] = [next[j], next[i]];
    save.mutate(next);
  };

  return (
    <div className="space-y-3 border-t border-border/40 bg-muted/20 p-3 sm:p-4">
      <BookSearch
        placeholder="ابحثوا عن كتاب لإضافته إلى هذا القسم..."
        onPick={(b) => {
          if (books.some((x) => x.id === b.id)) {
            toast.info("الكتاب موجود في القسم");
            return;
          }
          save.mutate([
            ...books,
            {
              id: b.id,
              title: b.title,
              imageUrl: b.imageUrl,
              thumbUrl: b.thumbUrl ?? null,
              price: b.price,
              inventory: null,
            },
          ]);
        }}
      />
      {books.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          لا توجد كتب بعد. القسم لا يظهر في المتجر حتى تضيفوا له كتابًا واحدًا على الأقل.
        </p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            تظهر أول 8 كتب في الصفحة الرئيسية، والبقية في صفحة «عرض الكل».
          </p>
          <ol className="divide-y divide-border/40 rounded-lg border border-border/60 bg-card">
            {books.map((b, i) => (
              <li key={b.id} className="flex items-center gap-3 px-3 py-2">
                <span className="w-5 text-center text-xs tabular-nums text-muted-foreground">{i + 1}</span>
                <div className="h-12 w-9 shrink-0 overflow-hidden rounded bg-muted">
                  <Thumb src={b.imageUrl} thumb={b.thumbUrl} />
                </div>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{b.title}</span>
                {i === 7 && books.length > 8 && (
                  <span className="hidden text-[11px] text-muted-foreground sm:inline">آخر كتاب في الرئيسية</span>
                )}
                <IconBtn label="تقديم" disabled={i === 0} onClick={() => moveBook(i, -1)}>
                  <path d="m18 15-6-6-6 6" />
                </IconBtn>
                <IconBtn label="تأخير" disabled={i === books.length - 1} onClick={() => moveBook(i, 1)}>
                  <path d="m6 9 6 6 6-6" />
                </IconBtn>
                <IconBtn label="إزالة من القسم" danger onClick={() => save.mutate(books.filter((x) => x.id !== b.id))}>
                  <path d="M18 6 6 18M6 6l12 12" />
                </IconBtn>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
