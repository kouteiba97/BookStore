import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchYears, fetchFields } from "@/lib/queries";

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

  const field = fields.find((f) => f.id === fieldId);

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
        <span className="text-foreground font-medium">{field?.name ?? "..."}</span>
      </nav>

      <h1 className="font-heading text-2xl font-bold">السنوات الدراسية</h1>

      {years.length === 0 && (
        <p className="py-16 text-center text-muted-foreground">لا توجد سنوات دراسية</p>
      )}

      <div className="flex flex-col gap-2">
        {years.map((year) => (
          <Link
            key={year.id}
            to={`/academic/years/${year.id}`}
            className="flex items-center justify-between rounded-xl border border-border/60 bg-card p-5 transition-all hover:border-gold/40 hover:shadow-md hover:shadow-gold/5"
          >
            <span className="text-base font-semibold">{year.name}</span>
            <span className="text-muted-foreground">←</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
