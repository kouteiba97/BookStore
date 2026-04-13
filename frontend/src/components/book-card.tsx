import { Link } from "react-router-dom";
import type { Book } from "@/lib/types";

const statusMap: Record<
  string,
  { label: string; className: string; dot: string }
> = {
  available: {
    label: "متوفر",
    className:
      "bg-[oklch(0.94_0.06_155)] text-[oklch(0.30_0.08_155)] ring-[oklch(0.30_0.08_155)]/15",
    dot: "bg-[oklch(0.45_0.12_155)]",
  },
  on_request: {
    label: "حسب الطلب",
    className: "bg-gold-light text-[oklch(0.38_0.08_75)] ring-gold/25",
    dot: "bg-gold",
  },
  rare: {
    label: "نادر",
    className:
      "bg-[oklch(0.93_0.04_300)] text-[oklch(0.35_0.10_300)] ring-[oklch(0.35_0.10_300)]/20",
    dot: "bg-[oklch(0.55_0.14_300)]",
  },
};

const WHATSAPP_NUMBER = "966500000000";

function buildWhatsAppUrl(book: Book) {
  const text = `مرحبًا، أرغب في طلب كتاب:\n📖 ${book.title}${book.author ? `\n✍️ ${book.author.name}` : ""}`;
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}

export default function BookCard({ book }: { book: Book }) {
  const status = book.inventory ? statusMap[book.inventory.status] : null;

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card transition-all duration-300 hover:-translate-y-1 hover:border-gold/40 hover:shadow-warm-lg">
      {/* ── Clickable area: image + info ── */}
      <Link to={`/books/${book.id}`} className="flex flex-1 flex-col">
        {/* Cover */}
        <div className="relative aspect-[3/4] w-full overflow-hidden bg-gradient-to-br from-muted/40 via-muted/20 to-transparent">
          {book.imageUrl ? (
            <img
              src={book.imageUrl}
              alt={book.title}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.2"
                className="h-14 w-14 text-muted-foreground/20"
              >
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
              </svg>
            </div>
          )}

          {/* Status badge */}
          {status && (
            <span
              className={`absolute top-2.5 right-2.5 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 backdrop-blur-sm ${status.className}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
              {status.label}
            </span>
          )}
        </div>

        {/* Info */}
        <div className="flex flex-1 flex-col gap-1 p-4 pb-3">
          {/* Title */}
          <h3 className="text-[13px] font-bold leading-snug line-clamp-2 text-foreground">
            {book.title}
          </h3>

          {/* Author */}
          {book.author && (
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3 shrink-0 text-gold/70">
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <span className="line-clamp-1">{book.author.name}</span>
            </div>
          )}

          {/* Publisher */}
          {book.publisher && (
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/70">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3 shrink-0 text-gold/50">
                <path d="M3 9h18M9 21V9" />
                <rect x="3" y="3" width="18" height="18" rx="2" />
              </svg>
              <span className="line-clamp-1">{book.publisher.name}</span>
            </div>
          )}

          {/* Year + Category row */}
          <div className="mt-auto flex items-center gap-2 pt-2.5">
            {book.category && (
              <span className="inline-block rounded-md bg-primary/8 px-2 py-0.5 text-[10px] font-medium text-primary/80">
                {book.category.name}
              </span>
            )}
            {book.year && (
              <span className="text-[10px] text-muted-foreground/60">
                {book.year}
              </span>
            )}
          </div>
        </div>
      </Link>

      {/* ── WhatsApp CTA ── */}
      <div className="px-4 pb-4">
        <a
          href={buildWhatsAppUrl(book)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#25D366] py-[7px] text-[11px] font-bold text-white transition-colors hover:bg-[#1ead53] active:scale-[0.97]"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
          اطلب عبر واتساب
        </a>
      </div>
    </div>
  );
}
