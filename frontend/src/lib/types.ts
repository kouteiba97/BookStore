export interface Book {
  id: string;
  title: string;
  titleNormalized: string | null;
  /** Public blurb about the work, shown under "عن الكتاب". */
  description: string | null;
  /** Extra cataloguing detail (edition, volumes, binding…), shown under "معلومات إضافية". */
  notes: string | null;
  year: number | null;
  /** The cover — first of `images`. */
  imageUrl: string | null;
  /** Every picture in display order; a series shows each volume. */
  images?: string[];
  /** 480 px version of the cover for cards (null → use imageUrl). */
  thumbUrl?: string | null;
  /** Small versions of `images`, same order (null where there is none). */
  thumbs?: (string | null)[];
  price?: number | null;
  inventory: Inventory | null;
  category: Category | null;

  /** Every author / publisher of the book, in display order. */
  authors: Author[];
  publishers: Publisher[];

  /**
   * The primary (first) author / publisher. Kept so compact contexts — cards,
   * table rows — can show a single name without collapsing the list themselves.
   */
  author: Author | null;
  publisher: Publisher | null;

  /** Academic placement, present on detail reads. */
  fields?: Field[];
  years?: AcademicYear[];
  subjects?: Subject[];
}

export interface Inventory {
  id: string;
  stock: number | null;
  status: "available" | "on_request" | "rare";
}

export interface Category {
  id: string;
  name: string;
}

export interface Author {
  id: string;
  name: string;
}

export interface Publisher {
  id: string;
  name: string;
}

export interface Field {
  id: string;
  name: string;
  /** Books available under this speciality, counted across all its depths. */
  bookCount?: number;
}

export interface AcademicYear {
  id: string;
  name: string;
  fieldId: string;
  bookCount?: number;
}

export interface Subject {
  id: string;
  name: string;
  yearId: string;
  bookCount?: number;
}

export interface AutocompleteItem {
  id: string;
  title: string;
}

export interface Suggestions {
  categories: Category[];
  authors: Author[];
  books: AutocompleteItem[];
}

// ── Admin ────────────────────────────────────────────────

export type RequestStatus = 'pending' | 'contacted' | 'done';

export interface OrderRequest {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  wilaya: string;
  address: string;
  bookId: string | null;
  bookName: string;
  status: RequestStatus;
  createdAt: string;
}

export interface StatusCount {
  status: RequestStatus;
  _count: number;
}

export interface RequestsResponse {
  requests: OrderRequest[];
  counts: StatusCount[];
}

export interface StoreCategory {
  id: string;
  name: string;
  bookCount: number;
}

/** One block of the home page, in the order the admin arranged. Built-in
 *  blocks carry no data; a "books" shelf carries its first books and total. */
export interface HomeSection {
  id: string;
  kind: "categories" | "academic" | "latest" | "popular" | "request" | "books";
  /** null → the block's default title. */
  title: string | null;
  subtitle: string | null;
  total?: number;
  books?: Book[];
}

export interface HomeShelf {
  id: string;
  title: string | null;
  subtitle: string | null;
  books: Book[];
}

// ── Storefront orders ───────────────────────────────────

export type OrderStatusValue = "pending" | "confirmed" | "shipped" | "delivered" | "cancelled";

/** An order as the customer sees it (no address, notes or costs). */
export interface PublicOrder {
  reference: string;
  status: {
    status: OrderStatusValue;
    label: string;
    hint: string;
    /** 0 received · 1 confirmed · 2 shipped · 3 delivered. */
    step: number;
    cancelled: boolean;
  };
  firstName: string;
  wilaya: string;
  items: {
    bookId: string;
    title: string;
    quantity: number;
    /** 0 when the shop sets the price at confirmation. */
    unitPrice: number;
    imageUrl: string | null;
    thumbUrl: string | null;
  }[];
  hasUnpricedItems: boolean;
  subtotal: number;
  discount: number;
  shippingCost: number;
  total: number;
  carrier: string | null;
  trackingNumber: string | null;
  createdAt: string;
  updatedAt: string;
}

/** What checkout returns: the order plus the phone it was saved with. */
export interface PlacedOrder extends PublicOrder {
  phone: string;
  whatsappUrl: string | null;
}

export interface CheckoutCustomer {
  firstName: string;
  lastName: string;
  phone: string;
  wilaya: string;
  address: string;
}

export interface QuotedBook {
  id: string;
  title: string;
  price: number | null;
  imageUrl: string | null;
  thumbUrl: string | null;
  status: Inventory["status"] | null;
}
