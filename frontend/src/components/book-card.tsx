import { Link } from "react-router-dom";
import type { Book } from "@/lib/types";

// ── Status config ────────────────────────────────────────

const statusConfig: Record<
  string,
  { label: string; dotClass: string; textClass: string; bgClass: string }
> = {
  available: {
    label: "متوفر",
    dotClass: "bg-emerald-500",
    textClass: "text-emerald-700",
    bgClass: "bg-emerald-50 ring-emerald-200/60",
  },
  on_request: {
    label: "حسب الطلب",
    dotClass: "bg-amber-400",
    textClass: "text-amber-700",
    bgClass: "bg-amber-50 ring-amber-200/60",
  },
  rare: {
    label: "نادر",
    dotClass: "bg-violet-400",
    textClass: "text-violet-700",
    bgClass: "bg-violet-50 ring-violet-200/60",
  },
};

// ── Placeholder palette (cycles by title char) ──────────

const placeholderPalettes = [
  { bg: "bg-[#EEF4EE]", text: "text-[#2A5A3E]" },
  { bg: "bg-[#F4EEE8]", text: "text-[#6B4226]" },
  { bg: "bg-[#EEF0F8]", text: "text-[#2E3A6B]" },
  { bg: "bg-[#F5F0E8]", text: "text-[#5C4A1E]" },
  { bg: "bg-[#F0EEF4]", text: "text-[#4A2E6B]" },
];

function getPalette(title: string) {
  const idx = (title.charCodeAt(0) ?? 0) % placeholderPalettes.length;
  return placeholderPalettes[idx];
}

// ── Component ────────────────────────────────────────────

export default function BookCard({ book }: { book: Book }) {
  const status = book.inventory ? statusConfig[book.inventory.status] : null;
  const palette = getPalette(book.title);

  const meta = [
    book.publisher?.name,
    book.year?.toString(),
  ]
    .filter(Boolean)
    .join(" • ");

  return (
    <div className="group flex flex-col overflow-hidden rounded-xl border border-border/50 bg-card shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">

      {/* ── Cover image ── */}
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-t-xl">
        {book.imageUrl ? (
          <img
            src={book.imageUrl}
            alt={book.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className={`flex h-full w-full items-center justify-center p-4 ${palette.bg}`}>
            <p className={`text-center text-sm font-bold leading-snug line-clamp-4 ${palette.text}`}>
              {book.title}
            </p>
          </div>
        )}

        {/* Status badge — top right overlay */}
        {status && (
          <span
            className={`absolute right-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 backdrop-blur-sm ${status.bgClass} ${status.textClass}`}
          >
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${status.dotClass}`} />
            {status.label}
          </span>
        )}
      </div>

      {/* ── Info block ── */}
      <div className="flex flex-1 flex-col gap-2 p-3">

        {/* Category chip */}
        {book.category && (
          <span className="inline-block w-fit rounded-md bg-primary/8 px-2 py-0.5 text-[10px] font-semibold text-primary/75">
            {book.category.name}
          </span>
        )}

        {/* Title */}
        <h3 className="text-[13px] font-bold leading-snug text-foreground line-clamp-2">
          {book.title}
        </h3>

        {/* Author + Price row */}
        <div className="flex items-center justify-between gap-2">
          {book.author && (
            <div className="flex min-w-0 items-center gap-1 text-[11px] text-muted-foreground">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3 shrink-0 text-muted-foreground/50">
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <span className="truncate">{book.author.name}</span>
            </div>
          )}
          {book.price != null && (
            <span className="shrink-0 text-[12px] font-bold text-primary">
              {book.price.toLocaleString("ar-DZ")} دج
            </span>
          )}
        </div>

        {/* Publisher • Year */}
        {meta && (
          <p className="text-[10px] text-muted-foreground/65 leading-none">
            {meta}
          </p>
        )}

        {/* CTA */}
        <Link
          to={`/books/${book.id}`}
          className="mt-auto flex w-full items-center justify-center rounded-lg border border-border/70 bg-card py-2 text-[12px] font-semibold text-foreground/80 transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
        >
          عرض التفاصيل
        </Link>
      </div>
    </div>
  );
}
