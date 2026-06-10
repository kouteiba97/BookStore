import { useEffect, useState, type ReactElement } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { LogoMark } from "@/components/logo";
import { clearToken } from "@/lib/auth";
import { ToastProvider } from "./toaster";

// Where "عرض المتجر" points — the public storefront (separate app/origin).
const PUBLIC_SITE_URL = import.meta.env.VITE_PUBLIC_SITE_URL ?? "http://localhost:5173/";

interface NavItem {
  to: string;
  label: string;
  icon: ReactElement;
  badge?: number;
}

// ── Icon set (24px stroke, current color) ─────────────────

const Icon = {
  home: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-[18px] w-[18px]">
      <path d="M3 12 12 4l9 8" /><path d="M5 10v10h14V10" />
    </svg>
  ),
  orders: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-[18px] w-[18px]">
      <path d="M3 6h18l-2 13H5L3 6Z" /><path d="M9 10v0M15 10v0" /><path d="M3 6 5 3h14l2 3" />
    </svg>
  ),
  requests: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-[18px] w-[18px]">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />
    </svg>
  ),
  books: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-[18px] w-[18px]">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
    </svg>
  ),
  catalog: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-[18px] w-[18px]">
      <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  academic: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-[18px] w-[18px]">
      <path d="M22 10 12 5 2 10l10 5 10-5Z" /><path d="M6 12v5a6 6 0 0 0 12 0v-5" />
    </svg>
  ),
  inventory: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-[18px] w-[18px]">
      <path d="M21 8v13H3V8" /><path d="M1 3h22v5H1z" /><path d="M10 12h4" />
    </svg>
  ),
  quickAdd: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-[18px] w-[18px]">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="3.5" /><path d="M12 10v6M9 13h6" />
    </svg>
  ),
  chevron: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
      <path d="m9 6 6 6-6 6" />
    </svg>
  ),
  menu: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  ),
  panelToggle: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" />
    </svg>
  ),
  external: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
      <path d="M7 17 17 7M7 7h10v10" />
    </svg>
  ),
};

const NAV: NavItem[] = [
  { to: "/admin", label: "نظرة عامة", icon: Icon.home },
  { to: "/admin/orders", label: "الطلبات", icon: Icon.orders },
  { to: "/admin/requests", label: "طلبات العملاء", icon: Icon.requests },
  { to: "/admin/books", label: "الكتب", icon: Icon.books },
  { to: "/admin/quick-add", label: "إضافة سريعة", icon: Icon.quickAdd },
  { to: "/admin/catalog/categories", label: "التصنيفات", icon: Icon.catalog },
  { to: "/admin/academic", label: "الأكاديمي", icon: Icon.academic },
  { to: "/admin/inventory", label: "المخزون", icon: Icon.inventory },
];

const PAGE_TITLES: Record<string, string> = {
  "/admin": "نظرة عامة",
  "/admin/orders": "إدارة الطلبات",
  "/admin/requests": "طلبات العملاء",
  "/admin/books": "إدارة الكتب",
  "/admin/quick-add": "إضافة سريعة",
  "/admin/catalog/categories": "التصنيفات",
  "/admin/catalog/authors": "المؤلفون",
  "/admin/catalog/publishers": "دور النشر",
  "/admin/catalog/countries": "الدول",
  "/admin/academic": "النظام الأكاديمي",
  "/admin/inventory": "المخزون",
};

function getPageTitle(pathname: string) {
  if (pathname.startsWith("/admin/orders/")) return "تفاصيل الطلب";
  if (pathname.startsWith("/admin/books/")) return "تفاصيل الكتاب";
  return PAGE_TITLES[pathname] ?? "لوحة التحكم";
}

