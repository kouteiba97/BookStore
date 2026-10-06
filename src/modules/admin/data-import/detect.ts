import { FieldKey, matchHeader } from './fields';
import { INVALID, latinDigits, parseAmount, text } from './values';

/** A row of cells as read from the sheet (formatted text). */
export type Row = string[];

export interface ColumnSuggestion {
  index: number;
  header: string;
  samples: string[];
  field: FieldKey | null;
  /** 0–1. ≥0.8 = recognised by its header; ~0.4 = guessed from the values. */
  confidence: number;
  reason: 'header' | 'content' | 'none';
}

const SCAN_ROWS = 15;

/**
 * The header row: among the first rows, the one whose cells best match known
 * column names. Sheets often open with a shop name, a date or a blank line.
 * Returns a 0-based index, or -1 when no row looks like headers.
 */
export function findHeaderRow(rows: Row[]): number {
  let best = -1;
  let bestScore = 0;
  for (let r = 0; r < Math.min(rows.length, SCAN_ROWS); r++) {
    let score = 0;
    for (const cell of rows[r] ?? []) {
      const m = matchHeader(cell);
      if (m.score >= 0.6) score += m.score;
      else if (m.ignored) score += 0.3;
    }
    if (score > bestScore) {
      bestScore = score;
      best = r;
    }
  }
  return bestScore >= 1 ? best : -1;
}

/**
 * One suggestion per column. Headers decide first; for columns whose header
 * says nothing, the values are inspected (prices, counts, years, links, the
 * longest text = the title). Each field is given to at most one column — the
 * most confident one.
 */
export function suggestMapping(rows: Row[], headerRow: number): ColumnSuggestion[] {
  const header = headerRow >= 0 ? rows[headerRow] ?? [] : [];
  const data = rows.slice(headerRow + 1).filter((r) => r.some((c) => text(c)));
  const width = Math.max(header.length, ...data.slice(0, 200).map((r) => r.length), 0);

  const cols: ColumnSuggestion[] = [];
  const ignored = new Set<number>();
  for (let i = 0; i < width; i++) {
    const m = matchHeader(header[i]);
    if (m.ignored) ignored.add(i);
    cols.push({
      index: i,
      header: text(header[i]),
      samples: data.map((r) => text(r[i])).filter(Boolean).slice(0, 5),
      field: m.field,
      confidence: m.field ? m.score : 0,
      reason: m.field ? 'header' : 'none',
    });
  }

  // Content guesses for the columns headers left open.
  const taken = new Set(cols.filter((c) => c.field).map((c) => c.field));
  const sample = data.slice(0, 100);
  const open = cols.filter((c) => !c.field && !ignored.has(c.index));
  const guesses: { col: ColumnSuggestion; field: FieldKey; conf: number }[] = [];
  for (const col of open) {
    const values = sample.map((r) => text(r[col.index])).filter(Boolean);
    if (values.length < Math.min(3, sample.length)) continue;
    const g = guessFromValues(values);
    if (g) guesses.push({ col, ...g });
  }
  // Longest-text column as the title, if the title is still missing.
  if (!taken.has('title')) {
    const textual = open
      .map((col) => {
        const vals = sample.map((r) => text(r[col.index])).filter(Boolean);
        const alpha = vals.filter((v) => /\p{L}{2,}/u.test(v) && !/^https?:/.test(v));
        const avg = alpha.reduce((s, v) => s + v.length, 0) / Math.max(1, alpha.length);
        return { col, avg, share: alpha.length / Math.max(1, vals.length) };
      })
      .filter((t) => t.share > 0.7 && t.avg >= 4)
      .sort((a, b) => b.avg - a.avg);
    if (textual[0]) guesses.push({ col: textual[0].col, field: 'title', conf: 0.45 });
  }

  for (const g of guesses.sort((a, b) => b.conf - a.conf)) {
    if (taken.has(g.field) || g.col.field) continue;
    g.col.field = g.field;
    g.col.confidence = g.conf;
    g.col.reason = 'content';
    taken.add(g.field);
  }

  // A field claimed by two headers keeps only its best column.
  const bestFor = new Map<FieldKey, ColumnSuggestion>();
  for (const c of cols) {
    if (!c.field) continue;
    const prev = bestFor.get(c.field);
    if (!prev || c.confidence > prev.confidence) bestFor.set(c.field, c);
  }
  for (const c of cols) {
    if (c.field && bestFor.get(c.field) !== c) {
      c.field = null;
      c.confidence = 0;
      c.reason = 'none';
    }
  }
  return cols;
}

function guessFromValues(values: string[]): { field: FieldKey; conf: number } | null {
  const share = (pred: (v: string) => boolean) => values.filter(pred).length / values.length;

  if (share((v) => /^https?:\/\/\S+\.(jpe?g|png|webp)(\?.*)?$/i.test(v)) > 0.7) return { field: 'imageUrl', conf: 0.5 };
  if (share((v) => /^(97[89])?\d{9}[\dxX]$/.test(v.replace(/[-\s]/g, ''))) > 0.7) return { field: 'isbn', conf: 0.5 };

  const nums = values.map((v) => parseAmount(v)).filter((n): n is number => n !== null && n !== INVALID);
  if (nums.length / values.length < 0.8) return null;

  const isInt = nums.every((n) => Number.isInteger(n));
  const yearish = values.every((v) => /^\s*[12]\d{3}\s*(ه|هـ|م)?\s*$/.test(latinDigits(v)));
  if (yearish) return { field: 'year', conf: 0.45 };
  const max = Math.max(...nums);
  const median = [...nums].sort((a, b) => a - b)[Math.floor(nums.length / 2)];
  if (isInt && max <= 500 && median <= 50) return { field: 'quantity', conf: 0.4 };
  if (median >= 100) return { field: 'price', conf: 0.4 };
  return null;
}
