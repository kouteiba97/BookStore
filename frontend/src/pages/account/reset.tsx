import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { FormError, PasswordField, Submit } from "@/components/account-form";
import { resetPassword, useAccount } from "@/lib/account";
import { apiErrorMessage } from "@/lib/queries";

/**
 * /account/reset?token=… — the one-time link the shop sends on WhatsApp to a
 * customer who forgot their password. Works once, for 48 hours.
 */
export default function AccountResetPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const navigate = useNavigate();
  const account = useAccount();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [local, setLocal] = useState<string | null>(null);

  const m = useMutation({
    mutationFn: () => resetPassword(token, password),
    onSuccess: (session) => {
      account.start(session);
      navigate("/account", { replace: true });
    },
  });

  if (!token) {
    return (
      <div className="mx-auto max-w-md py-10 text-center" dir="rtl">
        <h1 className="font-heading text-2xl font-bold">الرابط ناقص</h1>
        <p className="mt-2 text-sm text-muted-foreground">افتح الرابط كاملًا كما وصلك على واتساب، أو اطلب رابطًا جديدًا من المكتبة.</p>
        <Link to="/account/login" className="mt-4 inline-block font-semibold text-primary hover:underline">تسجيل الدخول</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6" dir="rtl">
      <header className="text-center">
        <h1 className="font-heading text-2xl font-bold">كلمة مرور جديدة</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">اختر كلمة مرور جديدة لحسابك. ستدخل مباشرة بعد الحفظ.</p>
      </header>
      <form
        className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-card p-4 shadow-sm sm:p-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (password.length < 8) return setLocal("كلمة المرور 8 أحرف على الأقل");
          if (password !== confirm) return setLocal("كلمتا المرور غير متطابقتين");
          setLocal(null);
          m.mutate();
        }}
      >
        <PasswordField label="كلمة المرور الجديدة" value={password} onChange={setPassword} autoComplete="new-password" hint="8 أحرف على الأقل" />
        <PasswordField label="أعد كتابتها" value={confirm} onChange={setConfirm} autoComplete="new-password" />
        {(local || m.isError) && <FormError>{local ?? apiErrorMessage(m.error, "تعذّر الحفظ. أعد المحاولة.")}</FormError>}
        <Submit pending={m.isPending}>حفظ والدخول</Submit>
      </form>
    </div>
  );
}
