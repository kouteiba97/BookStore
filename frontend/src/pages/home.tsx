import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import SearchBox from "@/components/search-box";
import BookCard from "@/components/book-card";
import { BookGridSkeleton } from "@/components/book-card-skeleton";
import RequestDialog from "@/components/request-dialog";
import { LogoShamsa } from "@/components/logo";
import { fetchBooks, fetchFields } from "@/lib/queries";

const categories = [
  { name: "فقه", icon: "⚖️", query: "فقه" },
  { name: "حديث", icon: "📜", query: "حديث" },
  { name: "قرآن", icon: "📖", query: "قرآن" },
  { name: "عقيدة", icon: "🕌", query: "عقيدة" },
  { name: "تاريخ", icon: "🏛️", query: "تاريخ" },
  { name: "لغة عربية", icon: "✍️", query: "لغة عربية" },
  { name: "فلسفة", icon: "💡", query: "فلسفة" },
  { name: "تزكية", icon: "🤲", query: "تزكية" },
];

const fieldIcons: Record<string, string> = {
  "شريعة": "⚖️",
  "أصول الدين": "🕌",
  "فقه وأصوله": "📜",
  "الحديث وعلومه": "🕋",
  "العقيدة": "🤲",
  "التفسير وعلوم القرآن": "📖",
  "الدعوة والثقافة الإسلامية": "🌍",
};

function SectionHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="h-6 w-1 rounded-full bg-gold" />
        <h2 className="font-heading text-xl font-bold sm:text-2xl">{title}</h2>
      </div>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}

export default function HomePage() {
  const { data: books = [], isLoading: booksLoading } = useQuery({
    queryKey: ["books"],
    queryFn: fetchBooks,
  });

  const { data: fields = [], isLoading: fieldsLoading } = useQuery({
    queryKey: ["fields"],
    queryFn: fetchFields,
  });

  return (
    <div className="flex flex-col gap-14">
      {/* ── Hero ── */}
      <section className="relative overflow-hidden rounded-3xl border border-border/60 bg-paper px-6 py-12 text-center sm:px-12 sm:py-16">
        <div className="pointer-events-none absolute -top-24 right-1/2 h-64 w-64 translate-x-1/2 rounded-full bg-gold/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-0 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative">
          <LogoShamsa className="mx-auto h-32 w-32 drop-shadow-[0_8px_24px_rgba(31,58,46,0.18)] sm:h-40 sm:w-40" />
          <span className="mt-7 inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold-light/50 px-3.5 py-1 text-xs font-semibold text-[oklch(0.38_0.08_75)]">
            <span className="h-1.5 w-1.5 rounded-full bg-gold" />
            مكتبة شرعية متخصصة
          </span>
          <h1 className="mt-5 font-heading text-3xl font-bold leading-tight tracking-tight sm:text-5xl">
            اكتشف كنوز <span className="text-gold">العلم الشرعي</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            آلاف الكتب في الفقه، الحديث، التفسير، العقيدة واللغة. ابحث، تصفّح، أو اطلب الكتاب الذي تحتاجه.
          </p>
          <div className="mx-auto mt-7 max-w-2xl">
            <SearchBox size="large" />
          </div>
        </div>
      </section>

      {/* ── Categories ── */}
      <section>
        <SectionHeader title="تصفّح حسب التصنيف" hint={`${categories.length} تصنيف`} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {categories.map((cat) => (
            <Link
              key={cat.name}
              to={`/search?q=${encodeURIComponent(cat.query)}`}
              className="group flex flex-col items-center justify-center gap-3 rounded-2xl border border-border/60 bg-card px-4 py-7 text-center outline-none transition-all hover:-translate-y-1 hover:border-gold/45 hover:shadow-warm focus-visible:ring-2 focus-visible:ring-gold/60"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gold-light/60 text-3xl ring-1 ring-gold/15 transition-all group-hover:bg-gold-light group-hover:ring-gold/30">
                {cat.icon}
              </span>
              <span className="text-sm font-bold">{cat.name}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Academic ── */}
      <section className="relative overflow-hidden rounded-3xl border border-gold/25 bg-gradient-to-br from-gold-light/40 via-card to-card p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-gold/10 blur-3xl" />
        <div className="relative">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3 w-3">
                  <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                  <path d="M6 12v5c3 3 9 3 12 0v-5" />
                </svg>
                للطلبة والأساتذة
              </span>
              <h2 className="mt-2 font-heading text-xl font-bold sm:text-2xl">
                المراجع الأكاديمية حسب التخصص
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                اختر تخصصك للوصول إلى مقررات السنوات والمواد
              </p>
            </div>
          </div>
          {fieldsLoading ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-2xl bg-muted/50" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {fields.map((field) => (
                <Link
                  key={field.id}
                  to={`/academic/${field.id}`}
                  className="group flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-4 outline-none transition-all hover:-translate-y-0.5 hover:border-gold/40 hover:shadow-warm focus-visible:ring-2 focus-visible:ring-gold/60"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gold-light/70 text-xl ring-1 ring-gold/20 transition-transform group-hover:scale-105">
                    {fieldIcons[field.name] ?? "📚"}
                  </span>
                  <span className="flex-1 text-sm font-bold">{field.name}</span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 -translate-x-1 text-muted-foreground/40 transition-all group-hover:translate-x-0 group-hover:text-gold">
                    <path d="m15 18-6-6 6-6" />
                  </svg>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Latest Books ── */}
      <section>
        <SectionHeader title="أحدث الإضافات" hint="جديدنا في المكتبة" />
        {booksLoading ? (
          <BookGridSkeleton count={8} />
        ) : books.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {books.slice(0, 8).map((book) => (
              <BookCard key={book.id} book={book} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 py-14 text-center text-sm text-muted-foreground">
            لا توجد كتب لعرضها حاليًا
          </div>
        )}
      </section>

      {/* ── Most Requested ── */}
      {books.length > 8 && (
        <section>
          <SectionHeader title="الأكثر طلبًا" hint="اختيارات قراء المكتبة" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {books.slice(8, 16).map((book) => (
              <BookCard key={book.id} book={book} />
            ))}
          </div>
        </section>
      )}

      {/* ── CTA — Request Book ── */}
      <section className="rounded-3xl border border-gold/25 bg-gradient-to-br from-[#1F3A2E] to-[#2A5A42] px-6 py-10 text-center sm:px-12">
        <h2 className="font-heading text-2xl font-bold text-gold sm:text-3xl">
          لم تجد الكتاب الذي تبحث عنه؟
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-gold/60">
          أرسل لنا طلبك وسنوفّره لك في أقرب وقت
        </p>
        <div className="mt-6 flex items-center justify-center">
          <RequestDialog
            trigger={
              <span
                className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-gold/30 bg-gold px-7 py-3 text-sm font-bold text-[#1F3A2E] shadow-lg transition-all hover:-translate-y-0.5 hover:bg-gold/90 hover:shadow-xl active:scale-[0.97]"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                اطلب كتابك الآن
              </span>
            }
          />
        </div>
      </section>
    </div>
  );
}
