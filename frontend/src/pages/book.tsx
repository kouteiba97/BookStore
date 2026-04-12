import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import BookCard from "@/components/book-card";
import { BookGridSkeleton } from "@/components/book-card-skeleton";
import RequestDialog from "@/components/request-dialog";
import { fetchBook, fetchRecommendations } from "@/lib/queries";

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

  if (isLoading) {
    return (
      <div className="flex flex-col gap-8">
        <div className="h-4 w-24 animate-pulse rounded-full bg-muted/60" />
        <div className="flex flex-col gap-8 md:flex-row md:gap-10">
          <div className="mx-auto h-80 w-52 animate-pulse rounded-2xl bg-muted/60 md:mx-0" />
          <div className="flex flex-1 flex-col gap-4">
            <div className="h-8 w-3/4 animate-pulse rounded-full bg-muted/60" />
            <div className="h-4 w-1/2 animate-pulse rounded-full bg-muted/50" />
            <div className="mt-2 h-24 w-full animate-pulse rounded-xl bg-muted/40" />
          </div>
        </div>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground/50">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-8 w-8">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
          </svg>
        </div>
        <p className="text-lg font-semibold">الكتاب غير موجود</p>
        <Link to="/" className="text-sm text-gold hover:underline">العودة إلى الرئيسية</Link>
      </div>
    );
  }

  const status = book.inventory ? statusMap[book.inventory.status] : null;

  return (
    <div className="flex flex-col gap-12">
      {/* Back link */}
      <Link
        to="/"
        className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
          <path d="m9 18 6-6-6-6" />
        </svg>
        العودة
      </Link>

      <div className="grid gap-10 md:grid-cols-[18rem_1fr] md:gap-12">
        {/* Cover */}
        <div className="mx-auto w-full max-w-xs md:mx-0">
          <div className="relative">
            {book.imageUrl ? (
              <img
                src={book.imageUrl}
                alt={book.title}
                className="w-full rounded-2xl object-cover shadow-warm-lg ring-1 ring-border/50"
              />
            ) : (
              <div className="flex aspect-[3/4] w-full items-center justify-center rounded-2xl bg-gradient-to-br from-muted/60 to-muted/20 text-muted-foreground/30 ring-1 ring-border/50">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-20 w-20">
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                  <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                </svg>
              </div>
            )}
            {status && (
              <div className="absolute top-3 right-3">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 backdrop-blur-sm ${status.className}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                  {status.label}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Details */}
        <div className="flex flex-col gap-5">
          {book.category && (
            <Link
              to={`/search?q=${encodeURIComponent(book.category.name)}`}
              className="inline-flex w-fit items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/15"
            >
              {book.category.name}
            </Link>
          )}

          <h1 className="font-heading text-3xl font-bold leading-tight md:text-4xl">
            {book.title}
          </h1>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            {book.author && (
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 text-gold">
                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <span className="font-medium text-foreground">{book.author.name}</span>
              </span>
            )}
            {book.publisher && (
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 text-gold">
                  <path d="M3 9h18M9 21V9" />
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                </svg>
                {book.publisher.name}
              </span>
            )}
            {book.year && (
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 text-gold">
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <path d="M16 2v4M8 2v4M3 10h18" />
                </svg>
                {book.year}
              </span>
            )}
          </div>

          {book.inventory?.stock != null && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-gold" />
              متوفر منه {book.inventory.stock} نسخة
            </div>
          )}

          {book.description && (
            <div className="mt-2 rounded-2xl border border-border/60 bg-card/60 p-5">
              <p className="text-sm font-semibold text-muted-foreground">عن الكتاب</p>
              <p className="mt-2 leading-relaxed text-foreground/90">{book.description}</p>
            </div>
          )}

          <div className="mt-2">
            <RequestDialog
              defaultBookName={book.title}
              trigger={
                <button
                  type="button"
                  className="inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-7 text-sm font-bold text-primary-foreground shadow-warm transition-all hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-warm-lg"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                    <path d="M9 11l3 3L22 4" />
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                  </svg>
                  اطلب هذا الكتاب
                </button>
              }
            />
          </div>
        </div>
      </div>

      {/* Recommendations */}
      {(recsLoading || recommendations.length > 0) && (
        <section>
          <div className="mb-5 flex items-center gap-3">
            <span className="h-6 w-1 rounded-full bg-gold" />
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
    </div>
  );
}
