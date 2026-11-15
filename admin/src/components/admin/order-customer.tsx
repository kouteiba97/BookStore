import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateOrderShipping } from "@/lib/admin-api";
import type { AdminOrder } from "@/lib/admin-types";
import { Button, Surface, inputClass } from "@/components/admin/primitives";
import { useToast } from "@/components/admin/toaster";

/**
 * Keeping the customer informed, at zero cost: a ready WhatsApp message for
 * each step of the order, and the delivery company + tracking number that
 * appear on the customer's /track page.
 */

const PUBLIC_SITE_URL = (import.meta.env.VITE_PUBLIC_SITE_URL ?? "http://localhost:5173/").replace(/\/?$/, "/");

/** "0555123456" → "213555123456" for wa.me. */
export function waNumber(phone: string) {
  const c = phone.replace(/\D/g, "");
  return c.startsWith("213") ? c : c.startsWith("0") ? `213${c.slice(1)}` : c;
}

const dzd = (v: string | number) => `${Number(v).toLocaleString("ar-DZ", { maximumFractionDigits: 0 })} دج`;

/** The message the customer should receive for the order's current status. */
export function statusMessage(order: AdminOrder): string {
  const ref = order.reference ? ` رقم ${order.reference}` : "";
  const hello = `السلام عليكم ${order.firstName}،`;
  const track = order.reference ? `\nتتبّع طلبك: ${PUBLIC_SITE_URL}track?ref=${order.reference}` : "";
  const books = order.items.map((it) => `📚 ${it.bookTitle}${it.quantity > 1 ? ` × ${it.quantity}` : ""}`).join("\n");

  switch (order.status) {
    case "pending":
      return `${hello}\nمعك مكتبة البيان بخصوص طلبك${ref}:\n${books}\n\nنودّ تأكيد الطلب معك قبل الشحن. هل يناسبك أن نتصل بك الآن؟`;
    case "confirmed":
      return `${hello}\nتم تأكيد طلبك${ref} ✅\n${books}\n\nالمبلغ عند الاستلام: ${dzd(order.total)} (شامل التوصيل).\nنجهّزه الآن وسنراسلك عند الشحن.${track}`;
    case "shipped":
      return [
        `${hello}`,
        `تم شحن طلبك${ref} 📦`,
        order.carrier ? `شركة التوصيل: ${order.carrier}` : "",
        order.trackingNumber ? `رقم التتبّع: ${order.trackingNumber}` : "",
        `المبلغ عند الاستلام: ${dzd(order.total)}.${track}`,
      ].filter(Boolean).join("\n");
    case "delivered":
      return `${hello}\nوصلك طلبك${ref} بحمد الله. شكرًا لثقتك بمكتبة البيان 🌿\nيسعدنا خدمتك دائمًا.`;
    case "cancelled":
      return `${hello}\nتم إلغاء طلبك${ref}. إن كان لديك أي استفسار فنحن في الخدمة.`;
  }
}

const NOTIFY_LABEL: Record<AdminOrder["status"], string> = {
  pending: "راسل الزبون لتأكيد الطلب",
  confirmed: "أبلغ الزبون بالتأكيد",
  shipped: "أبلغ الزبون بالشحن",
  delivered: "اشكر الزبون",
  cancelled: "أبلغ الزبون بالإلغاء",
};

export function NotifyCustomerButton({ order }: { order: AdminOrder }) {
  const href = `https://wa.me/${waNumber(order.phone)}?text=${encodeURIComponent(statusMessage(order))}`;
  return (
    <div className="flex flex-col gap-1.5">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-[#1f7a4a] text-sm font-semibold text-white transition-colors hover:bg-[#19663d]"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
          <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm4.5 12.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.7a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3Z" />
        </svg>
        إبلاغ الزبون عبر واتساب
      </a>
      <p className="text-center text-[11px] text-muted-foreground">{NOTIFY_LABEL[order.status]} — رسالة جاهزة تعدّلها قبل الإرسال</p>
    </div>
  );
}

/** Carrier + tracking number. Saved separately from the order lines. */
export function ShippingCard({ order }: { order: AdminOrder }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [carrier, setCarrier] = useState(order.carrier ?? "");
  const [tracking, setTracking] = useState(order.trackingNumber ?? "");

  useEffect(() => {
    setCarrier(order.carrier ?? "");
    setTracking(order.trackingNumber ?? "");
  }, [order.carrier, order.trackingNumber]);

  const dirty = carrier.trim() !== (order.carrier ?? "") || tracking.trim() !== (order.trackingNumber ?? "");

  const save = useMutation({
    mutationFn: () => updateOrderShipping(order.id, { carrier: carrier.trim() || null, trackingNumber: tracking.trim() || null }),
    onSuccess: () => {
      toast.success("حُفظت بيانات الشحن — تظهر للزبون في صفحة التتبّع");
      qc.invalidateQueries({ queryKey: ["admin-order", order.id] });
    },
    onError: () => toast.error("تعذّر حفظ بيانات الشحن"),
  });

  return (
    <Surface className="overflow-hidden">
      <div className="border-b border-border/60 px-5 py-3">
        <h3 className="text-sm font-bold">الشحن</h3>
        <p className="mt-0.5 text-[11px] text-muted-foreground">يظهر للزبون في صفحة «تتبّع طلبك» وفي رسالة الشحن.</p>
      </div>
      <form
        className="space-y-3 px-5 py-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (dirty) save.mutate();
        }}
      >
        <label className="block text-xs font-medium text-muted-foreground">
          شركة التوصيل
          <input className={`${inputClass} mt-1`} value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="Yalidine, ZR Express…" maxLength={60} list="carriers" />
          <datalist id="carriers">
            <option value="Yalidine" />
            <option value="ZR Express" />
            <option value="Maystro Delivery" />
            <option value="Ecotrack" />
            <option value="بريد الجزائر" />
            <option value="توصيل المكتبة" />
          </datalist>
        </label>
        <label className="block text-xs font-medium text-muted-foreground">
          رقم التتبّع
          <input className={`${inputClass} mt-1 font-mono`} dir="ltr" value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="YAL-12345678" maxLength={80} />
        </label>
        <Button type="submit" size="sm" variant="secondary" disabled={!dirty || save.isPending} className="w-full">
          {save.isPending ? "جاري الحفظ…" : "حفظ بيانات الشحن"}
        </Button>
      </form>
    </Surface>
  );
}
