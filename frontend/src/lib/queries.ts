import api from "./api";
import type { Book, AutocompleteItem, Suggestions, Field, AcademicYear, Subject } from "./types";

export const fetchBooks = () =>
  api.get<Book[]>("/books").then((r) => r.data);

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

export const fetchSubjectBooks = (subjectId: string) =>
  api.get<Book[]>(`/subjects/${subjectId}/books`).then((r) => r.data);

export const createRequest = (data: { bookName: string; userPhone: string; notes?: string }) =>
  api.post("/requests", data).then((r) => r.data);