export default function AdminLayout() {
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Persist collapsed state
  useEffect(() => {
    const stored = localStorage.getItem("admin-sidebar-collapsed");
    if (stored === "1") setCollapsed(true);
  }, []);
  useEffect(() => {
    localStorage.setItem("admin-sidebar-collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  const sidebarWidth = collapsed ? "lg:w-[72px]" : "lg:w-64";

  return (
    <ToastProvider>
      <div dir="rtl" className="min-h-screen bg-muted/40 text-foreground">
        {/* ── Mobile top bar ── */}
        <div className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border/60 bg-background/95 px-4 backdrop-blur-sm lg:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 hover:bg-muted"
            aria-label="فتح القائمة"
          >
            {Icon.menu}
          </button>
          <Link to="/admin" className="flex items-center gap-2">
            <LogoMark className="h-7 w-7" />
            <span className="font-heading text-base font-bold">لوحة التحكم</span>
          </Link>
          <div className="w-9" />
        </div>

        {/* ── Mobile drawer ── */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              className="absolute inset-0 bg-foreground/30 backdrop-blur-sm animate-in fade-in"
              onClick={() => setMobileOpen(false)}
              aria-label="إغلاق"
            />
            <aside className="absolute right-0 top-0 h-full w-72 animate-in slide-in-from-right duration-200">
              <Sidebar collapsed={false} onToggle={() => setMobileOpen(false)} pathname={pathname} mobile />
            </aside>
          </div>
        )}

        {/* ── Desktop sidebar ── */}
        <aside
          className={`fixed inset-y-0 right-0 z-30 hidden border-l border-border/60 bg-card transition-[width] duration-200 ease-out lg:flex ${sidebarWidth}`}
        >
          <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} pathname={pathname} />
        </aside>

        {/* ── Main ── */}
        <main className={`flex min-h-screen flex-col transition-[padding] duration-200 ${collapsed ? "lg:pr-[72px]" : "lg:pr-64"}`}>
          <PageHeader pathname={pathname} />

          <div className="flex-1 px-4 pb-12 pt-4 sm:px-6 lg:px-8">
            <div key={pathname} className="animate-in fade-in slide-in-from-bottom-1 duration-200">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </ToastProvider>
  );
}

// ── Sidebar ───────────────────────────────────────────────

function Sidebar({
  collapsed,
  onToggle,
  pathname,
  mobile = false,
}: {
  collapsed: boolean;
  onToggle: () => void;
  pathname: string;
  mobile?: boolean;
}) {
  return (
    <div className="flex h-full w-full flex-col bg-card">
      {/* Brand */}
      <div className={`flex h-16 items-center gap-2.5 border-b border-border/60 px-4 ${collapsed ? "justify-center" : ""}`}>
        <LogoMark className="h-9 w-9 shrink-0" />
        {!collapsed && (
          <div className="min-w-0">
            <p className="font-heading text-base font-bold leading-tight">مكتبة البيان</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">لوحة التحكم</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-4">
        <ul className="space-y-0.5">
          {NAV.map((item) => {
            const active = isItemActive(item.to, pathname);
            return (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to === "/admin"}
                  className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  } ${collapsed ? "justify-center px-2" : ""}`}
                  title={collapsed ? item.label : undefined}
                >
                  {/* Active indicator (right edge for RTL) */}
                  {active && (
                    <span className="absolute right-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-l-full bg-primary" />
                  )}
                  <span className={active ? "text-primary" : "text-muted-foreground/80"}>{item.icon}</span>
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="border-t border-border/60 p-2">
        {!mobile && (
          <button
            onClick={onToggle}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground ${
              collapsed ? "justify-center" : ""
            }`}
            title={collapsed ? "توسيع" : "طي القائمة"}
          >
            <span>{Icon.panelToggle}</span>
            {!collapsed && <span>طي القائمة</span>}
          </button>
        )}
        <a
          href={PUBLIC_SITE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={`mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground ${
            collapsed ? "justify-center" : ""
          }`}
          title="عرض المتجر"
        >
          {Icon.external}
          {!collapsed && <span>عرض المتجر</span>}
        </a>
        <LogoutButton collapsed={collapsed} />
      </div>
    </div>
  );
}

function LogoutButton({ collapsed }: { collapsed: boolean }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => {
        clearToken();
        navigate("/admin/login", { replace: true });
      }}
      className={`mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-50 ${
        collapsed ? "justify-center" : ""
      }`}
      title="تسجيل الخروج"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <path d="m16 17 5-5-5-5M21 12H9" />
      </svg>
      {!collapsed && <span>تسجيل الخروج</span>}
    </button>
  );
}

function isItemActive(to: string, pathname: string) {
  if (to === "/admin") return pathname === "/admin" || pathname === "/admin/";
  if (to.startsWith("/admin/catalog/")) return pathname.startsWith("/admin/catalog");
  return pathname === to || pathname.startsWith(`${to}/`);
}

// ── Page header with breadcrumbs ──────────────────────────

function PageHeader({ pathname }: { pathname: string }) {
  const title = getPageTitle(pathname);
  const crumbs = buildCrumbs(pathname);

  return (
    <div className="border-b border-border/60 bg-background/80 px-4 py-4 backdrop-blur-sm sm:px-6 lg:px-8">
      <Breadcrumbs crumbs={crumbs} />
      <h1 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
    </div>
  );
}

function Breadcrumbs({ crumbs }: { crumbs: { label: string; to?: string }[] }) {
  return (
    <nav aria-label="breadcrumb">
      <ol className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
        {crumbs.map((c, i) => (
          <li key={i} className="flex items-center gap-1">
            {i > 0 && <span className="rotate-180 opacity-40">{Icon.chevron}</span>}
            {c.to ? (
              <Link to={c.to} className="rounded px-1 py-0.5 transition-colors hover:bg-muted hover:text-foreground">
                {c.label}
              </Link>
            ) : (
              <span className="px-1 py-0.5 font-medium text-foreground">{c.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

function buildCrumbs(pathname: string): { label: string; to?: string }[] {
  const root = { label: "لوحة التحكم", to: "/admin" };

  if (pathname === "/admin" || pathname === "/admin/") return [{ label: "نظرة عامة" }];

  if (pathname.startsWith("/admin/orders/")) {
    return [root, { label: "الطلبات", to: "/admin/orders" }, { label: "تفاصيل" }];
  }
  if (pathname.startsWith("/admin/books/")) {
    return [root, { label: "الكتب", to: "/admin/books" }, { label: "تفاصيل" }];
  }
  if (pathname.startsWith("/admin/catalog/")) {
    const seg = pathname.split("/")[3];
    const labels: Record<string, string> = {
      categories: "التصنيفات",
      authors: "المؤلفون",
      publishers: "دور النشر",
      countries: "الدول",
    };
    return [root, { label: labels[seg] ?? "الكتالوج" }];
  }
  return [root, { label: getPageTitle(pathname) }];
}
