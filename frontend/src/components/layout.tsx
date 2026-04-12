import { Link, Outlet, useLocation } from "react-router-dom";

export default function Layout() {
  const { pathname } = useLocation();

  const navLinks = [
    { to: "/", label: "الرئيسية" },
    { to: "/academic", label: "الأكاديمي" },
    { to: "/search", label: "البحث" },
  ];

  const isActive = (to: string) =>
    to === "/" ? pathname === "/" : pathname.startsWith(to);

  return (
    <div dir="rtl" className="flex min-h-screen flex-col bg-background">
      {/* ── Header ── */}
      <header className="sticky top-0 z-50 border-b border-gold/15 bg-[oklch(0.20_0.03_155)]/95 backdrop-blur-md supports-[backdrop-filter]:bg-[oklch(0.20_0.03_155)]/80">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="group flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold/15 text-gold ring-1 ring-gold/25 transition-all group-hover:bg-gold/25 group-hover:ring-gold/40">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4.5 w-4.5">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
              </svg>
            </span>
            <span className="font-heading text-xl font-bold text-gold tracking-tight">
              مكتبة البيان
            </span>
          </Link>

          <nav className="flex items-center gap-1 text-sm">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`rounded-lg px-3 py-1.5 transition-all ${
                  isActive(link.to)
                    ? "bg-gold/15 font-semibold text-gold"
                    : "text-gold/65 hover:bg-gold/10 hover:text-gold/95"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <Outlet />
      </main>

      {/* ── Footer ── */}
      <footer className="mt-12 border-t border-border/60 bg-[oklch(0.20_0.03_155)] text-gold/70">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3 sm:px-6">
          <div className="sm:col-span-2">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold/15 text-gold ring-1 ring-gold/25">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                  <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                </svg>
              </span>
              <span className="font-heading text-lg font-bold text-gold">مكتبة البيان</span>
            </div>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-gold/55">
              مكتبة متخصصة في الكتب الشرعية والعلوم الإسلامية والمراجع الأكاديمية. نوفّر لك ما تحتاجه من مصادر موثوقة.
            </p>
          </div>
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gold/50">روابط</p>
            <ul className="flex flex-col gap-2 text-sm">
              {navLinks.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className="text-gold/70 transition-colors hover:text-gold">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="border-t border-gold/10">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 text-xs text-gold/45 sm:px-6">
            <span>© {new Date().getFullYear()} مكتبة البيان</span>
            <span>جميع الحقوق محفوظة</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
