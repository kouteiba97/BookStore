import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "@/lib/admin-api";
import { setToken } from "@/lib/auth";
import { LogoMark } from "@/components/logo";
import { Button, inputClass } from "@/components/admin/primitives";

export default function LoginPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password || pending) return;
    setPending(true);
    setError("");
    try {
      const { token } = await login(password);
      setToken(token);
      navigate("/admin", { replace: true });
    } catch (err: any) {
      setError(
        err?.response?.status === 401
          ? "كلمة المرور غير صحيحة"
          : err?.response?.data?.message || "تعذّر الاتصال بالخادم",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div dir="rtl" className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border/60 bg-card p-8 shadow-warm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <LogoMark className="h-14 w-14" />
          <h1 className="font-heading text-xl font-bold">مكتبة البيان</h1>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">لوحة التحكم</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">كلمة المرور</span>
            <input
              type="password"
              autoFocus
              className={inputClass}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </label>

          {error && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-center text-sm font-medium text-rose-700 ring-1 ring-rose-200">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={!password || pending}>
            {pending ? "جاري الدخول..." : "دخول"}
          </Button>
        </form>
      </div>
    </div>
  );
}
