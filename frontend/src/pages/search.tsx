import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import BookCard from "@/components/book-card";
import { BookGridSkeleton } from "@/components/book-card-skeleton";
import SearchBox from "@/components/search-box";
import RequestDialog from "@/components/request-dialog";
import { searchBooks, fetchSuggestions } from "@/lib/queries";

export default function SearchPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const q = params.get("q") ?? "";

  const { data: books = [], isLoading } = useQuery({
    queryKey: ["search", q],
    queryFn: () => searchBooks(q),
    enabled: q.length >= 2,
  });

  const { data: suggestions } = useQuery({
    queryKey: ["suggestions", q],
    queryFn: () => fetchSuggestions(q),
    enabled: q.length >= 2,
  });

  const hasChips =
    (suggestions?.categories.length ?? 0) > 0 ||
    (suggestions?.authors.length ?? 0) > 0;

  return (
    <div className="flex flex-col gap-7">
      <div className="mx-auto w-full max-w-2xl">
        <SearchBox size="large" />
      </div>

      {q && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card/60 px-4 py-3">
          <p className="text-sm text-muted-foreground">
            نتائج البحث عن:{" "}
            <span className="font-bold text-foreground">«{q}»</span>
          </p>
          {books.length > 0 && (
            <span className="rounded-full bg-gold-light/60 px-3 py-1 text-xs font-bold text-[oklch(0.38_0.08_75)] ring-1 ring-gold/25">
              {books.length} نتيجة
            </span>
          )}
        </div>
      )}

      {!isLoading && hasChips && (
        <div className="flex flex-wrap gap-2">
          {suggestions!.authors.map((author) => (
            <button
              key={`a-${author.id}`}
              onClick={() => navigate(`/search?q=${encodeURIComponent(author.name)}`)}
              className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card px-3 py-1.5 text-xs font-medium transition-all hover:-translate-y-0.5 hover:border-gold/50 hover:shadow-warm"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3 text-gold">
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              {author.name}
            </button>
          ))}
          {suggestions!.categories.map((cat) => (
            <button
              key={`c-${cat.id}`}
              onClick={() => navigate(`/search?q=${encodeURIComponent(cat.name)}`)}
              className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card px-3 py-1.5 text-xs font-medium transition-all hover:-translate-y-0.5 hover:border-gold/50 hover:shadow-warm"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3 text-primary">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {isLoading && <BookGridSkeleton count={8} />}

      {!isLoading && q.length >= 2 && books.length === 0 && (
        <div className="flex flex-col items-center gap-4 rounded-3xl border border-dashed border-border bg-card/50 py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground/50">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </div>
          <div>
            <p className="text-lg font-bold">لم يتم العثور على نتائج</p>
            <p className="mt-1 text-sm text-muted-foreground">
              جرّب كلمات أخرى، أو اطلب الكتاب منّا مباشرة
            </p>
          </div>
          <RequestDialog
            defaultBookName={q}
            trigger={
              <button
                type="button"
                className="mt-1 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-warm transition-all hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-warm-lg"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                اطلب «{q}»
              </button>
            }
          />
        </div>
      )}

      {!isLoading && books.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {books.map((book) => (
            <BookCard key={book.id} book={book} />
          ))}
        </div>
      )}

      {!q && (
        <div className="rounded-3xl border border-dashed border-border bg-card/50 py-16 text-center text-sm text-muted-foreground">
          ابدأ بكتابة كلمة البحث في الأعلى
        </div>
      )}

      {/* ── CTA — Request Book ── */}
      {!isLoading && q.length >= 2 && books.length > 0 && (
        <section className="rounded-3xl border border-gold/25 bg-gradient-to-br from-[#1F3A2E] to-[#2A5A42] px-6 py-10 text-center sm:px-12">
          <h2 className="font-heading text-2xl font-bold text-gold sm:text-3xl">
            لم تجد الكتاب الذي تبحث عنه؟
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-gold/60">
            أرسل لنا طلبك وسنوفّره لك في أقرب وقت
          </p>
          <div className="mt-6 flex items-center justify-center">
            <RequestDialog
              defaultBookName={q}
              trigger={
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold px-7 py-3 text-sm font-bold text-[#1F3A2E] shadow-lg transition-all hover:-translate-y-0.5 hover:bg-gold/90 hover:shadow-xl active:scale-[0.97]"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  اطلب كتابك الآن
                </button>
              }
            />
          </div>
        </section>
      )}
    </div>
  );
}
