import { Input } from "@/components/ui/input";
import { WilayaSelect } from "@/components/wilaya-select";
import type { CustomerForm } from "@/lib/customer-form";

/**
 * The delivery details a customer gives at checkout — one form for the
 * single-book dialog, the cart checkout and the account profile, so the rules
 * and the wording never drift apart.
 */

export function CustomerFields({ f, compact = false }: { f: CustomerForm; compact?: boolean }) {
  const { form, errors, set } = f;
  const h = compact ? "h-9" : "h-11";
  return (
    <div className="flex flex-col gap-3.5">
      <div className="grid grid-cols-2 gap-3">
        <Field label="الاسم" error={errors.firstName} htmlFor="cf-first">
          <Input id="cf-first" autoComplete="given-name" value={form.firstName} onChange={(e) => set("firstName", e.target.value)} placeholder="محمد" aria-invalid={!!errors.firstName} className={h} />
        </Field>
        <Field label="اللقب" error={errors.lastName} htmlFor="cf-last">
          <Input id="cf-last" autoComplete="family-name" value={form.lastName} onChange={(e) => set("lastName", e.target.value)} placeholder="بن علي" aria-invalid={!!errors.lastName} className={h} />
        </Field>
      </div>

      <Field label="رقم الهاتف" hint="سنتصل بك على هذا الرقم لتأكيد الطلب" error={errors.phone} htmlFor="cf-phone">
        <Input
          id="cf-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          dir="ltr"
          value={form.phone}
          onChange={(e) => set("phone", e.target.value)}
          placeholder="05 XX XX XX XX"
          aria-invalid={!!errors.phone}
          className={`${h} text-left`}
        />
      </Field>

      <Field label="الولاية" error={errors.wilaya}>
        <WilayaSelect value={form.wilaya} onChange={(v) => set("wilaya", v)} error={!!errors.wilaya} />
      </Field>

      <Field label="العنوان" error={errors.address} htmlFor="cf-address">
        <textarea
          id="cf-address"
          autoComplete="street-address"
          value={form.address}
          onChange={(e) => set("address", e.target.value)}
          rows={2}
          placeholder="الحي، الشارع، رقم المنزل، البلدية…"
          aria-invalid={!!errors.address}
          className="w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20"
        />
      </Field>
    </div>
  );
}

function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label} <span className="text-destructive">*</span>
      </label>
      {children}
      {error ? (
        <span role="alert" className="text-xs font-medium text-destructive">{error}</span>
      ) : hint ? (
        <span className="text-xs text-muted-foreground">{hint}</span>
      ) : null}
    </div>
  );
}

/** The reassurance under every "send order" button. */
export function PayOnDeliveryNote() {
  return (
    <p className="flex items-start justify-center gap-1.5 text-center text-xs leading-relaxed text-muted-foreground">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/70" aria-hidden="true">
        <rect x="3" y="11" width="18" height="10" rx="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
      لن تدفع شيئًا الآن — الدفع عند الاستلام بعد تأكيد الطلب هاتفيًا.
    </p>
  );
}
