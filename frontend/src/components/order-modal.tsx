import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { WilayaSelect } from "@/components/wilaya-select";
import { createRequest } from "@/lib/queries";
import type { Book } from "@/lib/types";

// ── Order Form ───────────────────────────────────────────

interface OrderFormState {
  firstName: string;
  lastName: string;
  phone: string;
  wilaya: string;
  address: string;
  /** Honeypot — must stay empty. */
  website: string;
}

type FormErrors = Partial<Record<keyof OrderFormState, boolean>>;

const EMPTY: OrderFormState = {
  firstName: "",
  lastName: "",
  phone: "",
  wilaya: "",
  address: "",
  website: "",
};

function OrderForm({ book, onClose }: { book: Book; onClose: () => void }) {
  const [form, setForm] = useState<OrderFormState>({ ...EMPTY });
  const [errors, setErrors] = useState<FormErrors>({});
  const [success, setSuccess] = useState(false);

  const authorLine = (book.authors ?? []).map((a) => a.name).join("، ");

  const set = (field: keyof OrderFormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const mutation = useMutation({
    mutationFn: createRequest,
    onSuccess: (data: { id: string; whatsappUrl: string }) => {
      setSuccess(true);
      // The order is recorded server-side first; WhatsApp only continues the
      // conversation. Previously this opened WhatsApp and saved nothing, so an
      // order was lost whenever the customer did not send the message.
      if (data?.whatsappUrl) {
        window.open(data.whatsappUrl, "_blank", "noopener,noreferrer");
      }
      setTimeout(() => {
        onClose();
        setSuccess(false);
        setForm({ ...EMPTY });
      }, 2500);
    },
  });

  function validate(): boolean {
    const e: FormErrors = {};
    if (!form.firstName.trim()) e.firstName = true;
    if (!form.lastName.trim()) e.lastName = true;
    if (!form.phone.trim()) e.phone = true;
    if (!form.wilaya) e.wilaya = true;
    if (form.address.trim().length < 10) e.address = true; // backend MinLength(10)
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    mutation.mutate({
      bookId: book.id,
      bookName: book.title,
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      phone: form.phone.trim(),
      wilaya: form.wilaya,
      address: form.address.trim(),
      website: form.website,
    });
  }

  const errCls = (on?: boolean) =>
    on ? "border-destructive ring-2 ring-destructive/20" : "";

  if (success) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-2xl">
          ✓
        </span>
        <p className="font-semibold">تم تسجيل طلبك بنجاح</p>
        <p className="text-sm text-muted-foreground">سنتواصل معك قريبًا</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="relative flex flex-col gap-4" noValidate>
      {/* Honeypot: invisible and unfocusable for people, irresistible to bots.
          A non-empty value is rejected by the API. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        value={form.website}
        onChange={set("website")}
        className="pointer-events-none absolute h-0 w-0 border-0 p-0 opacity-0"
      />

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
            className={`h-9 ${errCls(errors.firstName)}`}
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
            className={`h-9 ${errCls(errors.lastName)}`}
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
          className={`h-9 text-left ${errCls(errors.phone)}`}
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

      {/* Address — required so the order can actually be delivered */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">
          العنوان <span className="text-destructive">*</span>
        </label>
        <textarea
          value={form.address}
          onChange={set("address")}
          rows={2}
          placeholder="الحي، الشارع، رقم المنزل..."
          className={`w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40 ${errCls(errors.address)}`}
        />
        {errors.address && (
          <span className="text-xs text-destructive">
            العنوان قصير جدًا (10 أحرف على الأقل)
          </span>
        )}
      </div>

      {/* Book recap */}
      <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/60">
          الكتاب المطلوب
        </p>
        <p className="mt-0.5 line-clamp-1 text-sm font-bold text-foreground">
          {book.title}
        </p>
        {authorLine && (
          <p className="text-xs text-muted-foreground">{authorLine}</p>
        )}
      </div>

      {mutation.isError && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
          حدث خطأ، حاول مرة أخرى
        </p>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={mutation.isPending}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#25D366] py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#1ead53] active:scale-[0.98] disabled:opacity-60"
      >
        {mutation.isPending ? (
          "جاري الإرسال..."
        ) : (
          <>
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            تأكيد الطلب عبر واتساب
          </>
        )}
      </button>

      <p className="text-center text-[11px] text-muted-foreground">
        يُسجَّل طلبك عندنا أولًا، ثم تُفتح محادثة واتساب لتأكيد التفاصيل.
      </p>
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
