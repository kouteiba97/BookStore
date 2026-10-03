import api from "./api";
import type { Book, AutocompleteItem, Suggestions, Field, AcademicYear, Subject } from "./types";

/** Newest books as cards. Pass `limit` — the home page shows 16, not the catalogue. */
export const fetchBooks = (limit?: number) =>
  api.get<Book[]>("/books", { params: limit ? { limit } : undefined }).then((r) => r.data);

export const fetchBook = (id: string) =>
  api.get<Book>(`/books/${id}`).then((r) => r.data);

export const searchBooks = (q: string) =>
  api.get<Book[]>("/books/search", { params: { q } }).then((r) => r.data);

export const autocompleteBooks = (q: string) =>
  api.get<AutocompleteItem[]>("/books/autocomplete", { params: { q } }).then((r) => r.data);

export const fetchSuggestions = (q: string) =>
  api.get<Suggestions>("/books/suggestions", { params: { q } }).then((r) => r.data);

export const fetchRecommendations = (id: string) =>
  api.get<Book[]>(`/books/${id}/recommendations`).then((r) => r.data);

export const fetchFields = () =>
  api.get<Field[]>("/fields").then((r) => r.data);

export const fetchYears = (fieldId: string) =>
  api.get<AcademicYear[]>(`/fields/${fieldId}/years`).then((r) => r.data);

export const fetchSubjects = (yearId: string) =>
  api.get<Subject[]>(`/years/${yearId}/subjects`).then((r) => r.data);

/**
 * Books for a whole speciality — aggregated across its years and subjects, plus
 * anything attached directly to the speciality itself.
 */
export const fetchFieldBooks = (fieldId: string) =>
  api.get<Book[]>(`/fields/${fieldId}/books`).then((r) => r.data);

/** Books for a study year, aggregated across its subjects. */
export const fetchYearBooks = (yearId: string) =>
  api.get<Book[]>(`/years/${yearId}/books`).then((r) => r.data);

export const fetchSubjectBooks = (subjectId: string) =>
  api.get<Book[]>(`/subjects/${subjectId}/books`).then((r) => r.data);

export const createRequest = (data: {
  firstName: string;
  lastName: string;
  phone: string;
  wilaya: string;
  address: string;
  bookId?: string;
  bookName: string;
  /** Honeypot — always empty for real people; the API rejects any value. */
  website?: string;
}) => api.post("/requests", data).then((r) => r.data);

export const fetchRequests = (params?: {
  status?: string;
  wilaya?: string;
  search?: string;
}) => api.get("/requests", { params }).then((r) => r.data);

export const updateRequestStatus = (id: string, status: string) =>
  api.patch(`/requests/${id}/status`, { status }).then((r) => r.data);
