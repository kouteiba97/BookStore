export type OrderStatus =
  | "pending"
  | "confirmed"
  | "shipped"
  | "delivered"
  | "cancelled";

export type RequestStatus = "pending" | "contacted" | "done";
export type InventoryStatus = "available" | "on_request" | "rare";

export interface NamedRef {
  id: string;
  name: string;
}

export interface AdminBook {
  id: string;
  title: string;
  /** Public blurb about the work, shown to shoppers under "عن الكتاب". */
  description: string | null;
  /** Extra cataloguing detail the title cannot carry (edition, volumes, binding…). */
  notes: string | null;
  year: number | null;
  price: string | null;
  /** Purchase price — admin-only. */
  costPrice?: string | null;
  /** The cover — always the first of `images`. */
  imageUrl: string | null;
  /** Every picture in display order; a series has one per volume. */
  images?: string[];
  /** 480 px version of the cover (null → use imageUrl). */
  thumbUrl?: string | null;
  categoryId: string;
  countryId: string | null;
  category: NamedRef | null;
  country: NamedRef | null;

  /** Every author / publisher, in display order (index 0 is primary). */
  authors: NamedRef[];
  publishers: NamedRef[];
  /** Primary entries — convenient for single-line table cells. */
  author: NamedRef | null;
  publisher: NamedRef | null;

  inventory: {
    id: string;
    stock: number | null;
    status: InventoryStatus;
  } | null;

  /** Academic placement. A book may sit at any depth, or several at once. */
  fields?: NamedRef[];
  years?: (NamedRef & { fieldId: string })[];
  subjects?: (NamedRef & { yearId: string })[];

  createdAt: string;
}

export interface CatalogItem {
  id: string;
  name: string;
  description?: string | null;
  booksCount: number;
}

export interface OrderItem {
  id: string;
  bookId: string;
  bookTitle: string;
  unitPrice: string;
  quantity: number;
  book?: { id: string; title: string; imageUrl: string | null; thumbUrl?: string | null };
}

export interface AdminOrder {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  wilaya: string;
  address: string;
  status: OrderStatus;
  subtotal: string;
  shippingCost: string;
  total: string;
  notes: string | null;
  items: OrderItem[];
  request?: { id: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface AcademicField {
  id: string;
  name: string;
  years: AcademicYear[];
}
export interface AcademicYear {
  id: string;
  name: string;
  fieldId: string;
  subjects: AcademicSubject[];
}
export interface AcademicSubject {
  id: string;
  name: string;
  yearId: string;
  _count?: { books: number };
}

/** Payload shape for creating/updating a book from the admin form. */
export interface UpsertBookPayload {
  title: string;
  categoryId?: string | null;
  categoryName?: string | null;
  authorIds?: string[];
  authorNames?: string[];
  publisherIds?: string[];
  publisherNames?: string[];
  countryId?: string | null;
  countryName?: string | null;
  description?: string | null;
  notes?: string | null;
  year?: number | null;
  price?: number | null;
  costPrice?: number | null;
  /** Cover only. Ignored when `imageUrls` is sent. */
  imageUrl?: string | null;
  /** The whole gallery in order (first = cover). Replaces the stored pictures. */
  imageUrls?: string[];
  inventory?: { status: InventoryStatus; stock?: number | null } | null;
  fieldIds?: string[];
  yearIds?: string[];
  subjectIds?: string[];
}

export interface StatsOverview {
  kpis: {
    booksCount: number;
    categoriesCount: number;
    authorsCount: number;
    totalRevenue: number;
    totalRequests: number;
    totalOrders: number;
    conversionRate: number;
    lowStockCount: number;
  };
  requestsByStatus: { status: RequestStatus; _count: number }[];
  ordersByStatus: { status: OrderStatus; _count: number }[];
  dailyOrders: { date: string; value: number }[];
  dailyRequests: { date: string; value: number }[];
  topBooks: { bookId: string; title: string; quantity: number }[];
  recentOrders: {
    id: string;
    firstName: string;
    lastName: string;
    total: string;
    status: OrderStatus;
    createdAt: string;
  }[];
  recentRequests: {
    id: string;
    firstName: string;
    lastName: string;
    bookName: string;
    status: RequestStatus;
    createdAt: string;
  }[];
}
