import { useEffect, type ReactElement } from "react";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { isAuthed } from "@/lib/auth";

import LoginPage from "@/pages/login";
import AdminLayout from "@/components/admin/admin-layout";
import OverviewPage from "@/pages/admin/overview";
import OrdersPage from "@/pages/admin/orders";
import OrderDetailPage from "@/pages/admin/order-detail";
import AdminRequestsPage from "@/pages/admin/requests";
import BooksAdminPage from "@/pages/admin/books";
import QuickAddPage from "@/pages/admin/quick-add";
import CatalogPage from "@/pages/admin/catalog";
import AcademicAdminPage from "@/pages/admin/academic";
import InventoryPage from "@/pages/admin/inventory";

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
            <Route path="academic" element={<AcademicAdminPage />} />
            <Route path="inventory" element={<InventoryPage />} />
          </Route>

          {/* Anything outside /admin → send to the dashboard home */}
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
