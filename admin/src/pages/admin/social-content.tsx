import { useEffect, useMemo, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  exportSocialContent,
  fetchCatalog,
  fetchSocialBooks,
  type SocialBookRow,
  type SocialFilter,
} from "@/lib/admin-api";
import {
  Button,
  EmptyState,
  Pagination,
  StatusBadge,
  Surface,
  inputClass,
  selectClass,
} from "@/components/admin/primitives";
import { useToast } from "@/components/admin/toaster";
import type { CatalogItem } from "@/lib/admin-types";

const PAGE_SIZE = 24;

const STATUS_LABEL: Record<string, string> = {
  available: "متوفر",
  on_request: "حسب الطلب",
  rare: "نادر",
};

type ExportState =
  | { phase: "idle" }
  | { phase: "preparing"; count: number }
  | { phase: "downloading"; count: number; bytes: number }
  | { phase: "done"; count: number; bytes: number; truncated: number }
  | { phase: "failed"; message: string };

/**
 * Turn the catalogue into social-media material: pick books (across pages,
 * or "everything matching" a filter) and download one ZIP with a folder per
 * book — cover, metadata.json, metadata.txt — plus an index.csv.
 *
 * Only ids/filters go to the server; it reads titles, prices and pictures from
 * the database. The list is paged server-side, so the catalogue's size never
 * reaches the browser.
 */
