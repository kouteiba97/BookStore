import { useState } from "react";
import { Input } from "@/components/ui/input";

/** Small form parts shared by the account pages. */

export function Labeled({ label, optional, hint, children }: { label: string; optional?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium">
      <span>
        {label}
        {optional && <span className="mr-1 text-xs font-normal text-muted-foreground">(اختياري)</span>}
      </span>
      {children}
      {hint && <span className="text-xs font-normal text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function PhoneField({ value, onChange, hint }: { value: string; onChange: (v: string) => void; hint?: string }) {
  return (
    <Labeled label="رقم الهاتف" hint={hint}>
      <Input type="tel" inputMode="tel" autoComplete="tel" dir="ltr" placeholder="05 XX XX XX XX" value={value} onChange={(e) => onChange(e.target.value)} className="h-11 text-left" />
    </Labeled>
  );
}

export function PasswordField({
  value,
  onChange,
  autoComplete,
  label = "كلمة المرور",
  hint,
}: {
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  label?: string;
  hint?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <Labeled label={label} hint={hint}>
      <div className="relative">
        <Input type={show ? "text" : "password"} autoComplete={autoComplete} dir="ltr" value={value} onChange={(e) => onChange(e.target.value)} className="h-11 pl-16 text-left" />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute top-1/2 left-2 -translate-y-1/2 rounded-md px-2 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted"
          aria-label={show ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
        >
          {show ? "إخفاء" : "إظهار"}
        </button>
      </div>
    </Labeled>
  );
}

export function FormError({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
      {children}
    </p>
  );
}

export function Submit({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-12 w-full rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-warm transition-colors hover:bg-primary/90 active:scale-[0.98] disabled:opacity-60"
    >
      {pending ? "لحظة…" : children}
    </button>
  );
}
