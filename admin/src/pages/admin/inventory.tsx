import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchInventory, updateInventory } from "@/lib/admin-api";
import type { AdminBook, InventoryStatus } from "@/lib/admin-types";
import {
  EmptyState,
  StatusBadge,
  Surface,
  TableSkeleton,
  inputClass,
  selectClass,
} from "@/components/admin/primitives";
import { useToast } from "@/components/admin/toaster";

const INV_LABEL: Record<InventoryStatus, string> = {
  available: "متوفر",
  on_request: "حسب الطلب",
  rare: "نادر",
};

export default function InventoryPage() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [lowStock, setLowStock] = useState(params.get("lowStock") === "true");

  useEffect(() => {
    const next = new URLSearchParams(params);
    if (lowStock) next.set("lowStock", "true");
    else next.delete("lowStock");
    setParams(next, { replace: true });
  }, [lowStock]);

  const { data, isLoading } = useQuery<AdminBook[]>({
    queryKey: ["admin-inventory", search, status, lowStock],
    queryFn: () =>
      fetchInventory({
        search: search || undefined,
        status: status || undefined,
        lowStock,
      }),
  });

  const books = data ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث بعنوان الكتاب..."
            className={`${inputClass} pr-9`}
          />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${selectClass} h-10 w-auto`}>
          <option value="">كل الحالات</option>
          <option value="available">متوفر</option>
          <option value="on_request">حسب الطلب</option>
          <option value="rare">نادر</option>
        </select>
        <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-border/60 bg-card px-3 text-xs font-medium">
          <input
            type="checkbox"
            checked={lowStock}
            onChange={(e) => setLowStock(e.target.checked)}
            className="h-3.5 w-3.5"
          />
          مخزون منخفض فقط
        </label>
      </div>

      {isLoading ? (
        <TableSkeleton rows={6} cols={4} />
      ) : books.length === 0 ? (
        <EmptyState title="لا توجد عناصر" description="لا تتطابق أي كتب مع الفلاتر الحالية." />
      ) : (
        <Surface className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-muted/40 text-xs">
                <th className="px-4 py-3 text-right font-semibold text-muted-foreground">الكتاب</th>
                <th className="px-4 py-3 text-right font-semibold text-muted-foreground">التصنيف</th>
                <th className="px-4 py-3 text-right font-semibold text-muted-foreground">الحالة</th>
                <th className="px-4 py-3 text-right font-semibold text-muted-foreground">الكمية</th>
              </tr>
            </thead>
            <tbody>
              {books.map((b) => (
                <InventoryRow key={b.id} book={b} />
              ))}
            </tbody>
          </table>
        </Surface>
      )}
    </div>
  );
}

function InventoryRow({ book }: { book: AdminBook }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [status, setStatus] = useState<InventoryStatus>(book.inventory?.status ?? "available");
  const [stock, setStock] = useState<string>(
    book.inventory?.stock !== null && book.inventory?.stock !== undefined
      ? String(book.inventory.stock)
      : "",
  );

  const dirty =
    status !== (book.inventory?.status ?? "available") ||
    stock !== (book.inventory?.stock !== null && book.inventory?.stock !== undefined ? String(book.inventory.stock) : "");

  const mutation = useMutation({
    mutationFn: () =>
      updateInventory(book.id, {
        status,
        stock: stock === "" ? null : Number(stock),
      }),
    onSuccess: () => {
      toast.success("تم التحديث");
      qc.invalidateQueries({ queryKey: ["admin-inventory"] });
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message || "تعذّر التحديث"),
  });

  const isLow =
    status === "rare" ||
    (stock !== "" && Number(stock) <= 3);

  return (
    <tr className={`border-b border-border/40 last:border-0 transition-colors ${isLow ? "bg-amber-50/40" : "hover:bg-muted/30"}`}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="h-12 w-9 shrink-0 overflow-hidden rounded bg-muted">
            {book.imageUrl && <img src={book.imageUrl} alt="" className="h-full w-full object-cover" />}
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold">{book.title}</p>
            <p className="truncate text-xs text-muted-foreground">{book.author?.name ?? "—"}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground">{book.category?.name ?? "—"}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as InventoryStatus)}
            className="h-8 rounded-lg border border-input bg-background px-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-ring/30"
          >
            <option value="available">متوفر</option>
            <option value="on_request">حسب الطلب</option>
            <option value="rare">نادر</option>
          </select>
          <StatusBadge status={status} label={INV_LABEL[status]} />
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            className="h-8 w-20 rounded-lg border border-input bg-background px-2 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-ring/30"
            placeholder="—"
          />
          {dirty && (
            <button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              className="h-8 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground transition-all hover:brightness-110 disabled:opacity-50"
            >
              {mutation.isPending ? "..." : "حفظ"}
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
