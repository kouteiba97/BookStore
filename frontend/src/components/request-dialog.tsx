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
import { createRequest } from "@/lib/queries";

export default function RequestDialog({
  defaultBookName = "",
  trigger,
}: {
  defaultBookName?: string;
  trigger?: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [bookName, setBookName] = useState(defaultBookName);
  const [userPhone, setUserPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [success, setSuccess] = useState(false);

  const mutation = useMutation({
    mutationFn: createRequest,
    onSuccess: () => {
      setSuccess(true);
      setTimeout(() => {
        setOpen(false);
        setSuccess(false);
        setBookName("");
        setUserPhone("");
        setNotes("");
      }, 2000);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookName.trim() || !userPhone.trim()) return;
    mutation.mutate({
      bookName: bookName.trim(),
      userPhone: userPhone.trim(),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    });
  };

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
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">اسم الكتاب</label>
              <Input
                value={bookName}
                onChange={(e) => setBookName(e.target.value)}
                placeholder="أدخل اسم الكتاب"
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">رقم الهاتف</label>
              <Input
                value={userPhone}
                onChange={(e) => setUserPhone(e.target.value)}
                placeholder="0555 000 000"
                type="tel"
                dir="ltr"
                className="text-left"
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-muted-foreground">ملاحظات (اختياري)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="مثلاً: طبعة معينة، دار نشر، أو تفاصيل إضافية..."
                rows={2}
                className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={mutation.isPending}
            >
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
