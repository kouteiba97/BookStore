import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import BookCard from "@/components/book-card";
import { BookGridSkeleton } from "@/components/book-card-skeleton";
import OrderModal from "@/components/order-modal";
import { fetchBook, fetchRecommendations } from "@/lib/queries";

// ── Status config ────────────────────────────────────────

const statusConfig: Record<
  string,
  { label: string; dot: string; text: string; bg: string }
> = {
  available: {
    label: "متوفر",
    dot: "bg-emerald-500",
    text: "text-emerald-700",
    bg: "bg-emerald-50 ring-emerald-200/60",
  },
  on_request: {
    label: "حسب الطلب",
    dot: "bg-amber-400",
    text: "text-amber-700",
    bg: "bg-amber-50 ring-amber-200/60",
  },
  rare: {
    label: "نادر",
    dot: "bg-violet-400",
    text: "text-violet-700",
    bg: "bg-violet-50 ring-violet-200/60",
  },
};

// ── Placeholder palette ──────────────────────────────────

const palettes = [
  { bg: "bg-[#EEF4EE]", text: "text-[#2A5A3E]" },
  { bg: "bg-[#F4EEE8]", text: "text-[#6B4226]" },
  { bg: "bg-[#EEF0F8]", text: "text-[#2E3A6B]" },
  { bg: "bg-[#F5F0E8]", text: "text-[#5C4A1E]" },
];

// ── Skeleton ─────────────────────────────────────────────

function BookPageSkeleton() {
  return (
    <div className="flex flex-col gap-10">
      <div className="h-4 w-20 animate-pulse rounded-full bg-muted/60" />
      <div className="grid gap-8 md:grid-cols-[260px_1fr]">
        <div className="aspect-[4/5] w-full animate-pulse rounded-xl bg-muted/60" />
        <div className="flex flex-col gap-4">
          <div className="h-4 w-20 animate-pulse rounded-full bg-muted/50" />
          <div className="h-8 w-3/4 animate-pulse rounded-xl bg-muted/60" />
          <div className="h-4 w-1/3 animate-pulse rounded-full bg-muted/50" />
          <div className="mt-2 h-4 w-1/4 animate-pulse rounded-full bg-muted/40" />
          <div className="mt-4 h-12 w-48 animate-pulse rounded-xl bg-muted/50" />
        </div>
      </div>
    </div>
  );
}

// ── Meta row item ────────────────────────────────────────

function MetaItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/50 py-2.5 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

// ── Trust badge ──────────────────────────────────────────

function TrustBadge({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3 w-3">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </span>
      <span className="text-muted-foreground">{children}</span>
    </div>
  );
}

// ── Order CTA button ─────────────────────────────────────

function OrderButton({ book }: { book: NonNullable<ReturnType<typeof useQuery<typeof book>>["data"]> }) {
  return (
    <OrderModal
      book={book}
      trigger={
        <button
          type="button"
          className="inline-flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-bold text-primary-foreground shadow-warm transition-all hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-warm-lg active:scale-[0.98] sm:w-auto"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
            <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <path d="M16 10a4 4 0 0 1-8 0" />
          </svg>
          اطلب هذا الكتاب
        </button>
      }
    />
  );
}

// ── Page ─────────────────────────────────────────────────

import type { Book } from "@/lib/types";

