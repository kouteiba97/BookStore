import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CustomerFields, PayOnDeliveryNote } from "@/components/customer-fields";
import { initialCustomer, useCustomerForm } from "@/lib/customer-form";
import { useAccount } from "@/lib/account";
import { useAfterOrder } from "@/lib/after-order";
import { OrderConfirmation } from "@/components/order-confirmation";
import { formatDzd } from "@/lib/format";
import { apiErrorMessage, createOrder } from "@/lib/queries";
import { useSavedCustomer } from "@/lib/saved-customer";
import type { Book, PlacedOrder } from "@/lib/types";

// ── Order form (one book) ────────────────────────────────

/**
 * «اطلب هذا الكتاب»: a one-book checkout. The order is saved with a number the
 * customer keeps, and the dialog then explains exactly what happens next. It
 * stays open until the customer closes it.
 */
function OrderForm({ book, onPlaced, onClose }: { book: Book; onPlaced: (o: PlacedOrder) => void; onClose: () => void }) {
  const saved = useSavedCustomer();
  const account = useAccount();
  const afterOrder = useAfterOrder();
  const f = useCustomerForm(initialCustomer(account.customer, saved.value));
  const [website, setWebsite] = useState(""); // honeypot
  const [placed, setPlaced] = useState<PlacedOrder | null>(null);

  const authorLine = (book.authors ?? []).map((a) => a.name).join("، ");

  const mutation = useMutation({
    mutationFn: createOrder,
    onSuccess: (order) => {
      saved.remember(f.values());
      afterOrder(f.values());
      setPlaced(order);
      onPlaced(order);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.validate()) return;
    mutation.mutate({ ...f.values(), items: [{ bookId: book.id, quantity: 1 }], website });
  }

  if (placed) return <OrderConfirmation order={placed} onTrack={onClose} />;

  return (
    <form onSubmit={handleSubmit} className="relative flex flex-col gap-4" noValidate>
      {/* Honeypot: invisible and unfocusable for people. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        className="pointer-events-none absolute h-0 w-0 border-0 p-0 opacity-0"
      />

      {/* Book recap */}
      <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-muted-foreground/70">الكتاب المطلوب</p>
          <p className="line-clamp-1 text-sm font-bold text-foreground">{book.title}</p>
          {authorLine && <p className="line-clamp-1 text-xs text-muted-foreground">{authorLine}</p>}
        </div>
        <span className="shrink-0 text-sm font-bold text-primary">
          {Number(book.price) > 0 ? formatDzd(Number(book.price)) : <span className="text-xs font-medium text-muted-foreground">السعر عند التأكيد</span>}
        </span>
      </div>

      <CustomerFields f={f} compact />

      {mutation.isError && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
          {apiErrorMessage(mutation.error, "لم يُرسَل الطلب. تحقّق من الاتصال وأعد المحاولة.")}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <button
          type="submit"
          disabled={mutation.isPending}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 active:scale-[0.98] disabled:opacity-60"
        >
          {mutation.isPending ? "جاري الإرسال…" : "إرسال الطلب"}
        </button>
        <PayOnDeliveryNote />
      </div>
    </form>
  );
}

// ── Modal ────────────────────────────────────────────────

export default function OrderModal({
  book,
  trigger,
  initialOpen = false,
}: {
  book: Book;
  trigger: React.ReactElement;
  /** Open on mount — used when the dialog is loaded on the first click. */
  initialOpen?: boolean;
}) {
  const [open, setOpen] = useState(initialOpen);
  const [placed, setPlaced] = useState(false);
  // A fresh form each time the dialog opens after an order went through.
  const [round, setRound] = useState(0);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next && placed) {
          setPlaced(false);
          setRound((r) => r + 1);
        }
      }}
    >
      <DialogTrigger render={trigger} nativeButton={false} />
      <DialogContent dir="rtl" className="max-h-[92dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-right text-lg">
            {placed ? "طلبك" : "طلب الكتاب"}
          </DialogTitle>
        </DialogHeader>
        <OrderForm key={round} book={book} onPlaced={() => setPlaced(true)} onClose={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