export default function SocialContentPage() {
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [publisherId, setPublisherId] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [includeGallery, setIncludeGallery] = useState(false);

  // Picked books, kept across pages and filter changes.
  const [selected, setSelected] = useState<Map<string, SocialBookRow>>(new Map());
  // "Everything matching this filter" — resolved by the server at export time.
  const [matchAll, setMatchAll] = useState<{ filter: SocialFilter; total: number } | null>(null);
  const [exportState, setExportState] = useState<ExportState>({ phase: "idle" });

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const filter: SocialFilter = useMemo(
    () => ({
      search: debounced || undefined,
      categoryId: categoryId || undefined,
      publisherId: publisherId || undefined,
      status: status || undefined,
    }),
    [debounced, categoryId, publisherId, status],
  );

  // New filter → first page, and a stale "match all" no longer applies.
  useEffect(() => {
    setPage(1);
    setMatchAll(null);
  }, [filter]);

  const { data, isLoading, isFetching, isError } = useQuery({
    queryKey: ["social-books", filter, page],
    queryFn: () => fetchSocialBooks({ ...filter, page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });
  const { data: categories = [] } = useQuery<CatalogItem[]>({
    queryKey: ["catalog", "categories"],
    queryFn: () => fetchCatalog("categories"),
    staleTime: 5 * 60_000,
  });
  const { data: publishers = [] } = useQuery<CatalogItem[]>({
    queryKey: ["catalog", "publishers"],
    queryFn: () => fetchCatalog("publishers"),
    staleTime: 5 * 60_000,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const maxExport = data?.maxExport ?? 200;
  const hasFilter = Boolean(filter.search || filter.categoryId || filter.publisherId || filter.status);

  const toggle = (row: SocialBookRow) => {
    setMatchAll(null);
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(row.id)) next.delete(row.id);
      else next.set(row.id, row);
      return next;
    });
  };

  const allVisibleSelected = items.length > 0 && items.every((r) => selected.has(r.id));
  const toggleVisible = () => {
    setMatchAll(null);
    setSelected((prev) => {
      const next = new Map(prev);
      if (allVisibleSelected) items.forEach((r) => next.delete(r.id));
      else items.forEach((r) => next.set(r.id, r));
      return next;
    });
  };

  const clearSelection = () => {
    setSelected(new Map());
    setMatchAll(null);
  };

  const selectionCount = matchAll ? Math.min(matchAll.total, maxExport) : selected.size;
  const busy = exportState.phase === "preparing" || exportState.phase === "downloading";

  async function runExport(body: Parameters<typeof exportSocialContent>[0], count: number) {
    setExportState({ phase: "preparing", count });
    try {
      const res = await exportSocialContent(body, (bytes) =>
        setExportState({ phase: "downloading", count, bytes }),
      );
      const url = URL.createObjectURL(res.blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setExportState({ phase: "done", count: res.books, bytes: res.blob.size, truncated: res.truncated });
      toast.success(`تم تنزيل ${res.books} كتاب`);
    } catch (err: any) {
      const message = err?.message || "تعذّر إنشاء الملف";
      setExportState({ phase: "failed", message });
      toast.error(message);
    }
  }

  const exportSelection = () => {
    if (matchAll) {
      runExport({ filter: matchAll.filter, includeGallery }, selectionCount);
    } else {
      const ids = [...selected.keys()];
      if (ids.length > maxExport) {
        toast.error(`الحد الأقصى ${maxExport} كتاب في الملف الواحد`);
        return;
      }
      runExport({ bookIds: ids, includeGallery }, ids.length);
    }
  };

  return (
    <div className="space-y-4 pb-28">
      <Surface className="space-y-3 p-4">
        <p className="text-sm leading-relaxed text-muted-foreground">
          اختر الكتب ونزّلها في ملف ZIP واحد: مجلد لكل كتاب فيه صورة الغلاف وبياناته (العنوان، المؤلف،
          الناشر، السعر، التوفر) جاهزة للنشر على إنستغرام وفيسبوك وتيك توك وواتساب وتيليغرام.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث بالعنوان أو المؤلف..."
              className={`${inputClass} pr-9`}
              aria-label="بحث"
            />
          </div>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={`${selectClass} h-10 w-auto max-w-[12rem]`} aria-label="التصنيف">
            <option value="">كل التصنيفات</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select value={publisherId} onChange={(e) => setPublisherId(e.target.value)} className={`${selectClass} h-10 w-auto max-w-[12rem]`} aria-label="دار النشر">
            <option value="">كل دور النشر</option>
            {publishers.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${selectClass} h-10 w-auto`} aria-label="التوفر">
            <option value="">كل الحالات</option>
            <option value="available">متوفر</option>
            <option value="on_request">حسب الطلب</option>
            <option value="rare">نادر</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Button size="sm" variant="secondary" onClick={toggleVisible} disabled={!items.length}>
            {allVisibleSelected ? "إلغاء تحديد الصفحة" : "تحديد كل الصفحة"}
          </Button>
          {hasFilter && total > 0 && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setSelected(new Map());
                setMatchAll({ filter, total });
              }}
            >
              تحديد كل النتائج ({total.toLocaleString("ar-DZ")})
            </Button>
          )}
          {selectionCount > 0 && (
            <Button size="sm" variant="ghost" onClick={clearSelection}>
              مسح التحديد
            </Button>
          )}
          <span className="ms-auto text-muted-foreground">
            {isFetching ? "جاري التحميل..." : `${total.toLocaleString("ar-DZ")} كتاب`}
          </span>
        </div>
        {matchAll && matchAll.total > maxExport && (
          <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-800">
            النتائج {matchAll.total.toLocaleString("ar-DZ")} كتابًا؛ يُنزَّل أول {maxExport} فقط في الملف الواحد. ضيّق
            البحث أو نزّل على دفعات.
          </p>
        )}
      </Surface>

      {isError ? (
        <EmptyState title="تعذّر تحميل الكتب" description="تحقق من الاتصال ثم أعد المحاولة." />
      ) : isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-[3/5] animate-pulse rounded-xl bg-muted/60" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState title="لا توجد كتب مطابقة" description="غيّر البحث أو الفلاتر." />
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {items.map((row) => (
            <BookTile
              key={row.id}
              row={row}
              checked={matchAll ? true : selected.has(row.id)}
              lockedByMatchAll={Boolean(matchAll)}
              onToggle={() => toggle(row)}
              onDownload={() => runExport({ bookIds: [row.id], includeGallery }, 1)}
              busy={busy}
            />
          ))}
        </ul>
      )}

      <Pagination page={page} pageSize={PAGE_SIZE} total={total} onChange={setPage} />

      {/* ── Export bar ── */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border/60 bg-background/95 p-3 backdrop-blur-sm lg:pr-64">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3">
          <span className="text-sm font-semibold">
            {matchAll ? `كل النتائج: ${selectionCount.toLocaleString("ar-DZ")} كتاب` : `المحدد: ${selectionCount} كتاب`}
          </span>
          <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
            <input type="checkbox" checked={includeGallery} onChange={(e) => setIncludeGallery(e.target.checked)} className="h-3.5 w-3.5" />
            كل صور السلسلة (وليس الغلاف فقط)
          </label>
          <ExportStatus state={exportState} />
          <Button className="ms-auto" onClick={exportSelection} disabled={selectionCount === 0 || busy}>
            {busy ? "جاري التحضير..." : "تنزيل المحدد (ZIP)"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function BookTile({
  row,
  checked,
  lockedByMatchAll,
  onToggle,
  onDownload,
  busy,
}: {
  row: SocialBookRow;
  checked: boolean;
  lockedByMatchAll: boolean;
  onToggle: () => void;
  onDownload: () => void;
  busy: boolean;
}) {
  const [broken, setBroken] = useState(false);
  return (
    <li
      className={`group relative flex flex-col overflow-hidden rounded-xl border bg-card transition-shadow ${
        checked ? "border-primary ring-2 ring-primary/30" : "border-border/60 hover:shadow-md"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        disabled={lockedByMatchAll}
        aria-pressed={checked}
        aria-label={`${checked ? "إلغاء تحديد" : "تحديد"} ${row.title}`}
        className="relative block aspect-[3/4] w-full overflow-hidden bg-muted/40 text-start disabled:cursor-default"
      >
        {row.cover && !broken ? (
          <img
            src={row.cover}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
            onError={() => setBroken(true)}
          />
        ) : (
          <span className="flex h-full items-center justify-center p-3 text-center text-xs font-semibold text-muted-foreground">
            {row.cover ? "تعذّر عرض الصورة" : "بدون صورة"}
          </span>
        )}
        <span
          className={`absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-md border-2 transition-colors ${
            checked ? "border-primary bg-primary text-primary-foreground" : "border-white bg-black/30"
          }`}
        >
          {checked && (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-3.5 w-3.5">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          )}
        </span>
        {row.pictures > 1 && (
          <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white">
            {row.pictures} صور
          </span>
        )}
      </button>
      <div className="flex flex-1 flex-col gap-1 p-2.5">
        <p className="line-clamp-2 text-sm font-semibold leading-snug" title={row.title}>
          {row.title}
        </p>
        {row.authors.length > 0 && (
          <p className="truncate text-xs text-muted-foreground">{row.authors.join("، ")}</p>
        )}
        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
          {row.status && <StatusBadge status={row.status} label={STATUS_LABEL[row.status] ?? row.status} />}
          {row.price != null && <span className="text-xs font-bold text-primary">{row.price.toLocaleString("ar-DZ")} دج</span>}
        </div>
        <button
          type="button"
          onClick={onDownload}
          disabled={busy}
          className="mt-1.5 rounded-md border border-border/70 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
        >
          تنزيل هذا الكتاب
        </button>
      </div>
    </li>
  );
}

function ExportStatus({ state }: { state: ExportState }) {
  const mb = (b: number) => (b < 1048576 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1048576).toFixed(1)} MB`);
  switch (state.phase) {
    case "idle":
      return null;
    case "preparing":
      return <span className="text-xs text-muted-foreground">جارٍ تجهيز {state.count} كتاب...</span>;
    case "downloading":
      return <span className="text-xs text-muted-foreground">جارٍ التنزيل... {mb(state.bytes)}</span>;
    case "done":
      return (
        <span className="text-xs text-emerald-700">
          اكتمل: {state.count} كتاب ({mb(state.bytes)})
          {state.truncated > 0 && ` — لم يُضمَّن ${state.truncated} كتابًا إضافيًا`}
        </span>
      );
    case "failed":
      return <span className="text-xs text-rose-700">فشل: {state.message}</span>;
  }
}
