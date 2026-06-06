export type OrderStatus =
  | "pending"
  | "confirmed"
  | "shipped"
  | "delivered"
  | "cancelled";

export type RequestStatus = "pending" | "contacted" | "done";
export type InventoryStatus = "available" | "on_request" | "rare";

export interface AdminBook {
  id: string;
  title: string;
  description: string | null;
  year: number | null;
  price: string | null;
  imageUrl: string | null;
  categoryId: string;
  authorId: string | null;
  publisherId: string | null;
  countryId: string | null;
  category: { id: string; name: string } | null;
  author: { id: string; name: string } | null;
  publisher: { id: string; name: string } | null;
  country: { id: string; name: string } | null;
  inventory: {
    id: string;
    stock: number | null;
    status: InventoryStatus;
  } | null;
  subjects?: { subject: { id: string; name: string } }[];
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
  book?: { id: string; title: string; imageUrl: string | null };
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