export default function BookPage() {
  const { id } = useParams<{ id: string }>();

  const { data: book, isLoading } = useQuery({
    queryKey: ["book", id],
    queryFn: () => fetchBook(id!),
    enabled: !!id,
  });

  const { data: recommendations = [], isLoading: recsLoading } = useQuery({
    queryKey: ["recommendations", id],
    queryFn: () => fetchRecommendations(id!),
    enabled: !!id,
  });

  if (isLoading) return <BookPageSkeleton />;

  if (!book) {
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/60">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-8 w-8 text-muted-foreground/40">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
          </svg>
        </div>
        <p className="text-lg font-semibold">الكتاب غير موجود</p>
        <Link to="/" className="text-sm text-primary hover:underline">
          العودة إلى الرئيسية
        </Link>
      </div>
    );
  }

  const status = book.inventory ? statusConfig[book.inventory.status] : null;
  const palette = palettes[(book.title.charCodeAt(0) ?? 0) % palettes.length];

  const metaRows: { label: string; value: string; condition: boolean }[] = [
    { label: "المؤلف", value: book.author?.name ?? "", condition: !!book.author },
    { label: "دار النشر", value: book.publisher?.name ?? "", condition: !!book.publisher },
    { label: "سنة النشر", value: book.year?.toString() ?? "", condition: !!book.year },
    { label: "التصنيف", value: book.category?.name ?? "", condition: !!book.category },
  ];

  return (
    <div className="flex flex-col gap-12 pb-24 md:pb-0">

      {/* Back */}
      <Link
        to="/"
        className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
          <path d="m9 18 6-6-6-6" />
        </svg>
        العودة
      </Link>

      {/* ── Hero ── */}
      <section className="grid gap-8 md:grid-cols-[260px_1fr] md:gap-12">

        {/* Cover — appears first in DOM = right side in RTL */}
        <div className="mx-auto w-full max-w-[240px] md:mx-0 md:max-w-none">
          <div className="group relative aspect-[4/5] overflow-hidden rounded-xl shadow-md ring-1 ring-border/40">
            {book.imageUrl ? (
              <img
                src={book.imageUrl}
                alt={book.title}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
              />
            ) : (
              <div className={`flex h-full w-full items-center justify-center p-5 ${palette.bg}`}>
                <p className={`text-center text-base font-bold leading-snug ${palette.text}`}>
                  {book.title}
                </p>
              </div>
            )}
            {status && (
              <span className={`absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 backdrop-blur-sm ${status.bg} ${status.text}`}>
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${status.dot}`} />
                {status.label}
              </span>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="flex flex-col gap-4">
          {/* Category */}
          {book.category && (
            <Link
              to={`/search?q=${encodeURIComponent(book.category.name)}`}
              className="inline-flex w-fit items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/15"
            >
              {book.category.name}
            </Link>
          )}

          {/* Title */}
          <h1 className="font-heading text-2xl font-bold leading-tight text-foreground sm:text-3xl">
            {book.title}
          </h1>

          {/* Author */}
          {book.author && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5 shrink-0 text-primary/60">
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <span className="font-medium text-foreground">{book.author.name}</span>
            </div>
          )}

          {/* Availability */}
          {status && (
            <div className={`inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${status.bg} ${status.text}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
              {status.label}
            </div>
          )}

          {/* Price */}
          {book.price != null && (
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-primary">
                {book.price.toLocaleString("ar-DZ")}
              </span>
              <span className="text-sm font-semibold text-primary/80">دج</span>
            </div>
          )}

          {/* CTA */}
          <div className="mt-2 flex flex-col gap-2">
            <div className="hidden md:block">
              <OrderButton book={book} />
            </div>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5 shrink-0 text-primary/60">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
              توصيل متوفر إلى جميع 58 ولاية
            </p>
          </div>
        </div>
      </section>

      {/* ── Book metadata ── */}
      {metaRows.some((r) => r.condition) && (
        <section className="rounded-xl border border-border/60 bg-card">
          <div className="border-b border-border/60 px-4 py-3">
            <h2 className="text-sm font-bold text-foreground">معلومات الكتاب</h2>
          </div>
          <div className="divide-y divide-border/40 px-4">
            {metaRows.filter((r) => r.condition).map((r) => (
              <MetaItem key={r.label} label={r.label} value={r.value} />
            ))}
          </div>
        </section>
      )}

      {/* ── Description ── */}
      {book.description && (
        <section>
          <div className="mb-4 flex items-center gap-3">
            <span className="h-5 w-1 rounded-full bg-primary" />
            <h2 className="font-heading text-lg font-bold">عن الكتاب</h2>
          </div>
          <p className="leading-loose text-foreground/85">{book.description}</p>
        </section>
      )}

      {/* ── Trust section ── */}
      <section className="rounded-xl border border-border/60 bg-card/60 px-5 py-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <TrustBadge>توصيل إلى 58 ولاية</TrustBadge>
          <TrustBadge>الدفع عند الاستلام</TrustBadge>
          <TrustBadge>دعم واتساب</TrustBadge>
        </div>
      </section>

      {/* ── Recommendations ── */}
      {(recsLoading || recommendations.length > 0) && (
        <section>
          <div className="mb-5 flex items-center gap-3">
            <span className="h-5 w-1 rounded-full bg-primary" />
            <h2 className="font-heading text-xl font-bold">كتب مشابهة</h2>
          </div>
          {recsLoading ? (
            <BookGridSkeleton count={4} />
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
              {recommendations.map((rec) => (
                <BookCard key={rec.id} book={rec} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── Sticky mobile CTA ── */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/95 p-3 backdrop-blur-sm md:hidden">
        <OrderButton book={book} />
      </div>
    </div>
  );
}
