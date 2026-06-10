import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { WilayaSelect } from "@/components/wilaya-select";
import type { Book } from "@/lib/types";

// ── Constants ────────────────────────────────────────────

// International format without "+". Overridable per environment.
const WHATSAPP_NUMBER = import.meta.env.VITE_WHATSAPP_NUMBER ?? "213777887762";

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
