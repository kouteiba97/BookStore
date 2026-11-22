import { useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { FormError, Labeled, PasswordField, PhoneField, Submit } from "@/components/account-form";
import { WhatsAppGlyph } from "@/components/order-confirmation";
import { login, register, useAccount } from "@/lib/account";
import { apiErrorMessage } from "@/lib/queries";
import { whatsappNumber } from "@/lib/store-info";

/**
 * /account/login — log in or create an account. An account is a convenience
 * (details remembered, orders listed); nobody needs one to order.
 */
export default function AccountLoginPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const account = useAccount();
  const next = safeNext(params.get("next"));
  const [tab, setTab] = useState<"login" | "register">(params.get("tab") === "register" ? "register" : "login");

  if (account.loggedIn) return <Navigate to={next} replace />;

  const done = (session: Parameters<typeof account.start>[0]) => {
    account.start(session);
    navigate(next, { replace: true });
  };

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6" dir="rtl">
      <header className="text-center">
        <h1 className="font-heading text-2xl font-bold">{tab === "login" ? "تسجيل الدخول" : "حساب جديد"}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          الحساب اختياري: يحفظ بيانات التوصيل ويجمع طلباتك في مكان واحد.
        </p>
      </header>

      <div className="grid grid-cols-2 rounded-xl bg-muted p-1" role="tablist" aria-label="الدخول أو إنشاء حساب">
        {(["login", "register"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`h-10 rounded-lg text-sm font-semibold transition-colors ${tab === t ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            {t === "login" ? "لديّ حساب" : "حساب جديد"}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm sm:p-5">
        {tab === "login" ? <LoginForm onDone={done} /> : <RegisterForm onDone={done} />}
      </div>

      <p className="text-center text-sm text-muted-foreground">
        تريد الطلب دون حساب؟{" "}
        <Link to="/" className="font-semibold text-primary hover:underline">تابع التسوّق</Link>
      </p>
    </div>
  );
}

/** Only same-site paths, so the link cannot send people elsewhere. */
function safeNext(v: string | null) {
  return v && v.startsWith("/") && !v.startsWith("//") ? v : "/account";
}

type Done = (s: Awaited<ReturnType<typeof login>>) => void;

function LoginForm({ onDone }: { onDone: Done }) {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const m = useMutation({ mutationFn: () => login(phone.trim(), password), onSuccess: onDone });

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (phone.trim() && password) m.mutate();
      }}
    >
      <PhoneField value={phone} onChange={setPhone} />
      <PasswordField value={password} onChange={setPassword} autoComplete="current-password" />
      {m.isError && <FormError>{apiErrorMessage(m.error, "تعذّر تسجيل الدخول. أعد المحاولة.")}</FormError>}
      <Submit pending={m.isPending}>دخول</Submit>
      <a
        href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent("السلام عليكم، نسيت كلمة مرور حسابي في موقع المكتبة. رقمي: " + phone)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-[#1f7a4a]"
      >
        <WhatsAppGlyph className="h-4 w-4" />
        نسيت كلمة المرور؟ راسلنا وسنرسل لك رابطًا
      </a>
    </form>
  );
}

function RegisterForm({ onDone }: { onDone: Done }) {
  const [v, setV] = useState({ firstName: "", lastName: "", phone: "", password: "", email: "" });
  const [local, setLocal] = useState<string | null>(null);
  const set = (k: keyof typeof v) => (value: string) => setV((s) => ({ ...s, [k]: value }));
  const m = useMutation({
    mutationFn: () =>
      register({
        firstName: v.firstName.trim(),
        lastName: v.lastName.trim(),
        phone: v.phone.trim(),
        password: v.password,
        ...(v.email.trim() ? { email: v.email.trim() } : {}),
      }),
    onSuccess: onDone,
  });

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!v.firstName.trim() || !v.lastName.trim()) return setLocal("الاسم واللقب مطلوبان");
        if (v.password.length < 8) return setLocal("كلمة المرور 8 أحرف على الأقل");
        setLocal(null);
        m.mutate();
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <Labeled label="الاسم">
          <Input value={v.firstName} onChange={(e) => set("firstName")(e.target.value)} autoComplete="given-name" className="h-11" />
        </Labeled>
        <Labeled label="اللقب">
          <Input value={v.lastName} onChange={(e) => set("lastName")(e.target.value)} autoComplete="family-name" className="h-11" />
        </Labeled>
      </div>
      <PhoneField value={v.phone} onChange={set("phone")} hint="ستسجّل الدخول بهذا الرقم" />
      <PasswordField value={v.password} onChange={set("password")} autoComplete="new-password" hint="8 أحرف على الأقل" />
      <Labeled label="البريد الإلكتروني" optional>
        <Input type="email" value={v.email} onChange={(e) => set("email")(e.target.value)} autoComplete="email" dir="ltr" className="h-11 text-left" />
      </Labeled>
      {(local || m.isError) && <FormError>{local ?? apiErrorMessage(m.error, "تعذّر إنشاء الحساب. أعد المحاولة.")}</FormError>}
      <Submit pending={m.isPending}>إنشاء الحساب</Submit>
      <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
        بإنشاء حساب توافق على <Link to="/terms" className="underline">شروط الاستخدام</Link> و<Link to="/privacy" className="underline">سياسة الخصوصية</Link>.
      </p>
    </form>
  );
}
