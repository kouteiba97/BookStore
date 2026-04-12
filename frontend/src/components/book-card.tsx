import { Link } from "react-router-dom";
import type { Book } from "@/lib/types";

const statusMap: Record<
  string,
  { label: string; className: string; dot: string }
> = {
  available: {
    label: "متوفر",
    className: "bg-[oklch(0.94_0.06_155)] text-[oklch(0.30_0.08_155)] ring-[oklch(0.30_0.08_155)]/15",
    dot: "bg-[oklch(0.45_0.12_155)]",
  },
  on_request: {
    label: "حسب الطلب",
    className: "bg-gold-light text-[oklch(0.38_0.08_75)] ring-gold/25",
    dot: "bg-gold",
  },
  rare: {
    label: "نادر",
    className: "bg-[oklch(0.93_0.04_300)] text-[oklch(0.35_0.10_300)] ring-[oklch(0.35_0.10_300)]/20",
    dot: "bg-[oklch(0.55_0.14_300)]",
  },
};

export default function BookCard({ book }: { book: Book }) {
  const status = book.inventory ? statusMap[book.inventory.status] : null;

  return (
    <Link
      to={`/books/${book.id}`}
      className="group block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-gold/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-border/60 bg-card transition-all duration-300 group-hover:-translate-y-1 group-hover:border-gold/40 group-hover:shadow-warm-lg">
        <div className="relative aspect-[4/5] w-full overflow-hidden bg-gradient-to-br from-muted/50 to-muted/20">
          {book.imageUrl ? (
            <img
              src={book.imageUrl}
              alt={book.title}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground/30">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-12 w-12">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
              </svg>
            </div>
          )}
          {status && (
            <div className="absolute top-2.5 right-2.5">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 backdrop-blur-sm ${status.className}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                {status.label}
              </span>
            </div>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-1 p-3.5">
          <h3 className="text-sm font-bold leading-snug line-clamp-2 text-foreground">
            {book.title}
          </h3>
          {book.author && (
            <p className="line-clamp-1 text-xs text-muted-foreground">{book.author.name}</p>
          )}
          {book.category && (
            <p className="mt-auto pt-2 text-[11px] text-muted-foreground/70">
              {book.category.name}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
