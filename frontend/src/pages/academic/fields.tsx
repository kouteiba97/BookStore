import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchFields } from "@/lib/queries";

const fieldIcons: Record<string, string> = {
  "شريعة": "⚖️",
  "أصول الدين": "🕌",
  "فقه وأصوله": "📜",
  "الحديث وعلومه": "🕋",
  "العقيدة": "🤲",
  "التفسير وعلوم القرآن": "📖",
  "الدعوة والثقافة الإسلامية": "🌍",
};

export default function FieldsPage() {
  const { data: fields = [], isLoading } = useQuery({
    queryKey: ["fields"],
    queryFn: fetchFields,
  });

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <Link
          to="/"
          className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
            <path d="m9 18 6-6-6-6" />
          </svg>
          الرئيسية
        </Link>
        <div className="flex items-start gap-3">
          <span className="mt-1.5 h-7 w-1 rounded-full bg-gold" />
          <div>
            <h1 className="font-heading text-3xl font-bold">التخصصات الأكاديمية</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              اختر التخصص للوصول إلى مقررات السنوات والمواد الدراسية
            </p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted/50" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {fields.map((field) => (
            <Link
              key={field.id}
              to={`/academic/${field.id}`}
              className="group flex items-center gap-4 rounded-2xl border border-border/60 bg-card p-5 outline-none transition-all hover:-translate-y-1 hover:border-gold/45 hover:shadow-warm focus-visible:ring-2 focus-visible:ring-gold/60"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gold-light/70 text-2xl ring-1 ring-gold/20 transition-transform group-hover:scale-105">
                {fieldIcons[field.name] ?? "📚"}
              </span>
              <span className="flex-1 text-base font-bold">{field.name}</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 -translate-x-1 text-muted-foreground/40 transition-all group-hover:translate-x-0 group-hover:text-gold">
                <path d="m15 18-6-6 6-6" />
              </svg>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
