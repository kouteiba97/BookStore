import { FIELD_KEYS, FIELD_LABELS, normalizeHeader } from './fields';

/**
 * The kinds of sheet a shop keeps, each with its own columns:
 *  - catalog   : books, prices, stock (Phase 1)
 *  - sales     : what was sold (one line per book sold)
 *  - purchases : what was bought from suppliers
 *  - expenses  : rent, salaries, transport…
 */
export const IMPORT_KINDS = ['catalog', 'sales', 'purchases', 'expenses'] as const;
export type ImportKind = (typeof IMPORT_KINDS)[number];

export const KIND_LABELS: Record<ImportKind, string> = {
  catalog: 'قائمة كتب / مخزون',
  sales: 'سجل مبيعات',
  purchases: 'سجل مشتريات',
  expenses: 'سجل مصاريف',
};

const TITLE = [
  'العنوان', 'عنوان', 'عنوان الكتاب', 'اسم الكتاب', 'الكتاب', 'الكتب', 'اسم المنتج', 'المنتج', 'السلعة',
  'titre', 'livre', 'designation', 'libelle', 'article', 'produit', 'title', 'book', 'item', 'product',
];
const AUTHOR = ['المؤلف', 'مؤلف', 'الكاتب', 'auteur', 'author'];
const QUANTITY = ['الكمية', 'كمية', 'العدد', 'عدد', 'عدد النسخ', 'quantite', 'qte', 'qt', 'nombre', 'nb', 'quantity', 'qty'];
const DATE = [
  'التاريخ', 'تاريخ', 'اليوم', 'تاريخ البيع', 'تاريخ الشراء', 'تاريخ الفاتورة', 'تاريخ العملية', 'تاريخ الصرف',
  'date', 'jour', 'date facture', 'date de vente', 'date d achat', 'date operation',
];
const REFERENCE = [
  'رقم الفاتورة', 'الفاتورة', 'رقم الوصل', 'الوصل', 'رقم البون', 'البون', 'رقم الطلب', 'رقم العملية', 'المرجع', 'رقم التذكرة',
  'facture', 'n facture', 'no facture', 'numero facture', 'num facture', 'bon', 'n bon', 'bon de livraison', 'ticket', 'reference', 'ref',
  'invoice', 'invoice no', 'order no', 'receipt',
];
const PAYMENT = ['طريقة الدفع', 'الدفع', 'نوع الدفع', 'mode de paiement', 'paiement', 'reglement', 'payment', 'payment method'];
const NOTES = ['ملاحظات', 'ملاحظة', 'remarques', 'remarque', 'observations', 'obs', 'notes', 'note'];

type Synonyms = Record<string, string[]>;

export interface KindDef {
  fields: string[];
  labels: Record<string, string>;
  synonyms: Synonyms;
  /** Fields a row cannot do without. */
  required: string[];
  /** Headers that look like a field of this kind but are not one. */
  ignore: string[];
}

