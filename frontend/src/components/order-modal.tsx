import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Book } from "@/lib/types";

// ── Constants ────────────────────────────────────────────

const WHATSAPP_NUMBER = "213XXXXXXXXX";

const WILAYAS: { code: number; name: string }[] = [
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

// ── Wilaya Combobox ──────────────────────────────────────

function WilayaSelect({
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

  const filtered = WILAYAS.filter((w) =>
    w.name.includes(search) ||
    w.code.toString().startsWith(search)
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

// ── Order Form ───────────────────────────────────────────

interface OrderFormState {
  firstName: string;
  lastName: string;
  phone: string;
  wilaya: string;
}

type FormErrors = Partial<Record<keyof OrderFormState, boolean>>;

function OrderForm({ book, onClose }: { book: Book; onClose: () => void }) {
  const [form, setForm] = useState<OrderFormState>({
    firstName: "",
    lastName: "",
    phone: "",
    wilaya: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});

  const set = (field: keyof OrderFormState) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => setForm((f) => ({ ...f, [field]: e.target.value }));

  function validate(): boolean {
    const e: FormErrors = {};
    if (!form.firstName.trim()) e.firstName = true;
    if (!form.lastName.trim()) e.lastName = true;
    if (!form.phone.trim()) e.phone = true;
    if (!form.wilaya) e.wilaya = true;
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    const message = `السلام عليكم،
أريد طلب كتاب:

📚 ${book.title}${book.author ? `\n✍️ ${book.author.name}` : ""}

👤 الاسم: ${form.firstName.trim()} ${form.lastName.trim()}
📞 الهاتف: ${form.phone.trim()}
📍 الولاية: ${form.wilaya}`;

    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    onClose();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      {/* Name row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">
            الاسم <span className="text-destructive">*</span>
          </label>
          <Input
            value={form.firstName}
            onChange={set("firstName")}
            placeholder="محمد"
            className={`h-9 ${errors.firstName ? "border-destructive ring-2 ring-destructive/20" : ""}`}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">
            اللقب <span className="text-destructive">*</span>
          </label>
          <Input
            value={form.lastName}
            onChange={set("lastName")}
            placeholder="بن علي"
            className={`h-9 ${errors.lastName ? "border-destructive ring-2 ring-destructive/20" : ""}`}
          />
        </div>
      </div>

      {/* Phone */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">
          رقم الهاتف <span className="text-destructive">*</span>
        </label>
        <Input
          value={form.phone}
          onChange={set("phone")}
          placeholder="05 XX XX XX XX"
          type="tel"
          dir="ltr"
          className={`h-9 text-left ${errors.phone ? "border-destructive ring-2 ring-destructive/20" : ""}`}
        />
      </div>

      {/* Wilaya */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">
          الولاية <span className="text-destructive">*</span>
        </label>
        <WilayaSelect
          value={form.wilaya}
          onChange={(v) => {
            setForm((f) => ({ ...f, wilaya: v }));
            setErrors((e) => ({ ...e, wilaya: false }));
          }}
          error={errors.wilaya}
        />
      </div>

      {/* Book recap */}
      <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/60">
          الكتاب المطلوب
        </p>
        <p className="mt-0.5 text-sm font-bold text-foreground line-clamp-1">{book.title}</p>
        {book.author && (
          <p className="text-xs text-muted-foreground">{book.author.name}</p>
        )}
      </div>

      {/* Submit */}
      <button
        type="submit"
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#25D366] py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#1ead53] active:scale-[0.98]"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
        تأكيد الطلب عبر واتساب
      </button>
    </form>
  );
}

// ── Modal ────────────────────────────────────────────────

export default function OrderModal({
  book,
  trigger,
}: {
  book: Book;
  trigger: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} nativeButton={false} />
      <DialogContent dir="rtl" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-right text-lg">
            تأكيد الطلب
          </DialogTitle>
        </DialogHeader>
        <OrderForm book={book} onClose={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
