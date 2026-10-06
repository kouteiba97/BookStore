import { BadRequestException } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { Row } from './detect';

/** Rows read per sheet. Bigger catalogues are imported in several files. */
export const MAX_SHEET_ROWS = 10_000;
/** Columns kept per row — real sheets never need more. */
const MAX_COLS = 60;
/** Sheets read per workbook. */
const MAX_SHEETS = 20;

export interface ReadSheet {
  name: string;
  rows: Row[];
  /** True when the sheet had more rows than MAX_SHEET_ROWS. */
  truncated: boolean;
}

/**
 * Read an uploaded .xlsx / .xls / .csv / .ods into plain text rows.
 *
 * Cells come back as the text Excel shows (formatted), so "1 500,00" or a
 * date arrives as the user sees it and the value parsers decide. Formulas,
 * HTML and styles are never parsed. Empty rows are kept so row numbers match
 * the ones in Excel.
 */
export function readWorkbook(buffer: Buffer, fileName: string): ReadSheet[] {
  const ext = fileName.toLowerCase().split('.').pop() ?? '';
  if (!['xlsx', 'xls', 'xlsm', 'csv', 'ods', 'tsv', 'txt'].includes(ext)) {
    throw new BadRequestException('صيغة الملف غير مدعومة. استعمل Excel (.xlsx/.xls) أو CSV.');
  }

  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buffer, {
      type: 'buffer',
      dense: true,
      sheetRows: MAX_SHEET_ROWS + 1,
      cellFormula: false,
      cellHTML: false,
      cellStyles: false,
      cellDates: false,
      // CSV exported by Excel on Arabic Windows is often Windows-1256.
      codepage: ext === 'csv' || ext === 'txt' || ext === 'tsv' ? detectCsvCodepage(buffer) : undefined,
    });
  } catch {
    throw new BadRequestException('تعذّرت قراءة الملف. تأكد أنه ملف Excel أو CSV سليم.');
  }

  const sheets: ReadSheet[] = [];
  for (const name of wb.SheetNames.slice(0, MAX_SHEETS)) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      raw: false,
      defval: '',
      blankrows: true,
    });
    const rows = raw.slice(0, MAX_SHEET_ROWS).map((r) =>
      (Array.isArray(r) ? r : []).slice(0, MAX_COLS).map((c) => (c == null ? '' : String(c))),
    );
    // Trailing empty rows add nothing.
    while (rows.length && rows[rows.length - 1].every((c) => !c.trim())) rows.pop();
    sheets.push({ name, rows, truncated: raw.length > MAX_SHEET_ROWS });
  }
  if (!sheets.some((s) => s.rows.length)) {
    throw new BadRequestException('الملف فارغ: لا توجد أي بيانات في أوراقه.');
  }
  return sheets;
}

/** UTF-8 (with or without BOM) unless the bytes are not valid UTF-8. */
function detectCsvCodepage(buffer: Buffer): number {
  if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) return 65001;
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(0, 64 * 1024));
    return 65001;
  } catch {
    return 1256; // Arabic Windows
  }
}

export interface SheetSpec {
  name: string;
  /** First row = headers. */
  rows: (string | number | null)[][];
  /** Column widths in characters. */
  widths?: number[];
}

/** Build an .xlsx (right-to-left, frozen header row) from plain rows. */
export function writeWorkbook(sheets: SheetSpec[]): Buffer {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(s.rows);
    if (s.widths) ws['!cols'] = s.widths.map((wch) => ({ wch }));
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
  }
  wb.Workbook = { ...(wb.Workbook ?? {}), Views: [{ RTL: true }] };
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx', compression: true }) as Buffer;
}
