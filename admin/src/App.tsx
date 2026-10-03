import { lazy, useEffect, type ReactElement } from "react";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { isAuthed } from "@/lib/auth";

import LoginPage from "@/pages/login";
import AdminLayout from "@/components/admin/admin-layout";
// Pages load on demand: the login screen and the shell come first, and a
// page's code (the cover scanner, charts, forms) only when it is opened.
const OverviewPage = lazy(() => import("@/pages/admin/overview"));
const OrdersPage = lazy(() => import("@/pages/admin/orders"));
const OrderDetailPage = lazy(() => import("@/pages/admin/order-detail"));
const AdminRequestsPage = lazy(() => import("@/pages/admin/requests"));
const BooksAdminPage = lazy(() => import("@/pages/admin/books"));
const QuickAddPage = lazy(() => import("@/pages/admin/quick-add"));
const CatalogPage = lazy(() => import("@/pages/admin/catalog"));
const AcademicAdminPage = lazy(() => import("@/pages/admin/academic"));
const InventoryPage = lazy(() => import("@/pages/admin/inventory"));
const SocialContentPage = lazy(() => import("@/pages/admin/social-content"));
import { features } from "@/lib/features";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);
  return null;
}

/** Client-side gate: no token → login screen. (The API enforces the real auth.) */
function RequireAuth({ children }: { children: ReactElement }) {
  if (!isAuthed()) return <Navigate to="/admin/login" replace />;
  return children;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ScrollToTop />
        <Routes>
          <Route path="admin/login" element={<LoginPage />} />
          <Route
            path="admin"
            element={
              <RequireAuth>
                <AdminLayout />
              </RequireAuth>
            }
          >
            <Route index element={<OverviewPage />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="orders/:id" element={<OrderDetailPage />} />
            <Route path="requests" element={<AdminRequestsPage />} />
            <Route path="books" element={<BooksAdminPage />} />
            <Route path="quick-add" element={<QuickAddPage />} />
            <Route path="catalog" element={<Navigate to="/admin/catalog/categories" replace />} />
            <Route path="catalog/:resource" element={<CatalogPage />} />
            <Route
              path="academic"
              element={features.academic ? <AcademicAdminPage /> : <Navigate to="/admin" replace />}
            />
            <Route path="inventory" element={<InventoryPage />} />
            <Route path="social-content" element={<SocialContentPage />} />
          </Route>

          {/* Anything outside /admin → send to the dashboard home */}
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
