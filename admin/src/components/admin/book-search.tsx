import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchAdminBooks } from "@/lib/admin-api";
import type { AdminBook } from "@/lib/admin-types";
import { inputClass } from "@/components/admin/primitives";
import { Thumb } from "@/components/admin/thumb";

/**
 * Type-to-find a book, inline (no dialog) — fast at the counter. Shows price
 * and stock. With `onNewTitle`, a title that is not in the store can be added
 * as a new book (purchases of new arrivals).
 */
export default function BookSearch({
  onPick,
  onNewTitle,
  placeholder = "ابحث عن كتاب بالعنوان أو المؤلف...",
  autoFocus,
}: {
  onPick: (b: AdminBook) => void;
  onNewTitle?: (title: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 200);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const { data, isFetching } = useQuery<{ books: AdminBook[] }>({
    queryKey: ["book-search", debounced],
    queryFn: () => fetchAdminBooks({ search: debounced, pageSize: 8 }),
    enabled: debounced.length > 1,
    staleTime: 30_000,
  });
  const books = data?.books ?? [];
  const showNew = !!onNewTitle && debounced.length > 1 && !isFetching;
  const count = books.length + (showNew ? 1 : 0);

  const pick = (i: number) => {
    if (i < books.length) onPick(books[i]);
    else if (showNew) onNewTitle!(q.trim());
    setQ("");
    setDebounced("");
    setActive(0);
  };

  return (
    <div ref={box} className="relative">
      <input
        value={q}
        autoFocus={autoFocus}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!count) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => (a + 1) % count);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => (a - 1 + count) % count);
          } else if (e.key === "Enter") {
            e.preventDefault();
            pick(active);
          }
        }}
        placeholder={placeholder}
        className={inputClass}
        aria-label="بحث عن كتاب"
        role="combobox"
        aria-expanded={open && count > 0}
      />
      {open && debounced.length > 1 && (
        <ul className="absolute inset-x-0 top-full z-30 mt-1 max-h-80 overflow-y-auto rounded-xl border border-border/70 bg-card p-1 shadow-warm-lg" role="listbox">
          {isFetching && !books.length && <li className="px-3 py-2 text-xs text-muted-foreground">جاري البحث...</li>}
          {books.map((b, i) => (
            <li key={b.id} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(i)}
                className={`flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-start text-sm ${i === active ? "bg-muted" : ""}`}
              >
                <span className="h-10 w-7 shrink-0 overflow-hidden rounded bg-muted">
                  <Thumb src={b.imageUrl} thumb={b.thumbUrl} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{b.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{b.authors?.map((a) => a.name).join("، ") || "—"}</span>
                </span>
                <span className="shrink-0 text-end text-xs">
                  <span className="block font-semibold">{b.price ? `${Number(b.price).toLocaleString("ar-DZ")} د.ج` : "بدون سعر"}</span>
                  <span className={`block ${b.inventory?.stock === 0 ? "text-rose-600" : "text-muted-foreground"}`}>
                    {b.inventory?.stock == null ? "المخزون؟" : `المخزون ${b.inventory.stock}`}
                  </span>
                </span>
              </button>
            </li>
          ))}
          {!isFetching && !books.length && !showNew && <li className="px-3 py-2 text-xs text-muted-foreground">لا توجد نتائج.</li>}
          {showNew && (
            <li role="option" aria-selected={active === books.length}>
              <button
                type="button"
                onMouseEnter={() => setActive(books.length)}
                onClick={() => pick(books.length)}
                className={`w-full rounded-lg px-3 py-2 text-start text-sm font-semibold text-primary ${active === books.length ? "bg-muted" : ""}`}
              >
                + إضافة «{q.trim()}» ككتاب جديد
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
