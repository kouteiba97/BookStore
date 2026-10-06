import axios from "axios";
import { attachAuth } from "./auth";
import type { AdminBook } from "./admin-types";

// Absolute API origin in production (e.g. https://bookstore-api.onrender.com).
// Empty in dev so requests stay relative and go through the Vite proxy.
const API_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

const adminApi = axios.create({ baseURL: `${API_URL}/api/v1/admin` });
attachAuth(adminApi);

export default adminApi;

// ── Auth ─────────────────────────────────────────────────

export const login = (password: string) =>
  adminApi.post("/auth/login", { password }).then((r) => r.data as { token: string });

// ── Stats ────────────────────────────────────────────────

export const fetchStats = (days = 30) =>
  adminApi.get("/stats/overview", { params: { days } }).then((r) => r.data);

// ── Uploads ──────────────────────────────────────────────

/** Upload a cover photo to R2 (via the backend) and get its public URL. */
export const uploadCover = (file: File) => {
  const fd = new FormData();
  fd.append("file", file);
  return adminApi
    .post("/uploads/cover", fd)
    .then((r) => r.data as { url: string; key: string });
};

// ── Books ────────────────────────────────────────────────

export const fetchAdminBooks = (params: {
  search?: string;
  categoryId?: string;
  inventoryStatus?: string;
  missing?: string;
  page?: number;
  pageSize?: number;
}) => adminApi.get("/books", { params }).then((r) => r.data);

export const fetchAdminBook = (id: string) =>
  adminApi.get(`/books/${id}`).then((r) => r.data);

export const createBook = (data: any) =>
  adminApi.post("/books", data).then((r) => r.data);

export const updateBook = (id: string, data: any) =>
  adminApi.patch(`/books/${id}`, data).then((r) => r.data);

export const deleteBook = (id: string) =>
  adminApi.delete(`/books/${id}`).then((r) => r.data);

// ── Catalog ──────────────────────────────────────────────

export type CatalogResource =
  | "categories"
  | "authors"
  | "publishers"
  | "countries";

export const fetchCatalog = (resource: CatalogResource) =>
  adminApi.get(`/catalog/${resource}`).then((r) => r.data);

export const createCatalog = (
  resource: CatalogResource,
  data: { name: string; description?: string },
) => adminApi.post(`/catalog/${resource}`, data).then((r) => r.data);

export const updateCatalog = (
  resource: CatalogResource,
  id: string,
  data: { name: string; description?: string },
) => adminApi.patch(`/catalog/${resource}/${id}`, data).then((r) => r.data);

export const deleteCatalog = (resource: CatalogResource, id: string) =>
  adminApi.delete(`/catalog/${resource}/${id}`).then((r) => r.data);

// ── Academic ─────────────────────────────────────────────

export const fetchAcademicTree = () =>
  adminApi.get("/academic/tree").then((r) => r.data);

export const createField = (name: string) =>
  adminApi.post("/academic/fields", { name }).then((r) => r.data);
export const updateField = (id: string, name: string) =>
  adminApi.patch(`/academic/fields/${id}`, { name }).then((r) => r.data);
export const deleteField = (id: string) =>
  adminApi.delete(`/academic/fields/${id}`).then((r) => r.data);

export const createYear = (fieldId: string, name: string) =>
  adminApi.post("/academic/years", { fieldId, name }).then((r) => r.data);
export const updateYear = (id: string, name: string) =>
  adminApi.patch(`/academic/years/${id}`, { name }).then((r) => r.data);
export const deleteYear = (id: string) =>
  adminApi.delete(`/academic/years/${id}`).then((r) => r.data);

export const createSubject = (yearId: string, name: string) =>
  adminApi.post("/academic/subjects", { yearId, name }).then((r) => r.data);
export const updateSubject = (id: string, name: string) =>
  adminApi.patch(`/academic/subjects/${id}`, { name }).then((r) => r.data);
export const deleteSubject = (id: string) =>
  adminApi.delete(`/academic/subjects/${id}`).then((r) => r.data);

// ── Orders ───────────────────────────────────────────────

export const fetchOrders = (params: {
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}) => adminApi.get("/orders", { params }).then((r) => r.data);

