import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Layout from "@/components/layout";
import HomePage from "@/pages/home";
import SearchPage from "@/pages/search";
import BookPage from "@/pages/book";
import FieldsPage from "@/pages/academic/fields";
import YearsPage from "@/pages/academic/years";
import SubjectsPage from "@/pages/academic/subjects";
import SubjectBooksPage from "@/pages/academic/subject-books";
import { PrivacyPage, TermsPage } from "@/pages/legal";
import NotFoundPage from "@/pages/not-found";
import CollectionPage from "@/pages/collection";
import LinksPage from "@/pages/links";
import TrackPage from "@/pages/track";
import CheckoutPage from "@/pages/checkout";
import { CartProvider } from "@/components/cart-provider";

// Account pages are visited by few people: load them on demand.
const AccountPage = lazy(() => import("@/pages/account/index"));
const AccountLoginPage = lazy(() => import("@/pages/account/login"));
const AccountResetPage = lazy(() => import("@/pages/account/reset"));
const pageFallback = <div className="mx-auto h-96 max-w-md animate-pulse rounded-2xl bg-muted" aria-hidden="true" />;
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

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <CartProvider>
        <ScrollToTop />
        <Routes>
          {/* Business-card QR target: a page of its own, without the site header. */}
          <Route path="links" element={<LinksPage />} />
          {/* Public */}
          <Route element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="search" element={<SearchPage />} />
            <Route path="books/:id" element={<BookPage />} />
            <Route path="collections/:id" element={<CollectionPage />} />
            <Route path="track" element={<TrackPage />} />
            <Route path="checkout" element={<CheckoutPage />} />
            <Route path="account" element={<Suspense fallback={pageFallback}><AccountPage /></Suspense>} />
            <Route path="account/login" element={<Suspense fallback={pageFallback}><AccountLoginPage /></Suspense>} />
            <Route path="account/reset" element={<Suspense fallback={pageFallback}><AccountResetPage /></Suspense>} />
            {features.academic ? (
              <>
                <Route path="academic" element={<FieldsPage />} />
                <Route path="academic/:fieldId" element={<YearsPage />} />
                <Route path="academic/years/:yearId" element={<SubjectsPage />} />
                <Route path="academic/subjects/:subjectId" element={<SubjectBooksPage />} />
              </>
            ) : (
              // Edition without academic browse: old links land on the home page.
              <Route path="academic/*" element={<Navigate to="/" replace />} />
            )}
            <Route path="privacy" element={<PrivacyPage />} />
            <Route path="terms" element={<TermsPage />} />
            {/* Catch-all: the host rewrites unknown paths to index.html. */}
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
        </CartProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
