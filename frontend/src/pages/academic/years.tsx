import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import BookCard from "@/components/book-card";
import { RequestDialog } from "@/components/lazy-dialogs";
import { fetchYears, fetchFields, fetchFieldBooks } from "@/lib/queries";

export default function YearsPage() {
  const { fieldId } = useParams<{ fieldId: string }>();

  const { data: years = [], isLoading } = useQuery({
    queryKey: ["years", fieldId],
    queryFn: () => fetchYears(fieldId!),
    enabled: !!fieldId,
  });

  const { data: fields = [] } = useQuery({
    queryKey: ["fields"],
    queryFn: fetchFields,
  });

  // Every book under this speciality, at any depth — attached to the speciality
  // itself, to one of its years, or to one of its subjects.
  const { data: books = [], isLoading: booksLoading } = useQuery({
    queryKey: ["field-books", fieldId],
    queryFn: () => fetchFieldBooks(fieldId!),
    enabled: !!fieldId,
  });

  const field = fields.find((f) => f.id === fieldId);

  if (isLoading) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        جاري التحميل...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <nav className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/academic" className="transition-colors hover:text-foreground">
          التخصصات
        </Link>
        <span>/</span>
        <span className="font-medium text-foreground">
          {field?.name ?? "..."}
        </span>
      </nav>

      <section className="flex flex-col gap-4">
        <h1 className="font-heading text-2xl font-bold">السنوات الدراسية</h1>

        {years.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            لا توجد سنوات دراسية مسجّلة في هذا التخصص بعد.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {years.map((year) => (
              <Link
                key={year.id}
                to={`/academic/years/${year.id}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card p-5 transition-all hover:border-gold/40 hover:shadow-md hover:shadow-gold/5"
              >
                <span className="text-base font-semibold">{year.name}</span>
                <span className="flex items-center gap-3">
                  {typeof year.bookCount === "number" && (
                    <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                      {year.bookCount} كتاب
                    </span>
                  )}
                  <span className="text-muted-foreground">←</span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* All books of the speciality, so a book attached at speciality level
          (or to a year with no subjects yet) is never hidden. */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <span className="h-5 w-1 rounded-full bg-gold" />
          <h2 className="font-heading text-lg font-bold">
            كل كتب التخصص
            {books.length > 0 && (
              <span className="ms-2 text-sm font-normal text-muted-foreground">
                ({books.length})
              </span>
            )}
          </h2>
        </div>

        {booksLoading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-56 animate-pulse rounded-2xl bg-muted/50"
              />
            ))}
          </div>
        ) : books.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border/60 py-12">
            <p className="text-muted-foreground">
              لا توجد كتب حاليًا في هذا التخصص
            </p>
            <RequestDialog
              trigger={
                <span className="cursor-pointer text-primary underline underline-offset-4">
                  اطلب كتابًا لهذا التخصص
                </span>
              }
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {books.map((book) => (
              <BookCard key={book.id} book={book} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
