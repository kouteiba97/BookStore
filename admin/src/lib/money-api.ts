import adminApi from "./admin-api";

// ── Packs ────────────────────────────────────────────────

export type Feature = "money" | "invoices" | "reports" | "socialExport" | "historyImport" | "academic";
export type PlanKey = "starter" | "pro" | "business";

export interface PlanInfo {
  plan: PlanKey;
  label: string;
  features: Record<Feature, boolean>;
  featureLabels: Record<Feature, string>;
  limits: { books: number | null; importsPerMonth: number | null };
  usage: { books: number; importsThisMonth: number };
  plans: { key: PlanKey; label: string; features: Feature[]; limits: { books: number | null; importsPerMonth: number | null } }[];
}

export const fetchPlan = () => adminApi.get("/plan").then((r) => r.data as PlanInfo);

// ── Sales ────────────────────────────────────────────────

export type Channel = "online" | "shop" | "import";
export type PaymentMethod = "cash" | "card" | "transfer" | "cod" | "other";

export const CHANNEL_LABEL: Record<Channel, string> = {
  online: "طلب (موقع/هاتف)",
  shop: "بيع في المحل",
  import: "مستورد",
};

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  cash: "نقدًا",
  card: "بطاقة",
  transfer: "تحويل / CCP",
  cod: "عند الاستلام",
  other: "أخرى",
};

export interface SaleLine {
  bookId: string;
  quantity: number;
  unitPrice?: number;
}

export const fetchSales = (params: { channel?: string; status?: string; search?: string; from?: string; to?: string; page?: number; pageSize?: number }) =>
  adminApi.get("/orders", { params }).then((r) => r.data);

export const createCounterSale = (body: {
  items: SaleLine[];
  discount?: number;
  paymentMethod?: PaymentMethod;
  customerName?: string;
  phone?: string;
  notes?: string;
}) => adminApi.post("/orders/counter", body).then((r) => r.data);

export interface InvoiceData {
  store: {
    name: string;
    phone: string | null;
    address: string | null;
    email: string | null;
    rc: string | null;
    nif: string | null;
    nis: string | null;
    art: string | null;
    invoiceFooter: string | null;
  };
  order: {
    id: string;
    invoiceNumber: string;
    invoicedAt: string;
    createdAt: string;
    soldAt: string | null;
    channel: Channel;
    paymentMethod: PaymentMethod | null;
    firstName: string;
    lastName: string;
    phone: string;
    wilaya: string;
    address: string;
    subtotal: string;
    discount: string;
    shippingCost: string;
    total: string;
    notes: string | null;
    items: { id: string; bookTitle: string; quantity: number; unitPrice: string }[];
  };
}

export const fetchInvoice = (orderId: string) =>
  adminApi.post(`/orders/${orderId}/invoice`).then((r) => r.data as InvoiceData);

// ── Suppliers & purchases ────────────────────────────────

export interface Supplier {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  purchases: number;
  totalPurchased: number;
  totalPaid: number;
  balance: number;
}

export const fetchSuppliers = () => adminApi.get("/suppliers").then((r) => r.data as Supplier[]);
export const createSupplier = (b: Partial<Supplier> & { name: string }) => adminApi.post("/suppliers", b).then((r) => r.data);
export const updateSupplier = (id: string, b: Partial<Supplier> & { name: string }) => adminApi.put(`/suppliers/${id}`, b).then((r) => r.data);
export const deleteSupplier = (id: string) => adminApi.delete(`/suppliers/${id}`).then((r) => r.data);

export interface PurchaseLineInput {
  bookId?: string;
  title?: string;
  quantity: number;
  unitCost: number;
  salePrice?: number;
}

export interface Purchase {
  id: string;
  reference: string | null;
  date: string;
  subtotal: string;
  shippingCost: string;
  total: string;
  paidAmount: string;
  notes: string | null;
  stockApplied: boolean;
  cancelled: boolean;
  supplier: { id: string; name: string } | null;
  _count?: { items: number };
  items?: { id: string; bookId: string | null; bookTitle: string; quantity: number; unitCost: string }[];
}

export const fetchPurchases = (params: { supplierId?: string; from?: string; to?: string; page?: number; pageSize?: number }) =>
  adminApi.get("/purchases", { params }).then((r) => r.data as { purchases: Purchase[]; total: number; page: number; pageSize: number; totals: { total: number; paid: number; balance: number } });
export const fetchPurchase = (id: string) => adminApi.get(`/purchases/${id}`).then((r) => r.data as Purchase);
export const createPurchase = (b: {
  supplierId?: string | null;
  supplierName?: string | null;
  reference?: string | null;
  date?: string;
  items: PurchaseLineInput[];
  shippingCost?: number;
  paidAmount?: number;
  notes?: string | null;
  addToStock?: boolean;
  updateCostPrice?: boolean;
}) => adminApi.post("/purchases", b).then((r) => r.data as Purchase);
export const payPurchase = (id: string, paidAmount: number) => adminApi.patch(`/purchases/${id}/payment`, { paidAmount }).then((r) => r.data);
export const cancelPurchase = (id: string) => adminApi.post(`/purchases/${id}/cancel`).then((r) => r.data);
export const deletePurchase = (id: string) => adminApi.delete(`/purchases/${id}`).then((r) => r.data);

