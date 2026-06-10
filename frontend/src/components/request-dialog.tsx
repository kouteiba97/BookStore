import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { WilayaSelect } from "@/components/wilaya-select";
import { createRequest } from "@/lib/queries";

interface FormState {
  firstName: string;
  lastName: string;
  phone: string;
  wilaya: string;
  address: string;
  bookName: string;
}

type FormErrors = Partial<Record<keyof FormState, boolean>>;

const EMPTY: FormState = {
  firstName: "",
  lastName: "",
  phone: "",
  wilaya: "",
  address: "",
  bookName: "",
};

export default function RequestDialog({
  defaultBookName = "",
  trigger,
}: {
  defaultBookName?: string;
  trigger?: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>({ ...EMPTY, bookName: defaultBookName });
  const [errors, setErrors] = useState<FormErrors>({});
  const [success, setSuccess] = useState(false);

  const set = (field: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));

  const mutation = useMutation({
    mutationFn: createRequest,
    onSuccess: (data: { id: string; whatsappUrl: string }) => {
      setSuccess(true);
      // The lead is saved server-side; continue the conversation on WhatsApp.
      if (data?.whatsappUrl) {
        window.open(data.whatsappUrl, "_blank", "noopener,noreferrer");
      }
      setTimeout(() => {
        setOpen(false);
        setSuccess(false);
        setForm({ ...EMPTY, bookName: defaultBookName });
      }, 2500);
    },
  });

  function validate(): boolean {
    const e: FormErrors = {};
    if (!form.bookName.trim()) e.bookName = true;
    if (!form.firstName.trim()) e.firstName = true;
    if (!form.lastName.trim()) e.lastName = true;
    if (!form.phone.trim()) e.phone = true;
    if (!form.wilaya) e.wilaya = true;
    if (form.address.trim().length < 10) e.address = true; // backend MinLength(10)
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    mutation.mutate({
      bookName: form.bookName.trim(),
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      phone: form.phone.trim(),
      wilaya: form.wilaya,
      address: form.address.trim(),
    });
  };

  const errCls = (on?: boolean) =>
    on ? "border-destructive ring-2 ring-destructive/20" : "";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          trigger ?? (
            <span className="inline-flex h-9 cursor-pointer items-center justify-center rounded-lg border border-gold/30 bg-gold-light/40 px-5 text-sm font-medium text-foreground transition-colors hover:bg-gold-light/70">
              اطلب كتاب
            </span>
          )
        }
        nativeButton={false}
      />
      <DialogContent dir="rtl" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-right text-lg">طلب كتاب</DialogTitle>
        </DialogHeader>
        {success ? (
          <div className="py-8 text-center">
            <p className="text-lg font-semibold text-primary">تم إرسال طلبك بنجاح ✓</p>
            <p className="mt-2 text-sm text-muted-foreground">سنتواصل معك قريبا</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            {/* Book name */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">
                اسم الكتاب <span className="text-destructive">*</span>
              </label>
              <Input
                value={form.bookName}
                onChange={set("bookName")}
                placeholder="أدخل اسم الكتاب"
                className={errCls(errors.bookName)}
              />
            </div>

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

            {/* Address */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">
                العنوان <span className="text-destructive">*</span>
              </label>
              <textarea
                value={form.address}
                onChange={set("address")}
                placeholder="الحي، الشارع، رقم المنزل..."
                rows={2}
                className={`w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${errCls(errors.address)}`}
              />
              {errors.address && (
                <p className="text-xs text-destructive">العنوان قصير جدًا (10 أحرف على الأقل)</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={mutation.isPending}>
              {mutation.isPending ? "جاري الإرسال..." : "إرسال الطلب"}
            </Button>
            {mutation.isError && (
              <p className="text-center text-sm text-destructive">
                حدث خطأ، حاول مرة أخرى
              </p>
            )}
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
