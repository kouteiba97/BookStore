import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

type ToastKind = "success" | "error" | "info";

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastCtx {
  push: (message: string, kind?: ToastKind) => void;
  success: (m: string) => void;
  error: (m: string) => void;
  info: (m: string) => void;
}

const Ctx = createContext<ToastCtx | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((message: string, kind: ToastKind = "info") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, message }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 3500);
  }, []);

  const ctx: ToastCtx = {
    push,
    success: (m) => push(m, "success"),
    error: (m) => push(m, "error"),
    info: (m) => push(m, "info"),
  };

  return (
    <Ctx.Provider value={ctx}>
      {children}
      <div
        dir="rtl"
        className="pointer-events-none fixed top-4 left-4 right-4 z-[100] flex flex-col items-end gap-2 sm:left-auto sm:right-6 sm:max-w-sm"
      >
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} />
        ))}
      </div>
    </Ctx.Provider>
  );
}

function ToastCard({ toast }: { toast: Toast }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShow(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const styles =
    toast.kind === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : toast.kind === "error"
        ? "border-rose-200 bg-rose-50 text-rose-800"
        : "border-border bg-card text-foreground";

  return (
    <div
      className={`pointer-events-auto w-full rounded-xl border px-4 py-3 text-sm font-medium shadow-warm transition-all duration-200 ${styles} ${
        show ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
      }`}
    >
      {toast.message}
    </div>
  );
}

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
