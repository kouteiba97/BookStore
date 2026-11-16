import type { ReactNode } from "react";
import { prettyPhone } from "@/lib/format";

/**
 * The four moments of an order, the same everywhere the customer sees one:
 * right after ordering, on /track and in «طلباتي». Steps already done get a
 * check, the step in progress is highlighted, the rest wait in grey.
 *
 * `step` is the last step reached (0 received · 1 confirmed · 2 shipped ·
 * 3 delivered), as returned by the API.
 */
export function OrderTimeline({
  step,
  cancelled = false,
  phone,
  carrier,
  trackingNumber,
}: {
  step: number;
  cancelled?: boolean;
  /** The customer's phone — the number the shop will call. */
  phone?: string;
  carrier?: string | null;
  trackingNumber?: string | null;
}) {
  const steps: { title: string; body: ReactNode }[] = [
    {
      title: "استلمنا طلبك",
      body: "طلبك مسجّل عندنا، ولا تحتاج إلى فعل أي شيء آخر الآن.",
    },
    {
      title: step >= 1 ? "تم تأكيد الطلب" : "مكالمة التأكيد",
      body:
        step >= 1 ? (
          "أكّدنا الطلب معك ونجهّزه للشحن."
        ) : (
          <>
            سيتصل بك فريق مكتبة البيان
            {phone ? (
              <>
                {" "}على{" "}
                <bdi dir="ltr" className="whitespace-nowrap font-semibold text-foreground">{prettyPhone(phone)}</bdi>
              </>
            ) : null}{" "}
            خلال 24 ساعة (أيام العمل) لتأكيد توفّر الكتاب، السعر وتكلفة التوصيل.
          </>
        ),
    },
    {
      title: step >= 2 ? "تم الشحن" : "الشحن",
      body:
        step >= 2 ? (
          <>
            طلبك في الطريق إليك
            {carrier ? <> مع <span className="font-semibold text-foreground">{carrier}</span></> : null}.
            {trackingNumber ? (
              <span className="mt-1 flex items-center gap-1.5">
                رقم التتبّع:
                <bdi dir="ltr" className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-semibold text-foreground">
                  {trackingNumber}
                </bdi>
              </span>
            ) : null}
          </>
        ) : (
          "بعد التأكيد نشحن طلبك ونرسل لك رسالة على واتساب برقم التتبّع."
        ),
    },
    {
      title: step >= 3 ? "تم التسليم" : "الاستلام والدفع",
      body: step >= 3 ? "وصلك الطلب. شكرًا لثقتك بمكتبة البيان." : "تدفع عند الاستلام — لا دفع مسبق.",
    },
  ];

  return (
    <ol className="relative flex flex-col" aria-label="مراحل الطلب">
      {steps.map((s, i) => {
        const done = !cancelled && i <= step;
        const current = !cancelled && i === step + 1;
        const last = i === steps.length - 1;
        return (
          <li key={i} className="relative flex gap-3 pb-5 last:pb-0" aria-current={current ? "step" : undefined}>
            {/* Connector to the next step */}
            {!last && (
              <span
                aria-hidden="true"
                className={`absolute top-8 right-[13px] bottom-0 w-0.5 rounded-full ${done ? "bg-primary/70" : "bg-border"}`}
              />
            )}
            <span
              aria-hidden="true"
              className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ring-4 ring-background transition-colors ${
                done
                  ? "bg-primary text-primary-foreground"
                  : current
                    ? "bg-gold text-[#1F3A2E] shadow-[0_0_0_4px_color-mix(in_oklch,var(--gold)_25%,transparent)]"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {done ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              ) : (
                i + 1
              )}
            </span>
            <div className="min-w-0 pt-0.5">
              <p className={`text-sm font-bold ${done || current ? "text-foreground" : "text-muted-foreground"}`}>
                {s.title}
                {current && (
                  <span className="mr-2 inline-flex items-center rounded-full bg-gold-light px-2 py-0.5 align-middle text-[10px] font-semibold text-gold-ink">
                    الخطوة التالية
                  </span>
                )}
              </p>
              <p className={`mt-0.5 text-[13px] leading-relaxed ${done || current ? "text-muted-foreground" : "text-muted-foreground/70"}`}>
                {s.body}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
