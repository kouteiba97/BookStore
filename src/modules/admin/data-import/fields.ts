import { normalizeArabic } from '../../../common/utils/normalize-arabic';

/**
 * What a spreadsheet column can mean for a book, and how to recognise it.
 *
 * Shops keep their catalogue in Excel with headers in Arabic, French or a mix
 * ("العنوان", "Désignation", "Qté", "P.V", "دار النشر"…). Each field lists the
 * headers it is known by; matching is done on a normalised form so accents,
 * hamza/ta-marbuta variants, punctuation and case do not matter.
 */
export const FIELD_KEYS = [
  'title',
  'author',
  'publisher',
  'category',
  'price',
  'costPrice',
  'quantity',
  'status',
  'year',
  'edition',
  'volumes',
  'isbn',
  'country',
  'description',
  'notes',
  'imageUrl',
] as const;
export type FieldKey = (typeof FIELD_KEYS)[number];

/** Arabic labels, for the admin UI and the template/report headers. */
export const FIELD_LABELS: Record<FieldKey, string> = {
  title: 'العنوان',
  author: 'المؤلف',
  publisher: 'دار النشر',
  category: 'التصنيف',
  price: 'سعر البيع',
  costPrice: 'سعر الشراء',
  quantity: 'الكمية',
  status: 'التوفر',
  year: 'سنة النشر',
  edition: 'الطبعة',
  volumes: 'عدد الأجزاء',
  isbn: 'ISBN',
  country: 'بلد النشر',
  description: 'نبذة',
  notes: 'ملاحظات',
  imageUrl: 'رابط الصورة',
};

const SYNONYMS: Record<FieldKey, string[]> = {
  title: [
    'العنوان', 'عنوان', 'عنوان الكتاب', 'اسم الكتاب', 'الكتاب', 'الكتب', 'اسم المنتج', 'المنتج', 'البيان', 'التسمية',
    'titre', 'titre du livre', 'livre', 'designation', 'libelle', 'intitule', 'article', 'produit', 'nom du livre',
    'title', 'book', 'book title', 'name', 'product', 'item',
  ],
  author: [
    'المؤلف', 'مؤلف', 'المؤلفون', 'المؤلفين', 'الكاتب', 'كاتب', 'تأليف', 'المصنف', 'اسم المؤلف',
    'auteur', 'auteurs', 'ecrivain', 'author', 'authors', 'writer', 'by',
  ],
  publisher: [
    'دار النشر', 'دور النشر', 'الناشر', 'ناشر', 'النشر', 'الدار', 'دار', 'دار الطبع', 'المطبعة',
    'editeur', 'editeurs', 'edition', 'editions', 'maison d edition', 'maison edition',
    'publisher', 'publishing house', 'press',
  ],
  category: [
    'التصنيف', 'تصنيف', 'الصنف', 'صنف', 'القسم', 'قسم', 'الفئة', 'فئة', 'النوع', 'نوع', 'الموضوع', 'المجال', 'الفن',
    'categorie', 'category', 'rayon', 'genre', 'theme', 'famille', 'section', 'type',
  ],
  price: [
    'السعر', 'سعر', 'سعر البيع', 'الثمن', 'ثمن', 'ثمن البيع', 'سعر الوحدة', 'سعر البيع للعموم',
    'prix', 'prix de vente', 'prix vente', 'pv', 'p v', 'prix unitaire', 'pu', 'p u', 'prix public', 'prix ttc',
    'price', 'sale price', 'selling price', 'unit price', 'retail price',
  ],
  costPrice: [
    'سعر الشراء', 'ثمن الشراء', 'سعر التكلفة', 'التكلفة', 'تكلفة', 'سعر الجملة', 'سعر الاقتناء', 'ثمن الاقتناء',
    'prix d achat', 'prix achat', 'pa', 'p a', 'cout', 'cout d achat', 'prix de revient', 'prix gros',
    'cost', 'cost price', 'purchase price', 'buying price', 'wholesale price',
  ],
  quantity: [
    'الكمية', 'كمية', 'المخزون', 'مخزون', 'العدد', 'عدد', 'عدد النسخ', 'النسخ', 'الموجود', 'المتوفر', 'الرصيد',
    'quantite', 'qte', 'qt', 'quantite en stock', 'stock', 'nombre', 'nb', 'exemplaires',
    'quantity', 'qty', 'stock qty', 'in stock', 'copies', 'count',
  ],
  status: [
    'الحالة', 'حالة', 'التوفر', 'الوفرة', 'متوفر', 'disponibilite', 'disponible', 'etat', 'statut',
    'availability', 'status', 'available',
  ],
  year: [
    'السنة', 'سنة', 'سنة النشر', 'سنة الطبع', 'تاريخ النشر', 'تاريخ الطبع', 'العام',
    'annee', 'annee de publication', 'annee d edition', 'date de publication', 'date edition',
    'year', 'publication year', 'published',
  ],
  edition: ['الطبعة', 'طبعة', 'رقم الطبعة', 'edition no', 'numero d edition', 'tirage', 'edition number'],
  volumes: [
    'عدد الأجزاء', 'الأجزاء', 'اجزاء', 'عدد المجلدات', 'المجلدات', 'مجلدات', 'الجزء',
    'volumes', 'nombre de volumes', 'tomes', 'nb tomes', 'tome', 'vol',
  ],
  isbn: ['isbn', 'ردمك', 'رقم الكتاب الدولي', 'ean', 'code barre', 'code barres', 'barcode'],
  country: ['بلد النشر', 'البلد', 'بلد', 'الدولة', 'pays', 'pays d edition', 'country', 'origin'],
  description: ['نبذة', 'نبذة عن الكتاب', 'الوصف', 'وصف', 'ملخص', 'description', 'resume', 'summary', 'presentation'],
  notes: ['ملاحظات', 'ملاحظة', 'معلومات اضافية', 'remarques', 'remarque', 'observations', 'obs', 'notes', 'note', 'comment', 'comments'],
  imageUrl: ['الصورة', 'صورة', 'الغلاف', 'صورة الغلاف', 'رابط الصورة', 'image', 'photo', 'couverture', 'cover', 'image url', 'lien image'],
};