export const fetchOrder = (id: string) =>
  adminApi.get(`/orders/${id}`).then((r) => r.data);

export const createOrder = (data: any) =>
  adminApi.post("/orders", data).then((r) => r.data);

export const updateOrder = (id: string, data: any) =>
  adminApi.patch(`/orders/${id}`, data).then((r) => r.data);

export const updateOrderStatus = (id: string, status: string) =>
  adminApi.patch(`/orders/${id}/status`, { status }).then((r) => r.data);

export const cancelOrder = (id: string) =>
  adminApi.post(`/orders/${id}/cancel`).then((r) => r.data);

export const deleteOrder = (id: string) =>
  adminApi.delete(`/orders/${id}`).then((r) => r.data);

export const convertRequestToOrder = (
  requestId: string,
  data: { items: { bookId: string; quantity: number; unitPrice?: number }[]; shippingCost?: number; notes?: string },
) =>
  adminApi
    .post(`/orders/from-request/${requestId}`, data)
    .then((r) => r.data);

// ── Inventory ────────────────────────────────────────────

/** The stock list is bounded server-side; `total` says how many matched. */
export const fetchInventory = (params: {
  search?: string;
  status?: string;
  lowStock?: boolean;
}) =>
  adminApi
    .get("/inventory", { params: { ...params, lowStock: params.lowStock ? "true" : undefined } })
    .then((r) => ({
      books: r.data as AdminBook[],
      total: Number(r.headers["x-total-count"] ?? (r.data as AdminBook[]).length),
    }));

export const updateInventory = (
  bookId: string,
  data: { status: string; stock?: number | null },
) => adminApi.patch(`/inventory/${bookId}`, data).then((r) => r.data);

// ── Social content ───────────────────────────────────────

export interface SocialFilter {
  search?: string;
  categoryId?: string;
  publisherId?: string;
  status?: string;
}

export interface SocialBookRow {
  id: string;
  title: string;
  authors: string[];
  publishers: string[];
  category: string | null;
  price: number | null;
  year: number | null;
  status: "available" | "on_request" | "rare" | null;
  cover: string | null;
  thumb: string | null;
  pictures: number;
}

export const fetchSocialBooks = (params: SocialFilter & { page: number; pageSize: number }) =>
  adminApi.get("/social-content/books", { params }).then(
    (r) =>
      r.data as {
        items: SocialBookRow[];
        total: number;
        page: number;
        pageSize: number;
        maxExport: number;
      },
  );

/**
 * Download a ZIP of covers + metadata. Send ids, or a filter for "everything
 * matching" — never book data; the server reads that from the database.
 */
export async function exportSocialContent(
  body: { bookIds?: string[]; filter?: SocialFilter; includeGallery?: boolean },
  onProgress?: (bytes: number) => void,
): Promise<{ blob: Blob; filename: string; books: number; truncated: number }> {
  try {
    const r = await adminApi.post("/social-content/export", body, {
      responseType: "blob",
      onDownloadProgress: (e) => onProgress?.(e.loaded),
    });
    const disposition = String(r.headers["content-disposition"] ?? "");
    const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? "social-content.zip";
    return {
      blob: r.data as Blob,
      filename,
      books: Number(r.headers["x-export-books"] ?? 0),
      truncated: Number(r.headers["x-export-truncated"] ?? 0),
    };
  } catch (err: any) {
    if (err?.response?.status === 429) {
      err.message = "عمليات تنزيل كثيرة في وقت قصير. انتظر دقيقة ثم أعد المحاولة.";
      throw err;
    }
    // Errors arrive as a Blob too (responseType); surface the JSON message.
    const data = err?.response?.data;
    if (data instanceof Blob) {
      try {
        const parsed = JSON.parse(await data.text());
        err.message = Array.isArray(parsed.message) ? parsed.message.join("، ") : parsed.message ?? err.message;
      } catch {
        /* keep the original message */
      }
    }
    throw err;
  }
}

// ── Data import / export ─────────────────────────────────

export type ImportField =
  | "title" | "author" | "publisher" | "category" | "price" | "costPrice" | "quantity" | "status"
  | "year" | "edition" | "volumes" | "isbn" | "country" | "description" | "notes" | "imageUrl";

