/**
 * Turning spreadsheet cells into clean values.
 *
 * Shop sheets are typed by hand: "1 500 DA", "١٥٠٠ دج", "1.500,00", "1,500",
 * "1420هـ", "ابن تيمية، ابن القيم". Each parser returns a value, null for an
 * empty cell, or `INVALID` when the cell has content we could not read — so
 * the preview can say *which* row needs fixing instead of guessing.
 */
export const INVALID = Symbol('invalid');
export type Parsed<T> = T | null | typeof INVALID;

/** Arabic-Indic and Persian digits → ASCII; Arabic decimal/thousands marks too. */
export function latinDigits(s: string): string {
  return s
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/٫/g, '.') // ٫ decimal separator
    .replace(/٬/g, ','); // ٬ thousands separator
}

export function text(raw: unknown): string {
  return String(raw ?? '')
    .replace(/[‎‏‪-‮]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * A money or count amount. Handles currency words, spaces and both European
 * ("1.500,50") and English ("1,500.50") separators.
 */
export function parseAmount(raw: unknown): Parsed<number> {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : INVALID;
  let s = latinDigits(text(raw));
  if (!s || /^[-–—]+$/.test(s)) return null;
  s = s
    .toLowerCase()
    .replace(/(د\.?\s?ج|دج|دينار|dzd|da|dinars?|€|eur|\$|usd)/g, '')
    .replace(/[\s ']/g, '');
  if (!s) return null;
  if (!/^-?[\d.,]+$/.test(s)) return INVALID;

  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  if (lastDot !== -1 && lastComma !== -1) {
    // Both: whichever comes last is the decimal separator.
    s = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (lastComma !== -1) {
    // "1,500" / "1,500,000" thousands; "12,5" decimal.
    s = /^-?\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.');
  } else if (lastDot !== -1) {
    // "1.500" / "1.500.000" is how prices are written in Algeria (French usage).
    if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : INVALID;
}

/** A price: ≥ 0, two decimals. */
export function parsePrice(raw: unknown): Parsed<number> {
  const n = parseAmount(raw);
  if (n === null || n === INVALID) return n;
  if (n < 0 || n > 99_999_999) return INVALID;
  return Math.round(n * 100) / 100;
}

/** A stock count: a whole number ≥ 0. */
export function parseQuantity(raw: unknown): Parsed<number> {
  const n = parseAmount(raw);
  if (n === null || n === INVALID) return n;
  if (n < 0 || n > 1_000_000 || Math.abs(n - Math.round(n)) > 1e-9) return INVALID;
  return Math.round(n);
}

/**
 * A publication year. Gregorian years are kept; Hijri years ("1420هـ", or a
 * bare 13xx/14xx, which no book in a shop was printed in) are returned as a
 * note instead, since the year column is Gregorian.
 */
export function parseYear(raw: unknown): Parsed<{ year: number | null; note: string | null }> {
  const s = latinDigits(text(raw));
  if (!s) return null;
  const m = s.match(/(\d{4})/);
  if (!m) return INVALID;
  const y = Number(m[1]);
  const hijri = /ه|هـ|h\b/i.test(s) || (y >= 1300 && y < 1500);
  if (hijri) return { year: null, note: `سنة النشر: ${y}هـ` };
  if (y < 1500 || y > new Date().getFullYear() + 1) return INVALID;
  return { year: y, note: null };
}

/** Several names in one cell: "ابن تيمية، ابن القيم" / "A; B" / "A / B". */
export function parseNames(raw: unknown): string[] {
  const s = text(raw);
  if (!s) return [];
  const parts = s
    .split(/\s*(?:،|,|;|؛|\/|\||\n|\s+-\s+|&|\+)\s*/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0 && p.length <= 200);
  return [...new Set(parts)].slice(0, 10);
}

/** Availability words in Arabic, French and English. */
export function parseStatus(raw: unknown): Parsed<'available' | 'on_request' | 'rare'> {
  const s = text(raw).toLowerCase();
  if (!s) return null;
  if (/^(متوفر|متوفره|موجود|نعم|available|in stock|disponible|en stock|oui|yes|dispo)$/.test(s)) return 'available';
  if (/^(نادر|rare)$/.test(s)) return 'rare';
  if (/^(حسب الطلب|عند الطلب|بالطلب|غير متوفر|غير متوفره|نفد|نفذ|لا|on request|out of stock|sur commande|epuise|épuisé|rupture|non|no)$/.test(s)) {
    return 'on_request';
  }
  return INVALID;
}

export function parseUrl(raw: unknown): Parsed<string> {
  const s = text(raw);
  if (!s) return null;
  return /^https?:\/\/[^\s]+$/i.test(s) && s.length <= 2048 ? s : INVALID;
}

/** Spreadsheet column letter for a 0-based index: 0 → A, 27 → AB. */
export function columnLetter(i: number): string {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}
