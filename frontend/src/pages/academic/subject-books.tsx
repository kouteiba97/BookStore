import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import BookCard from "@/components/book-card";
import RequestDialog from "@/components/request-dialog";
import { fetchSubjectBooks } from "@/lib/queries";

export default function SubjectBooksPage() {
  const { subjectId } = useParams<{ subjectId: string }>();

  const { data: books = [], isLoading } = useQuery({
    queryKey: ["subject-books", subjectId],
    queryFn: () => fetchSubjectBooks(subjectId!),
    enabled: !!subjectId,
  });

  if (isLoading) {
    return <div className="py-16 text-center text-muted-foreground">جاري التحميل...</div>;
  }

  return (
    <div className="flex flex-col gap-6">
      <nav className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/academic" className="hover:text-foreground transition-colors">
          التخصصات
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">الكتب</span>
      </nav>

      <h1 className="font-heading text-2xl font-bold">الكتب المتوفرة</h1>

      {books.length === 0 && (
        <div className="flex flex-col items-center gap-4 py-16">
          <p className="text-muted-foreground">لا توجد كتب حاليا لهذه المادة</p>
          <RequestDialog
            trigger={
              <span className="cursor-pointer text-primary underline underline-offset-4">
                اطلب كتاب لهذه المادة
              </span>
            }
          />
        </div>
      )}

      {books.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {books.map((book) => (
            <BookCard key={book.id} book={book} />
          ))}
        </div>
      )}
    </div>
  );
}
