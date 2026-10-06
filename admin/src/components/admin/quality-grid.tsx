import { Link } from "react-router-dom";
import type { DataQuality } from "@/lib/admin-api";

const ITEMS: { key: keyof DataQuality; label: string; missing: string }[] = [
  { key: "noPrice", label: "بدون سعر بيع", missing: "price" },
  { key: "noCover", label: "بدون صورة غلاف", missing: "cover" },
  { key: "noAuthor", label: "بدون مؤلف", missing: "author" },
  { key: "uncategorized", label: "بدون تصنيف", missing: "category" },
  { key: "noStock", label: "بدون كمية مخزون", missing: "stock" },
  { key: "outOfStock", label: "نفدت كميتها (0)", missing: "outOfStock" },
];

/** "What is still missing" counts, each opening the books list filtered to it. */
export function QualityGrid({ quality }: { quality: DataQuality }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {ITEMS.map((i) => {
        const n = quality[i.key];
        const ok = n === 0;
        return (
          <Link
            key={i.key}
            to={`/admin/books?missing=${i.missing}`}
            className={`rounded-xl border px-4 py-3 transition-colors ${
              ok ? "pointer-events-none border-emerald-200 bg-emerald-50/50" : "border-amber-200 bg-amber-50/60 hover:bg-amber-50"
            }`}
          >
            <p className={`text-xl font-bold tabular-nums ${ok ? "text-emerald-700" : "text-amber-800"}`}>
              {ok ? "✓" : n.toLocaleString("ar-DZ")}
            </p>
            <p className="text-xs text-muted-foreground">{i.label}</p>
          </Link>
        );
      })}
    </div>
  );
}
