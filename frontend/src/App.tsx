import { useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Layout from "@/components/layout";
import HomePage from "@/pages/home";
import SearchPage from "@/pages/search";
import BookPage from "@/pages/book";
import FieldsPage from "@/pages/academic/fields";
import YearsPage from "@/pages/academic/years";
import SubjectsPage from "@/pages/academic/subjects";
import SubjectBooksPage from "@/pages/academic/subject-books";

import AdminLayout from "@/components/admin/admin-layout";
import OverviewPage from "@/pages/admin/overview";
import OrdersPage from "@/pages/admin/orders";
import OrderDetailPage from "@/pages/admin/order-detail";
import AdminRequestsPage from "@/pages/admin/requests";
import BooksAdminPage from "@/pages/admin/books";
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

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ScrollToTop />
        <Routes>
          {/* Admin */}
          <Route path="admin" element={<AdminLayout />}>
            <Route index element={<OverviewPage />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="orders/:id" element={<OrderDetailPage />} />
            <Route path="requests" element={<AdminRequestsPage />} />
            <Route path="books" element={<BooksAdminPage />} />
            <Route path="catalog" element={<Navigate to="/admin/catalog/categories" replace />} />
            <Route path="catalog/:resource" element={<CatalogPage />} />
            <Route path="academic" element={<AcademicAdminPage />} />
            <Route path="inventory" element={<InventoryPage />} />
          </Route>

          {/* Public */}
          <Route element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="search" element={<SearchPage />} />
            <Route path="books/:id" element={<BookPage />} />
            <Route path="academic" element={<FieldsPage />} />
            <Route path="academic/:fieldId" element={<YearsPage />} />
            <Route path="academic/years/:yearId" element={<SubjectsPage />} />
            <Route path="academic/subjects/:subjectId" element={<SubjectBooksPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
