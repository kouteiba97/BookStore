import api from "./api";
import type { Book, AutocompleteItem, Suggestions, Field, AcademicYear, Subject, StoreCategory, HomeSection, HomeShelf, CheckoutCustomer, PlacedOrder, PublicOrder, QuotedBook } from "./types";

/** Newest books as cards. Pass `limit` — the home page shows 16, not the catalogue. */
export const fetchBooks = (limit?: number, categoryId?: string) =>
  api
    .get<Book[]>("/books", { params: { ...(limit ? { limit } : {}), ...(categoryId ? { categoryId } : {}) } })
    .then((r) => r.data);

/** Categories the store has books in, most stocked first. */
export const fetchCategories = () =>
  api.get<StoreCategory[]>("/categories").then((r) => r.data);

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

// ── Orders (checkout and tracking) ──────────────────────

/** Place an order. Prices are set by the server, never by the browser. */
export const createOrder = (data: CheckoutCustomer & {
  items: { bookId: string; quantity: number }[];
  note?: string;
  /** Honeypot — always empty for real people. */
  website?: string;
}) => api.post<PlacedOrder>("/orders", data).then((r) => r.data);

/** Follow an order: its number and the phone it was placed with. */
export const trackOrder = (ref: string, phone: string) =>
  api.get<PublicOrder>("/orders/track", { params: { ref, phone } }).then((r) => r.data);

/** Today's price and availability for the books in the cart. */
export const quoteBooks = (bookIds: string[]) =>
  api.post<{ books: QuotedBook[] }>("/orders/quote", { bookIds }).then((r) => r.data.books);

/**
 * The message to show for a failed call: the server's own (it is already in
 * Arabic for validation errors) or a calm generic one.
 */
export function apiErrorMessage(err: unknown, fallback = "حدث خطأ، حاول مرة أخرى"): string {
  const res = (err as { response?: { status?: number; data?: { message?: unknown } } })?.response;
  if (res?.status === 429) return "محاولات كثيرة في وقت قصير. انتظر دقيقة ثم أعد المحاولة.";
  const data = res?.data;
  const m = data?.message;
  const first = Array.isArray(m) ? m[0] : m;
  return typeof first === "string" && /[\u0600-\u06FF]/.test(first) ? first : fallback;
}

export const fetchRequests = (params?: {
  status?: string;
  wilaya?: string;
  search?: string;
}) => api.get("/requests", { params }).then((r) => r.data);

export const updateRequestStatus = (id: string, status: string) =>
  api.patch(`/requests/${id}/status`, { status }).then((r) => r.data);

/** The home page layout the admin arranged (built-in blocks and shelves). */
export const fetchHomeSections = () =>
  api.get<HomeSection[]>("/home-sections").then((r) => r.data);

/** One hand-picked shelf with all its books. */
export const fetchHomeShelf = (id: string) =>
  api.get<HomeShelf>(`/home-sections/${id}`).then((r) => r.data);