export interface ImportColumn {
  index: number;
  letter: string;
  header: string;
  samples: string[];
  field: ImportField | null;
  confidence: number;
  reason: "header" | "content" | "none";
}

export interface ImportSheet {
  name: string;
  totalRows: number;
  truncated: boolean;
  headerRow: number;
  columns: ImportColumn[];
  firstRows: string[][];
  looksLikeCatalog: boolean;
}

export interface ImportAnalysis {
  sessionId: string;
  fileName: string;
  expiresAt: string;
  fields: { key: ImportField; label: string }[];
  sheets: ImportSheet[];
}

export interface ImportOptions {
  sheet: string;
  headerRow: number;
  mapping: Partial<Record<ImportField, number>>;
  existing: "update" | "skip";
  stockMode: "set" | "add";
  defaultCategory?: string | null;
  defaultStatus: "available" | "on_request" | "rare";
}

export type ImportAction = "create" | "update" | "unchanged" | "skip" | "error";

export interface ImportPreview {
  summary: { rows: number; create: number; update: number; unchanged: number; skip: number; error: number };
  issues: { code: string; message: string; rows: number }[];
  newNames: { authors: number; publishers: number; categories: string[] };
  rows: { row: number; title: string; action: ImportAction; issues: { code: string; level: "error" | "warning"; message: string }[]; changes: string[] }[];
  truncatedRows: boolean;
}

export interface DataQuality {
  total: number;
  noPrice: number;
  noCover: number;
  noAuthor: number;
  uncategorized: number;
  noStock: number;
  outOfStock: number;
}

export interface ImportResult {
  jobId: string;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  missing: DataQuality;
}

export interface ImportJob {
  id: string;
  fileName: string;
  sheetName: string;
  status: "completed" | "undone";
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  createdAt: string;
  undoneAt: string | null;
  booksStillLinked: number;
}

export const analyzeImport = (file: File) => {
  const fd = new FormData();
  fd.append("file", file);
  return adminApi.post("/data-import/analyze", fd).then((r) => r.data as ImportAnalysis);
};

export const previewImport = (sessionId: string, opts: ImportOptions) =>
  adminApi.post(`/data-import/${sessionId}/preview`, opts).then((r) => r.data as ImportPreview);

export const commitImport = (sessionId: string, opts: ImportOptions) =>
  adminApi.post(`/data-import/${sessionId}/commit`, opts).then((r) => r.data as ImportResult);

export const fetchImportHistory = () =>
  adminApi.get("/data-import/history").then((r) => r.data as ImportJob[]);

export const undoImport = (jobId: string) =>
  adminApi.post(`/data-import/jobs/${jobId}/undo`).then((r) => r.data as { removed: number; keptBecauseOrdered: number });

export const fetchDataQuality = () =>
  adminApi.get("/data-quality").then((r) => r.data as DataQuality);

/** Save a downloaded file under the server's name (or a fallback). */
function saveBlob(blob: Blob, disposition: string | undefined, fallback: string) {
  const utf = /filename\*=UTF-8''([^;]+)/i.exec(disposition ?? "")?.[1];
  const plain = /filename="([^"]+)"/i.exec(disposition ?? "")?.[1];
  const name = utf ? decodeURIComponent(utf) : plain ?? fallback;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

async function download(req: Promise<{ data: Blob; headers: Record<string, any> }>, fallback: string) {
  const r = await req;
  saveBlob(r.data, r.headers["content-disposition"], fallback);
}

export const downloadImportReport = (sessionId: string, opts: ImportOptions) =>
  download(adminApi.post(`/data-import/${sessionId}/report`, opts, { responseType: "blob" }), "import-report.xlsx");

export const downloadImportTemplate = () =>
  download(adminApi.get("/data-import/template", { responseType: "blob" }), "books-template.xlsx");

export const downloadBooksExport = () =>
  download(adminApi.get("/export/books", { responseType: "blob" }), "books.xlsx");

export const downloadOrdersExport = (params: { from?: string; to?: string; status?: string }) =>
  download(adminApi.get("/export/orders", { params, responseType: "blob" }), "orders.xlsx");