/**
 * Headers that look like a field but are not one — a line total is not a
 * price, a row number is not a quantity. Recognised so that content guessing
 * never assigns them.
 */
const IGNORE = [
  'رقم', 'الرقم', 'ر ت', 'ت', 'م', 'المبلغ', 'المجموع', 'الإجمالي', 'الاجمالي', 'القيمة', 'المبلغ الاجمالي', 'الرمز', 'المرجع', 'كود',
  'n', 'no', 'num', 'numero', 'n°', 'ref', 'reference', 'code', 'montant', 'total', 'montant total', 'valeur', 'id', 'sku',
];

/** Lower-case, accent-free, Arabic-normalised, punctuation-free. */
export function normalizeHeader(raw: unknown): string {
  return normalizeArabic(
    String(raw ?? '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // French accents
      .replace(/[°º]/g, ' ')
      .replace(/[^\p{L}\p{N}\s]/gu, ' '),
  ).replace(/\s+/g, ' ').trim();
}

const NORMALISED: [FieldKey, string[]][] = (Object.entries(SYNONYMS) as [FieldKey, string[]][]).map(
  ([k, list]) => [k, [...new Set(list.map(normalizeHeader))]],
);
const IGNORE_SET = new Set(IGNORE.map(normalizeHeader));

export interface HeaderMatch {
  field: FieldKey | null;
  /** 1 exact, 0.8 contains a known name, 0 none. */
  score: number;
  ignored: boolean;
}

/** Best field for one header cell. */
export function matchHeader(raw: unknown): HeaderMatch {
  const h = normalizeHeader(raw);
  if (!h) return { field: null, score: 0, ignored: false };
  if (IGNORE_SET.has(h)) return { field: null, score: 0, ignored: true };

  let best: HeaderMatch = { field: null, score: 0, ignored: false };
  for (const [field, names] of NORMALISED) {
    for (const name of names) {
      let score = 0;
      if (h === name) score = 1;
      // "سعر البيع (دج)" contains "سعر البيع"; require whole words so
      // "pa" does not match inside "papier".
      else if (name.length >= 3 && new RegExp(`(^| )${escapeRe(name)}( |$)`).test(h)) {
        score = 0.6 + Math.min(0.3, name.length / 40); // longer names = more specific
      }
      if (score > best.score) best = { field, score, ignored: false };
    }
  }
  return best;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Is this cell text a header name (e.g. a header row repeated on every printed page)? */
export function looksLikeHeader(raw: unknown): boolean {
  const m = matchHeader(raw);
  return m.score >= 1 || m.ignored;
}

/** Summary rows that end many sheets: "المجموع", "Total", "Sous-total"… */
export function isTotalsLabel(raw: unknown): boolean {
  const h = normalizeHeader(raw);
  // (\s|$), not \b: JavaScript's \b treats Arabic letters as non-word characters.
  return /^(المجموع|الاجمالي|المجموع الكلي|المجموع العام|الجمله|total|totaux|total general|sous total|grand total)(\s|$)/.test(h);
}
