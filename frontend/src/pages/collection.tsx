import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import BookCard from "@/components/book-card";
import { BookGridSkeleton } from "@/components/book-card-skeleton";
import { fetchHomeShelf } from "@/lib/queries";
import NotFoundPage from "@/pages/not-found";

/** «عرض الكل» for a home page shelf the admin built (e.g. جديد معرض الكتاب). */
export default function CollectionPage() {
  const { id } = useParams<{ id: string }>();

  const { data: shelf, isLoading, isError } = useQuery({
    queryKey: ["home-shelf", id],
    queryFn: () => fetchHomeShelf(id!),
    enabled: !!id,
  });

  if (isError) return <NotFoundPage />;

  return (
    <div className="flex flex-col gap-6">
      <nav className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/" className="transition-colors hover:text-foreground">
          الرئيسية
        </Link>
        <span>/</span>
        <span className="font-medium text-foreground">{shelf?.title ?? "…"}</span>
      </nav>

      <div>
        <h1 className="font-heading text-2xl font-bold sm:text-3xl">{shelf?.title}</h1>
        {shelf?.subtitle && <p className="mt-2 text-sm text-muted-foreground">{shelf.subtitle}</p>}
      </div>

      {isLoading || !shelf ? (
        <BookGridSkeleton count={8} />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {shelf.books.map((book) => (
            <BookCard key={book.id} book={book} />
          ))}
        </div>
      )}
    </div>
  );
}
