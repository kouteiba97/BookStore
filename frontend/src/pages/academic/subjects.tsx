import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchSubjects } from "@/lib/queries";

export default function SubjectsPage() {
  const { yearId } = useParams<{ yearId: string }>();

  const { data: subjects = [], isLoading } = useQuery({
    queryKey: ["subjects", yearId],
    queryFn: () => fetchSubjects(yearId!),
    enabled: !!yearId,
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
        <span className="text-foreground font-medium">المواد</span>
      </nav>

      <h1 className="font-heading text-2xl font-bold">المواد الدراسية</h1>

      {subjects.length === 0 && (
        <p className="py-16 text-center text-muted-foreground">لا توجد مواد دراسية</p>
      )}

      <div className="flex flex-col gap-2">
        {subjects.map((subject) => (
          <Link
            key={subject.id}
            to={`/academic/subjects/${subject.id}`}
            className="flex items-center justify-between rounded-xl border border-border/60 bg-card p-5 transition-all hover:border-gold/40 hover:shadow-md hover:shadow-gold/5"
          >
            <span className="text-base font-semibold">{subject.name}</span>
            <span className="text-muted-foreground">←</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