export const KINDS: Record<Exclude<ImportKind, 'catalog'>, KindDef> = {
  sales: {
    fields: ['date', 'reference', 'title', 'author', 'quantity', 'unitPrice', 'total', 'customer', 'phone', 'wilaya', 'payment', 'notes'],
    labels: {
      date: 'التاريخ', reference: 'رقم الفاتورة / الوصل', title: 'الكتاب', author: 'المؤلف', quantity: 'الكمية',
      unitPrice: 'سعر الوحدة', total: 'مجموع السطر', customer: 'الزبون', phone: 'الهاتف', wilaya: 'الولاية',
      payment: 'طريقة الدفع', notes: 'ملاحظات',
    },
    synonyms: {
      date: DATE, reference: REFERENCE, title: TITLE, author: AUTHOR, quantity: QUANTITY,
      unitPrice: ['سعر الوحدة', 'السعر', 'سعر', 'الثمن', 'ثمن', 'سعر البيع', 'prix unitaire', 'pu', 'p u', 'prix', 'prix de vente', 'pv', 'p v', 'price', 'unit price'],
      total: ['المجموع', 'الإجمالي', 'الاجمالي', 'المبلغ', 'المبلغ الإجمالي', 'القيمة', 'montant', 'total', 'montant total', 'amount', 'line total'],
      customer: ['الزبون', 'اسم الزبون', 'العميل', 'اسم العميل', 'الحريف', 'المشتري', 'client', 'nom client', 'nom du client', 'customer', 'buyer'],
      phone: ['الهاتف', 'رقم الهاتف', 'الجوال', 'tel', 'telephone', 'mobile', 'phone'],
      wilaya: ['الولاية', 'المدينة', 'wilaya', 'ville', 'city'],
      payment: PAYMENT, notes: NOTES,
    },
    required: ['title'],
    ignore: ['رقم', 'ر ت', 'ت', 'n', 'no', 'num', 'id', 'code', 'الرمز'],
  },
  purchases: {
    fields: ['date', 'supplier', 'reference', 'title', 'author', 'quantity', 'unitCost', 'salePrice', 'total', 'notes'],
    labels: {
      date: 'التاريخ', supplier: 'المورد', reference: 'رقم الفاتورة / الوصل', title: 'الكتاب', author: 'المؤلف',
      quantity: 'الكمية', unitCost: 'سعر الشراء', salePrice: 'سعر البيع', total: 'مجموع السطر', notes: 'ملاحظات',
    },
    synonyms: {
      date: DATE, reference: REFERENCE, title: TITLE, author: AUTHOR, quantity: QUANTITY, notes: NOTES,
      supplier: ['المورد', 'الممون', 'اسم المورد', 'الموزع', 'المزود', 'دار النشر', 'fournisseur', 'nom fournisseur', 'distributeur', 'supplier', 'vendor'],
      unitCost: ['سعر الشراء', 'ثمن الشراء', 'التكلفة', 'سعر الوحدة', 'السعر', 'الثمن', 'prix d achat', 'pa', 'p a', 'prix unitaire', 'pu', 'p u', 'cout', 'prix', 'cost', 'unit cost', 'purchase price'],
      salePrice: ['سعر البيع', 'ثمن البيع', 'prix de vente', 'pv', 'p v', 'sale price', 'selling price'],
      total: ['المجموع', 'الإجمالي', 'الاجمالي', 'المبلغ', 'montant', 'total', 'montant total', 'amount'],
    },
    required: ['title'],
    ignore: ['رقم', 'ر ت', 'ت', 'n', 'no', 'num', 'id', 'code', 'الرمز'],
  },
  expenses: {
    fields: ['date', 'category', 'amount', 'description', 'payment', 'reference'],
    labels: {
      date: 'التاريخ', category: 'البند / النوع', amount: 'المبلغ', description: 'البيان', payment: 'طريقة الدفع', reference: 'رقم الوصل',
    },
    synonyms: {
      date: DATE, payment: PAYMENT, reference: REFERENCE,
      category: ['البند', 'النوع', 'نوع المصروف', 'نوع المصاريف', 'الصنف', 'التصنيف', 'الباب', 'nature', 'categorie', 'type', 'rubrique', 'poste', 'category'],
      amount: ['المبلغ', 'القيمة', 'المجموع', 'الإجمالي', 'المصروف', 'montant', 'total', 'somme', 'valeur', 'depense', 'amount', 'sum'],
      description: ['البيان', 'الوصف', 'التفاصيل', 'الشرح', 'السبب', 'libelle', 'designation', 'description', 'objet', 'details', 'motif'],
    },
    required: ['amount'],
    ignore: ['رقم', 'ر ت', 'ت', 'n', 'no', 'num', 'id'],
  },
};

/** Field list + labels for a kind (catalog comes from fields.ts). */
export function kindFields(kind: ImportKind): { key: string; label: string }[] {
  if (kind === 'catalog') return FIELD_KEYS.map((key) => ({ key, label: FIELD_LABELS[key] }));
  return KINDS[kind].fields.map((key) => ({ key, label: KINDS[kind].labels[key] }));
}

const NORMALISED = Object.fromEntries(
  (Object.keys(KINDS) as Exclude<ImportKind, 'catalog'>[]).map((k) => [
    k,
    {
      fields: Object.entries(KINDS[k].synonyms).map(([f, list]) => [f, [...new Set(list.map(normalizeHeader))]] as const),
      ignore: new Set(KINDS[k].ignore.map(normalizeHeader)),
    },
  ]),
) as Record<Exclude<ImportKind, 'catalog'>, { fields: (readonly [string, string[]])[]; ignore: Set<string> }>;

/** Header → field for a non-catalog kind (same scoring as the catalog matcher). */
export function matchKindHeader(raw: unknown, kind: Exclude<ImportKind, 'catalog'>): { field: string | null; score: number; ignored: boolean } {
  const h = normalizeHeader(raw);
  if (!h) return { field: null, score: 0, ignored: false };
  const table = NORMALISED[kind];
  if (table.ignore.has(h)) return { field: null, score: 0, ignored: true };
  let best = { field: null as string | null, score: 0, ignored: false };
  for (const [field, names] of table.fields) {
    for (const name of names) {
      let score = 0;
      if (h === name) score = 1;
      else if (name.length >= 3 && new RegExp(`(^| )${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( |$)`).test(h)) {
        score = 0.6 + Math.min(0.3, name.length / 40);
      }
      if (score > best.score) best = { field, score, ignored: false };
    }
  }
  return best;
}
