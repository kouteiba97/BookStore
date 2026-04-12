import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Layout from "@/components/layout";
import HomePage from "@/pages/home";
import SearchPage from "@/pages/search";
import BookPage from "@/pages/book";
import FieldsPage from "@/pages/academic/fields";
import YearsPage from "@/pages/academic/years";
import SubjectsPage from "@/pages/academic/subjects";
import SubjectBooksPage from "@/pages/academic/subject-books";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
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