// ── Expenses ─────────────────────────────────────────────

export type ExpenseCategory = "rent" | "salaries" | "transport" | "utilities" | "marketing" | "supplies" | "taxes" | "other";

export const EXPENSE_LABEL: Record<ExpenseCategory, string> = {
  rent: "إيجار",
  salaries: "أجور ورواتب",
  transport: "نقل وتوصيل",
  utilities: "كهرباء وماء وهاتف وإنترنت",
  marketing: "إشهار وتسويق",
  supplies: "لوازم وتجهيزات",
  taxes: "ضرائب ورسوم",
  other: "أخرى",
};

export interface Expense {
  id: string;
  date: string;
  category: ExpenseCategory;
  amount: string;
  description: string | null;
  paymentMethod: PaymentMethod | null;
}

export const fetchExpenses = (params: { category?: string; from?: string; to?: string; page?: number; pageSize?: number }) =>
  adminApi.get("/expenses", { params }).then((r) => r.data as { expenses: Expense[]; total: number; byCategory: { category: ExpenseCategory; amount: number }[]; sum: number });
export const saveExpense = (b: { category: ExpenseCategory; amount: number; date?: string; description?: string | null; paymentMethod?: PaymentMethod | null }, id?: string) =>
  (id ? adminApi.put(`/expenses/${id}`, b) : adminApi.post("/expenses", b)).then((r) => r.data);
export const deleteExpense = (id: string) => adminApi.delete(`/expenses/${id}`).then((r) => r.data);

// ── Reports ──────────────────────────────────────────────

export interface ReportOverview {
  range: { from: string; to: string };
  kpis: {
    revenue: number;
    cogs: number;
    grossMargin: number;
    grossMarginRate: number;
    expenses: number;
    netProfit: number;
    orders: number;
    booksSold: number;
    averageOrder: number;
    purchases: number;
    owedToSuppliers: number;
    costCoverage: number;
  };
  monthly: { month: string; orders: number; booksSold: number; revenue: number; cogs: number; grossMargin: number; expenses: number; netProfit: number; purchases: number }[];
  channels: { channel: Channel; orders: number; revenue: number }[];
  expensesByCategory: { category: string; label: string; amount: number }[];
  topBooks: { bookId: string; title: string; quantity: number; revenue: number; margin: number | null }[];
  slowStock: { bookId: string; title: string; stock: number; value: number; lastSale: string | null }[];
  slowDays: number;
  stock: { titles: number; units: number; valueAtCost: number; valueAtPrice: number; titlesWithoutCost: number };
}

export const fetchReport = (from: string, to: string) =>
  adminApi.get("/reports/overview", { params: { from, to } }).then((r) => r.data as ReportOverview);

export async function downloadReport(from: string, to: string) {
  const r = await adminApi.get("/reports/export", { params: { from, to }, responseType: "blob" });
  const url = URL.createObjectURL(r.data);
  const a = document.createElement("a");
  a.href = url;
  a.download = `report-${from}-${to}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// ── Store profile & stock log ────────────────────────────

export interface StoreProfile {
  name: string;
  slug: string;
  phone: string | null;
  address: string | null;
  email: string | null;
  rc: string | null;
  nif: string | null;
  nis: string | null;
  art: string | null;
  invoiceFooter: string | null;
  plan: PlanKey;
}

export const fetchStoreProfile = () => adminApi.get("/store-profile").then((r) => r.data as StoreProfile);
export const saveStoreProfile = (b: Partial<StoreProfile>) => adminApi.put("/store-profile", b).then((r) => r.data as StoreProfile);

export const STOCK_REASON_LABEL: Record<string, string> = {
  sale: "بيع",
  sale_cancel: "إلغاء / إرجاع بيع",
  purchase: "شراء",
  purchase_cancel: "إلغاء شراء",
  adjustment: "تعديل يدوي",
  import: "استيراد",
};

export const fetchStockMovements = (bookId: string) =>
  adminApi.get(`/stock-movements/${bookId}`).then(
    (r) =>
      r.data as {
        book: { id: string; title: string; inventory: { stock: number | null; status: string } | null };
        movements: { id: string; delta: number; reason: string; refId: string | null; note: string | null; createdAt: string }[];
      },
  );

/** Today / month helpers for date filters (local dates, YYYY-MM-DD). */
export const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const money = (n: number | string | null | undefined) =>
  `${Number(n ?? 0).toLocaleString("ar-DZ", { maximumFractionDigits: 2 })} د.ج`;
