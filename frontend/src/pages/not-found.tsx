import { Link } from "react-router-dom";
import { RequestDialog } from "@/components/lazy-dialogs";

/**
 * Catch-all 404. The host rewrites every unknown path to index.html so the SPA
 * can route it, which means a mistyped or dead link lands here rather than on a
 * blank page.
 */
export default function NotFoundPage() {
  return (
    <div className="flex flex-col items-center gap-6 py-20 text-center">
      <span className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gold-light/60 text-4xl ring-1 ring-gold/20">
        📕
      </span>

      <div className="flex flex-col gap-2">
        <p className="font-heading text-5xl font-bold text-gold-ink">404</p>
        <h1 className="font-heading text-2xl font-bold">
          هذه الصفحة غير موجودة
        </h1>
        <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
          ربما حُذف الكتاب أو تغيّر الرابط. يمكنك العودة إلى الرئيسية، أو البحث
          عن الكتاب الذي تريده، أو أن تطلبه منّا مباشرة.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Link
          to="/"
          className="inline-flex h-10 items-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          العودة إلى الرئيسية
        </Link>
        <Link
          to="/search"
          className="inline-flex h-10 items-center rounded-lg border border-border bg-card px-5 text-sm font-medium transition-colors hover:bg-muted"
        >
          البحث عن كتاب
        </Link>
        <RequestDialog
          trigger={
            <span className="inline-flex h-10 cursor-pointer items-center rounded-lg border border-gold/30 bg-gold-light/40 px-5 text-sm font-medium transition-colors hover:bg-gold-light/70">
              اطلب كتابًا
            </span>
          }
        />
      </div>
    </div>
  );
}
