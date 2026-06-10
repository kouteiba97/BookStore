import { useState, useRef, useEffect } from "react";

// ── The 58 Algerian wilayas ──────────────────────────────

export const WILAYAS: { code: number; name: string }[] = [
  { code: 1, name: "أدرار" },
  { code: 2, name: "الشلف" },
  { code: 3, name: "الأغواط" },
  { code: 4, name: "أم البواقي" },
  { code: 5, name: "باتنة" },
  { code: 6, name: "بجاية" },
  { code: 7, name: "بسكرة" },
  { code: 8, name: "بشار" },
  { code: 9, name: "البليدة" },
  { code: 10, name: "البويرة" },
  { code: 11, name: "تمنراست" },
  { code: 12, name: "تبسة" },
  { code: 13, name: "تلمسان" },
  { code: 14, name: "تيارت" },
  { code: 15, name: "تيزي وزو" },
  { code: 16, name: "الجزائر" },
  { code: 17, name: "الجلفة" },
  { code: 18, name: "جيجل" },
  { code: 19, name: "سطيف" },
  { code: 20, name: "سعيدة" },
  { code: 21, name: "سكيكدة" },
  { code: 22, name: "سيدي بلعباس" },
  { code: 23, name: "عنابة" },
  { code: 24, name: "قالمة" },
  { code: 25, name: "قسنطينة" },
  { code: 26, name: "المدية" },
  { code: 27, name: "مستغانم" },
  { code: 28, name: "المسيلة" },
  { code: 29, name: "معسكر" },
  { code: 30, name: "ورقلة" },
  { code: 31, name: "وهران" },
  { code: 32, name: "البيض" },
  { code: 33, name: "إليزي" },
  { code: 34, name: "برج بوعريريج" },
  { code: 35, name: "بومرداس" },
  { code: 36, name: "الطارف" },
  { code: 37, name: "تندوف" },
  { code: 38, name: "تيسمسيلت" },
  { code: 39, name: "الوادي" },
  { code: 40, name: "خنشلة" },
  { code: 41, name: "سوق أهراس" },
  { code: 42, name: "تيبازة" },
  { code: 43, name: "ميلة" },
  { code: 44, name: "عين الدفلى" },
  { code: 45, name: "النعامة" },
  { code: 46, name: "عين تيموشنت" },
  { code: 47, name: "غرداية" },
  { code: 48, name: "غليزان" },
  { code: 49, name: "المغير" },
  { code: 50, name: "المنيعة" },
  { code: 51, name: "أولاد جلال" },
  { code: 52, name: "برج باجي مختار" },
  { code: 53, name: "بني عباس" },
  { code: 54, name: "تيميمون" },
  { code: 55, name: "تقرت" },
  { code: 56, name: "جانت" },
  { code: 57, name: "عين صالح" },
  { code: 58, name: "عين قزام" },
];

// ── Searchable wilaya combobox ───────────────────────────

export function WilayaSelect({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  error?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const filtered = WILAYAS.filter(
    (w) => w.name.includes(search) || w.code.toString().startsWith(search),
  );

  const selected = WILAYAS.find((w) => w.name === value);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => { setOpen((o) => !o); setSearch(""); }}
        className={`flex h-9 w-full items-center justify-between rounded-lg border bg-background px-3 text-sm transition-colors ${
          error
            ? "border-destructive ring-2 ring-destructive/20"
            : "border-input hover:border-ring focus:border-ring"
        }`}
      >
        <span className={selected ? "text-foreground" : "text-muted-foreground/60"}>
          {selected ? `${selected.code.toString().padStart(2, "0")} — ${selected.name}` : "اختر الولاية"}
        </span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute inset-x-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
          {/* Search */}
          <div className="border-b border-border p-2">
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث عن ولاية..."
              className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-ring"
            />
          </div>
          {/* Options */}
          <ul className="max-h-48 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-center text-sm text-muted-foreground">
                لا توجد نتائج
              </li>
            ) : (
              filtered.map((w) => (
                <li key={w.code}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(w.name);
                      setOpen(false);
                      setSearch("");
                    }}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-right text-sm transition-colors hover:bg-muted/60 ${
                      value === w.name ? "bg-primary/8 font-semibold text-primary" : ""
                    }`}
                  >
                    <span className="w-6 shrink-0 text-xs text-muted-foreground/60">
                      {w.code.toString().padStart(2, "0")}
                    </span>
                    {w.name}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
