import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { InventoryStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { StoreResolver } from '../../../common/tenant/store-resolver.service';
import { normalizeArabic } from '../../../common/utils/normalize-arabic';
import { setBookCover } from '../../../common/utils/book-cover';
import { ColumnSuggestion, Row, findHeaderRow, suggestMapping } from './detect';
import { FIELD_KEYS, FIELD_LABELS, FieldKey, isTotalsLabel, looksLikeHeader } from './fields';
import {
  INVALID,
  columnLetter,
  parseNames,
  parsePrice,
  parseQuantity,
  parseStatus,
  parseUrl,
  parseYear,
  text,
} from './values';
import { ReadSheet, readWorkbook, writeWorkbook } from './workbook';

// ── Limits ────────────────────────────────────────────────

const SESSION_TTL_MS = 30 * 60_000;
const MAX_SESSIONS = 20;
const MAX_SESSIONS_PER_STORE = 3;
const CREATE_CHUNK = 500;
const UPDATE_CHUNK = 100;
/** Rows returned in a preview; the full list is in the downloadable report. */
const PREVIEW_ROWS = 300;
/** Categories books land in when the sheet gives none. */
const FALLBACK_CATEGORY = 'غير مصنف';
const PLACEHOLDER_CATEGORIES = ['غير مصنف', 'عام'];

// ── Shapes ────────────────────────────────────────────────

export type Mapping = Partial<Record<FieldKey, number>>;

export interface ImportOptions {
  sheet: string;
  /** 1-based, as Excel numbers rows. */
  headerRow: number;
  mapping: Mapping;
  /** Books already in the store: refresh their data, or leave them alone. */
  existing: 'update' | 'skip';
  /** Quantity column: replaces the stock, or is added to it (a delivery). */
  stockMode: 'set' | 'add';
  defaultCategory?: string | null;
  defaultStatus: InventoryStatus;
}

export type Action = 'create' | 'update' | 'unchanged' | 'skip' | 'error';

export interface Issue {
  code: string;
  level: 'error' | 'warning';
  message: string;
}

interface RowData {
  title: string;
  titleNormalized: string;
  authors: string[];
  publishers: string[];
  category: string | null;
  price: number | null;
  costPrice: number | null;
  quantity: number | null;
  status: InventoryStatus | null;
  year: number | null;
  description: string | null;
  notes: string | null;
  country: string | null;
  imageUrl: string | null;
}

export interface PlannedRow {
  row: number;
  title: string;
  action: Action;
  issues: Issue[];
  /** For updates: what will change, in Arabic. */
  changes: string[];
  matchId?: string;
  data?: RowData;
  cells: string[];
}

interface ExistingBook {
  id: string;
  authorNorm: string | null;
  price: number | null;
  costPrice: number | null;
  year: number | null;
  description: string | null;
  notes: string | null;
  imageUrl: string | null;
  categoryName: string;
  publishers: number;
  stock: number | null;
  status: InventoryStatus | null;
  hasInventory: boolean;
}

interface Session {
  id: string;
  storeId: string;
  fileName: string;
  sheets: ReadSheet[];
  expiresAt: number;
}

@Injectable()
export class DataImportService {
  private readonly logger = new Logger(DataImportService.name);
  private readonly sessions = new Map<string, Session>();
  private readonly committing = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly stores: StoreResolver,
  ) {}

  // ── 1. Analyse ──────────────────────────────────────────

  /** Read the file, keep it for 30 minutes, and suggest how to read each sheet. */
  async analyze(file: Express.Multer.File) {
    const storeId = await this.stores.getStoreId();
    const fileName = utf8FileName(file.originalname);
    const sheets = readWorkbook(file.buffer, fileName);
    const session = this.putSession(storeId, fileName, sheets);

    return {
      sessionId: session.id,
      fileName,
      expiresAt: new Date(session.expiresAt).toISOString(),
      fields: FIELD_KEYS.map((key) => ({ key, label: FIELD_LABELS[key] })),
      sheets: sheets.map((s) => {
        const headerIdx = findHeaderRow(s.rows);
        const columns = suggestMapping(s.rows, headerIdx).map((c) => ({ ...c, letter: columnLetter(c.index) }));
        return {
          name: s.name,
          totalRows: s.rows.length,
          truncated: s.truncated,
          headerRow: headerIdx + 1, // 0 = "no header row found"
          columns,
          /** Rows above the data, so the admin can pick another header row. */
          firstRows: s.rows.slice(0, 8),
          // A title recognised by its header, or a guessed one backed by at
          // least one other recognised column — a sheet of free notes is not
          // a catalogue just because it has text in it.
          looksLikeCatalog:
            columns.some((c) => c.field === 'title' && c.reason === 'header') ||
            (columns.some((c) => c.field === 'title') && columns.filter((c) => c.field).length >= 2),
        };
      }),
    };
  }

  // ── 2. Preview ──────────────────────────────────────────

  async preview(sessionId: string, opts: ImportOptions) {
    const storeId = await this.stores.getStoreId();
    const session = this.getSession(sessionId, storeId);
    const rows = await this.plan(storeId, session, opts);

    const count = (a: Action) => rows.filter((r) => r.action === a).length;
    const warnings = new Map<string, { message: string; rows: number }>();
    for (const r of rows) {
      for (const i of r.issues) {
        const key = i.code;
        const w = warnings.get(key) ?? { message: ISSUE_TITLES[key] ?? i.message, rows: 0 };
        w.rows++;
        warnings.set(key, w);
      }
    }

    const willCreate = rows.filter((r) => r.action === 'create').map((r) => r.data!);
    const newNames = await this.newReferenceNames(willCreate, rows.filter((r) => r.action === 'update').map((r) => r.data!));

    // Errors first, then warnings, then the rest — what needs attention on top.
    const rank = (r: PlannedRow) => (r.action === 'error' ? 0 : r.issues.length ? 1 : 2);
    const sample = [...rows].sort((a, b) => rank(a) - rank(b) || a.row - b.row).slice(0, PREVIEW_ROWS);

    return {
      summary: {
        rows: rows.length,
        create: count('create'),
        update: count('update'),
        unchanged: count('unchanged'),
        skip: count('skip'),
        error: count('error'),
      },
      issues: [...warnings.entries()].map(([code, v]) => ({ code, ...v })).sort((a, b) => b.rows - a.rows),
      newNames,
      rows: sample.map(({ data: _d, cells: _c, ...r }) => r),
      truncatedRows: rows.length > PREVIEW_ROWS,
    };
  }

  /** The full row-by-row report as Excel: fix the sheet, upload it again. */
  async issuesReport(sessionId: string, opts: ImportOptions): Promise<{ buffer: Buffer; fileName: string }> {
    const storeId = await this.stores.getStoreId();
    const session = this.getSession(sessionId, storeId);
    const rows = await this.plan(storeId, session, opts);
    const sheet = session.sheets.find((s) => s.name === opts.sheet)!;
    const header = sheet.rows[opts.headerRow - 1] ?? [];

    const out: (string | number)[][] = [
      ['السطر', 'الإجراء', 'الملاحظات', ...header.map((h, i) => text(h) || columnLetter(i))],
      ...rows.map((r) => [r.row, ACTION_LABELS[r.action], r.issues.map((i) => i.message).join(' • ') || '—', ...r.cells]),
    ];
    const base = session.fileName.replace(/\.[^.]+$/, '');
    return {
      buffer: writeWorkbook([{ name: 'تقرير الاستيراد', rows: out, widths: [7, 12, 50, ...header.map(() => 18)] }]),
      fileName: `${base}-report.xlsx`,
    };
  }

  // ── 3. Commit ───────────────────────────────────────────

  async commit(sessionId: string, opts: ImportOptions) {
    const storeId = await this.stores.getStoreId();
    const session = this.getSession(sessionId, storeId);
    if (this.committing.has(storeId)) {
      throw new ConflictException('استيراد آخر قيد التنفيذ لهذا المتجر. انتظر حتى ينتهي.');
    }
    this.committing.add(storeId);
    const started = Date.now();
    try {
      const rows = await this.plan(storeId, session, opts);
      const creates = rows.filter((r) => r.action === 'create');
      const updates = rows.filter((r) => r.action === 'update');
      if (!creates.length && !updates.length) {
        throw new BadRequestException('لا يوجد ما يُستورد: كل الأسطر موجودة أو بها أخطاء.');
      }

      const job = await this.prisma.importJob.create({
        data: {
          storeId,
          fileName: session.fileName.slice(0, 255),
          sheetName: opts.sheet.slice(0, 255),
          kind: 'catalog',
          mapping: { mapping: opts.mapping, existing: opts.existing, stockMode: opts.stockMode, headerRow: opts.headerRow } as Prisma.InputJsonValue,
        },
      });

      const names = await this.resolveNames([...creates, ...updates].map((r) => r.data!), opts);

      let created = 0;
      for (let i = 0; i < creates.length; i += CREATE_CHUNK) {
        created += await this.writeCreates(storeId, job.id, creates.slice(i, i + CREATE_CHUNK), names, opts);
      }
      let updated = 0;
      for (let i = 0; i < updates.length; i += UPDATE_CHUNK) {
        updated += await this.writeUpdates(storeId, updates.slice(i, i + UPDATE_CHUNK), names, opts);
      }

      const skipped = rows.filter((r) => r.action === 'skip' || r.action === 'unchanged').length;
      const errors = rows.filter((r) => r.action === 'error').length;
      await this.prisma.importJob.update({ where: { id: job.id }, data: { created, updated, skipped, errors } });

      this.logger.log(`Import ${job.id}: +${created} ~${updated} skipped ${skipped} errors ${errors} in ${Date.now() - started} ms`);
      this.sessions.delete(session.id);
      return {
        jobId: job.id,
        created,
        updated,
        skipped,
        errors,
        missing: await this.quality(storeId, job.id),
      };
    } finally {
      this.committing.delete(storeId);
    }
  }

  // ── History / undo ──────────────────────────────────────

  async history() {
    const storeId = await this.stores.getStoreId();
    const jobs = await this.prisma.importJob.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { _count: { select: { books: true } } },
    });
    return jobs.map(({ _count, mapping: _m, storeId: _s, ...j }) => ({ ...j, booksStillLinked: _count.books }));
  }

  /**
   * Remove the books an import created. Books that have since been ordered
   * are kept (order history must stay intact); updates to existing books are
   * not reverted.
   */
  async undo(jobId: string) {
    const storeId = await this.stores.getStoreId();
    const job = await this.prisma.importJob.findFirst({ where: { id: jobId, storeId } });
    if (!job) throw new NotFoundException('Import not found');
    if (job.status === 'undone') throw new BadRequestException('تم التراجع عن هذا الاستيراد مسبقًا.');

    const removed = await this.prisma.book.deleteMany({
      where: { storeId, importJobId: job.id, orderItems: { none: {} } },
    });
    const kept = await this.prisma.book.count({ where: { storeId, importJobId: job.id } });
    await this.prisma.importJob.update({ where: { id: job.id }, data: { status: 'undone', undoneAt: new Date() } });
    return { removed: removed.count, keptBecauseOrdered: kept };
  }

  // ── Data quality ────────────────────────────────────────

  /** What the catalogue (or one import) is still missing. */
  async quality(storeIdArg?: string, jobId?: string) {
    const storeId = storeIdArg ?? (await this.stores.getStoreId());
    const base: Prisma.BookWhereInput = { storeId, ...(jobId ? { importJobId: jobId } : {}) };
    const [total, noPrice, noCover, noAuthor, uncategorized, noStock, outOfStock] = await Promise.all([
      this.prisma.book.count({ where: base }),
      this.prisma.book.count({ where: { ...base, price: null } }),
      this.prisma.book.count({ where: { ...base, imageUrl: null } }),
      this.prisma.book.count({ where: { ...base, authors: { none: {} } } }),
      this.prisma.book.count({ where: { ...base, category: { name: { in: PLACEHOLDER_CATEGORIES } } } }),
      this.prisma.book.count({ where: { ...base, OR: [{ inventory: null }, { inventory: { stock: null } }] } }),
      this.prisma.book.count({ where: { ...base, inventory: { stock: 0 } } }),
    ]);
    return { total, noPrice, noCover, noAuthor, uncategorized, noStock, outOfStock };
  }

  // ── Template ────────────────────────────────────────────

  template(): Buffer {
    const fields: FieldKey[] = ['title', 'author', 'publisher', 'category', 'price', 'costPrice', 'quantity', 'year', 'edition', 'volumes', 'notes'];
    return writeWorkbook([
      {
        name: 'الكتب',
        rows: [
          fields.map((f) => FIELD_LABELS[f]),
          ['تفسير ابن كثير', 'ابن كثير', 'دار طيبة', 'تفسير', 4500, 3600, 3, 2019, 'الثانية', 8, 'تجليد فني'],
          ['رياض الصالحين', 'النووي', 'دار السلام', 'حديث', 1200, 900, 10, 2021, '', 1, ''],
        ],
        widths: [34, 22, 20, 14, 11, 11, 9, 10, 10, 10, 24],
      },
    ]);
  }

  // ── Planning (shared by preview and commit) ─────────────

  private async plan(storeId: string, session: Session, opts: ImportOptions): Promise<PlannedRow[]> {
    const sheet = session.sheets.find((s) => s.name === opts.sheet);
    if (!sheet) throw new BadRequestException('الورقة المختارة غير موجودة في الملف.');
    this.validateOptions(opts, sheet);

    const existing = await this.loadExisting(storeId);
    const seen = new Map<string, number>(); // key → first row number
    const out: PlannedRow[] = [];
    const col = (f: FieldKey) => opts.mapping[f];

    for (let r = opts.headerRow; r < sheet.rows.length; r++) {
      const cells = sheet.rows[r] ?? [];
      if (!cells.some((c) => text(c))) continue; // blank line
      const rowNo = r + 1;
      const cell = (f: FieldKey) => (col(f) === undefined ? '' : cells[col(f)!] ?? '');

      const firstText = cells.map(text).find(Boolean) ?? '';
      if (isTotalsLabel(firstText) || isTotalsLabel(cell('title'))) continue; // "المجموع" line
      if (looksLikeHeader(cell('title'))) continue; // header repeated on every printed page

      const issues: Issue[] = [];
      const data = this.readRow(cell, issues, opts);
      const planned: PlannedRow = { row: rowNo, title: data.title, action: 'create', issues, changes: [], cells: cells.map(text) };

      if (!data.title) {
        planned.action = 'error';
        out.push(planned);
        continue;
      }

      const authorNorm = data.authors[0] ? normalizeArabic(data.authors[0]) : '';
      const key = `${data.titleNormalized}::${authorNorm}`;
      const dupOf = seen.get(key);
      if (dupOf !== undefined) {
        planned.action = 'skip';
        issues.push(issue('duplicate_in_file', 'warning', `مكرر في الملف (السطر ${dupOf})`));
        out.push(planned);
        continue;
      }
      seen.set(key, rowNo);

      // Match against the store.
      const candidates = existing.get(data.titleNormalized) ?? [];
      let match: ExistingBook | undefined;
      if (authorNorm) match = candidates.find((c) => c.authorNorm === authorNorm);
      else if (candidates.length === 1) match = candidates[0];
      else if (candidates.length > 1) {
        planned.action = 'skip';
        issues.push(issue('ambiguous', 'warning', 'يوجد أكثر من كتاب بهذا العنوان في المتجر؛ أضف عمود المؤلف للتمييز'));
        out.push(planned);
        continue;
      }

      if (match) {
        planned.matchId = match.id;
        if (opts.existing === 'skip') {
          planned.action = 'skip';
          issues.push(issue('exists', 'warning', 'الكتاب موجود في المتجر (تم تجاهله)'));
        } else {
          planned.changes = this.diff(match, data, opts);
          planned.action = planned.changes.length ? 'update' : 'unchanged';
        }
      } else {
        if (!data.authors.length) issues.push(issue('missing_author', 'warning', 'بدون مؤلف'));
        if (data.price === null) issues.push(issue('missing_price', 'warning', 'بدون سعر بيع'));
      }
      planned.data = data;
      out.push(planned);
    }
    return out;
  }

  private readRow(cell: (f: FieldKey) => string, issues: Issue[], opts: ImportOptions): RowData {
    const notes: string[] = [];

    const title = text(cell('title')).slice(0, 500);
    if (!title) issues.push(issue('missing_title', 'error', 'العنوان فارغ'));

    const read = <T>(f: FieldKey, parse: (v: unknown) => T | null | typeof INVALID, code: string, label: string): T | null => {
      const raw = cell(f);
      const v = parse(raw);
      if (v === INVALID) {
        issues.push(issue(code, 'warning', `${label} غير مفهوم: «${text(raw).slice(0, 40)}»`));
        return null;
      }
      return v;
    };

    const price = read('price', parsePrice, 'invalid_price', 'سعر البيع');
    const costPrice = read('costPrice', parsePrice, 'invalid_cost', 'سعر الشراء');
    const quantity = read('quantity', parseQuantity, 'invalid_quantity', 'الكمية');
    const status = read('status', parseStatus, 'invalid_status', 'التوفر');
    const imageUrl = read('imageUrl', parseUrl, 'invalid_url', 'رابط الصورة');
    const year = read('year', parseYear, 'invalid_year', 'سنة النشر');
    if (year?.note) notes.push(year.note);

    const edition = text(cell('edition'));
    if (edition) notes.push(`الطبعة: ${edition}`);
    const volumes = text(cell('volumes'));
    if (volumes) notes.push(`عدد الأجزاء: ${volumes}`);
    const isbn = text(cell('isbn'));
    if (isbn) notes.push(`ISBN: ${isbn}`);
    const extra = text(cell('notes'));
    if (extra) notes.push(extra);

    const category = text(cell('category')).slice(0, 120) || text(opts.defaultCategory ?? '') || null;

    return {
      title,
      titleNormalized: normalizeArabic(title),
      authors: parseNames(cell('author')),
      publishers: parseNames(cell('publisher')),
      category,
      price,
      costPrice,
      quantity,
      status,
      year: year?.year ?? null,
      description: text(cell('description')).slice(0, 5000) || null,
      notes: notes.join('\n').slice(0, 5000) || null,
      country: text(cell('country')).slice(0, 120) || null,
      imageUrl,
    };
  }

  /** What an update would change on an existing book (only fields the sheet fills). */
  private diff(b: ExistingBook, d: RowData, opts: ImportOptions): string[] {
    const changes: string[] = [];
    if (d.price !== null && d.price !== b.price) changes.push(`السعر: ${b.price ?? '—'} ← ${d.price}`);
    if (d.costPrice !== null && d.costPrice !== b.costPrice) changes.push(`سعر الشراء: ${b.costPrice ?? '—'} ← ${d.costPrice}`);
    if (d.quantity !== null) {
      if (opts.stockMode === 'add' && d.quantity > 0) changes.push(`المخزون: ${b.stock ?? 0} + ${d.quantity}`);
      if (opts.stockMode === 'set' && d.quantity !== b.stock) changes.push(`المخزون: ${b.stock ?? '—'} ← ${d.quantity}`);
    }
    if (d.status && d.status !== b.status) changes.push('حالة التوفر');
    if (d.year !== null && d.year !== b.year) changes.push(`السنة ← ${d.year}`);
    if (d.description && !b.description) changes.push('إضافة نبذة');
    if (d.notes && !b.notes) changes.push('إضافة معلومات إضافية');
    if (d.publishers.length && !b.publishers) changes.push('إضافة دار النشر');
    if (d.imageUrl && !b.imageUrl) changes.push('إضافة صورة الغلاف');
    if (d.category && PLACEHOLDER_CATEGORIES.includes(b.categoryName) && !PLACEHOLDER_CATEGORIES.includes(d.category)) {
      changes.push(`التصنيف ← ${d.category}`);
    }
    return changes;
  }

  private async loadExisting(storeId: string): Promise<Map<string, ExistingBook[]>> {
    const books = await this.prisma.book.findMany({
      where: { storeId },
      select: {
        id: true,
        titleNormalized: true,
        title: true,
        price: true,
        costPrice: true,
        year: true,
        description: true,
        notes: true,
        imageUrl: true,
        category: { select: { name: true } },
        inventory: { select: { stock: true, status: true } },
        authors: { select: { author: { select: { name: true } } }, orderBy: { position: 'asc' }, take: 1 },
        _count: { select: { publishers: true } },
      },
    });
    const map = new Map<string, ExistingBook[]>();
    for (const b of books) {
      const key = b.titleNormalized ?? normalizeArabic(b.title);
      const list = map.get(key) ?? [];
      list.push({
        id: b.id,
        authorNorm: b.authors[0] ? normalizeArabic(b.authors[0].author.name) : null,
        price: b.price === null ? null : Number(b.price),
        costPrice: b.costPrice === null ? null : Number(b.costPrice),
        year: b.year,
        description: b.description,
        notes: b.notes,
        imageUrl: b.imageUrl,
        categoryName: b.category.name,
        publishers: b._count.publishers,
        stock: b.inventory?.stock ?? null,
        status: b.inventory?.status ?? null,
        hasInventory: !!b.inventory,
      });
      map.set(key, list);
    }
    return map;
  }

  private validateOptions(opts: ImportOptions, sheet: ReadSheet) {
    if (!Number.isInteger(opts.headerRow) || opts.headerRow < 0 || opts.headerRow > sheet.rows.length) {
      throw new BadRequestException('رقم سطر العناوين غير صحيح.');
    }
    const used = new Set<number>();
    for (const [field, index] of Object.entries(opts.mapping)) {
      if (!(FIELD_KEYS as readonly string[]).includes(field)) throw new BadRequestException(`حقل غير معروف: ${field}`);
      if (index === undefined || index === null) continue;
      if (!Number.isInteger(index) || index < 0 || index >= 60) throw new BadRequestException('رقم عمود غير صحيح.');
      if (used.has(index)) throw new BadRequestException(`العمود ${columnLetter(index)} مربوط بأكثر من حقل.`);
      used.add(index);
    }
    if (opts.mapping.title === undefined || opts.mapping.title === null) {
      throw new BadRequestException('اختر العمود الذي يحتوي على عنوان الكتاب.');
    }
  }

  // ── Writing ─────────────────────────────────────────────

  private async newReferenceNames(creates: RowData[], updates: RowData[]) {
    const authors = new Set<string>();
    const publishers = new Set<string>();
    const categories = new Set<string>();
    for (const d of [...creates, ...updates]) {
      d.authors.forEach((a) => authors.add(a));
      d.publishers.forEach((p) => publishers.add(p));
      if (d.category) categories.add(d.category);
    }
    const [a, p, c] = await Promise.all([
      this.prisma.author.findMany({ where: { name: { in: [...authors] } }, select: { name: true } }),
      this.prisma.publisher.findMany({ where: { name: { in: [...publishers] } }, select: { name: true } }),
      this.prisma.category.findMany({ where: { name: { in: [...categories] } }, select: { name: true } }),
    ]);
    const has = (rows: { name: string }[]) => new Set(rows.map((r) => r.name));
    const ha = has(a), hp = has(p), hc = has(c);
    return {
      authors: [...authors].filter((x) => !ha.has(x)).length,
      publishers: [...publishers].filter((x) => !hp.has(x)).length,
      categories: [...categories].filter((x) => !hc.has(x)),
    };
  }

  /** Find-or-create every name the import needs, in a few bulk queries. */
  private async resolveNames(rows: RowData[], opts: ImportOptions) {
    const collect = (pick: (d: RowData) => (string | null)[]) => [...new Set(rows.flatMap(pick).filter((x): x is string => !!x))];
    const categories = collect((d) => [d.category]);
    categories.push(text(opts.defaultCategory ?? '') || FALLBACK_CATEGORY);
    return {
      author: await this.bulk('author', collect((d) => d.authors)),
      publisher: await this.bulk('publisher', collect((d) => d.publishers)),
      category: await this.bulk('category', [...new Set(categories)]),
      country: await this.bulk('country', collect((d) => [d.country])),
      fallbackCategory: text(opts.defaultCategory ?? '') || FALLBACK_CATEGORY,
    };
  }

  private async bulk(model: 'author' | 'publisher' | 'category' | 'country', names: string[]) {
    const ids = new Map<string, string>();
    const delegate = this.prisma[model] as any;
    for (let i = 0; i < names.length; i += 1000) {
      const chunk = names.slice(i, i + 1000);
      await delegate.createMany({ data: chunk.map((name) => ({ name })), skipDuplicates: true });
      const found: { id: string; name: string }[] = await delegate.findMany({ where: { name: { in: chunk } }, select: { id: true, name: true } });
      for (const f of found) ids.set(f.name, f.id);
    }
    return ids;
  }

  private async writeCreates(
    storeId: string,
    jobId: string,
    rows: PlannedRow[],
    names: Awaited<ReturnType<DataImportService['resolveNames']>>,
    opts: ImportOptions,
  ): Promise<number> {
    const items = rows.map((r) => ({ id: randomUUID(), d: r.data! }));
    await this.prisma.$transaction([
      this.prisma.book.createMany({
        data: items.map(({ id, d }) => ({
          id,
          storeId,
          importJobId: jobId,
          title: d.title,
          titleNormalized: d.titleNormalized,
          year: d.year,
          price: d.price,
          costPrice: d.costPrice,
          description: d.description,
          notes: d.notes,
          imageUrl: d.imageUrl,
          categoryId: names.category.get(d.category ?? names.fallbackCategory) ?? names.category.get(names.fallbackCategory)!,
          countryId: d.country ? names.country.get(d.country) ?? null : null,
        })),
      }),
      this.prisma.bookAuthor.createMany({
        data: items.flatMap(({ id, d }) => d.authors.map((a, position) => ({ bookId: id, authorId: names.author.get(a)!, position }))),
        skipDuplicates: true,
      }),
      this.prisma.bookPublisher.createMany({
        data: items.flatMap(({ id, d }) => d.publishers.map((p, position) => ({ bookId: id, publisherId: names.publisher.get(p)!, position }))),
        skipDuplicates: true,
      }),
      this.prisma.inventory.createMany({
        data: items.map(({ id, d }) => ({
          bookId: id,
          storeId,
          stock: d.quantity,
          // A count of 0 means "not on the shelf" unless the sheet says otherwise.
          status: d.status ?? (d.quantity === 0 ? 'on_request' : opts.defaultStatus),
        })),
      }),
      this.prisma.bookImage.createMany({
        data: items.filter(({ d }) => d.imageUrl).map(({ id, d }) => ({ bookId: id, url: d.imageUrl!, position: 0 })),
      }),
    ]);
    return items.length;
  }

  private async writeUpdates(
    storeId: string,
    rows: PlannedRow[],
    names: Awaited<ReturnType<DataImportService['resolveNames']>>,
    opts: ImportOptions,
  ): Promise<number> {
    await this.prisma.$transaction(
      async (tx) => {
        for (const r of rows) {
          const d = r.data!;
          const id = r.matchId!;
          const book = await tx.book.findFirst({
            where: { id, storeId },
            select: {
              imageUrl: true,
              description: true,
              notes: true,
              category: { select: { name: true } },
              inventory: { select: { stock: true } },
              _count: { select: { publishers: true } },
            },
          });
          if (!book) continue;

          const data: Prisma.BookUpdateInput = {};
          if (d.price !== null) data.price = d.price;
          if (d.costPrice !== null) data.costPrice = d.costPrice;
          if (d.year !== null) data.year = d.year;
          if (d.description && !book.description) data.description = d.description;
          if (d.notes && !book.notes) data.notes = d.notes;
          if (d.category && PLACEHOLDER_CATEGORIES.includes(book.category.name) && !PLACEHOLDER_CATEGORIES.includes(d.category)) {
            data.category = { connect: { id: names.category.get(d.category)! } };
          }
          if (Object.keys(data).length) await tx.book.update({ where: { id }, data });

          if (d.quantity !== null || d.status) {
            const current = book.inventory?.stock ?? 0;
            const stock = d.quantity === null ? undefined : opts.stockMode === 'add' ? current + d.quantity : d.quantity;
            await tx.inventory.upsert({
              where: { bookId: id },
              create: { bookId: id, storeId, stock: stock ?? null, status: d.status ?? opts.defaultStatus },
              update: { ...(stock !== undefined ? { stock } : {}), ...(d.status ? { status: d.status } : {}) },
            });
          }
          if (d.publishers.length && !book._count.publishers) {
            await tx.bookPublisher.createMany({
              data: d.publishers.map((p, position) => ({ bookId: id, publisherId: names.publisher.get(p)!, position })),
              skipDuplicates: true,
            });
          }
          if (d.imageUrl && !book.imageUrl) await setBookCover(tx, id, d.imageUrl);
        }
      },
      { timeout: 60_000 },
    );
    return rows.length;
  }

  // ── Sessions ────────────────────────────────────────────

  private putSession(storeId: string, fileName: string, sheets: ReadSheet[]): Session {
    this.sweep();
    const mine = [...this.sessions.values()].filter((s) => s.storeId === storeId).sort((a, b) => a.expiresAt - b.expiresAt);
    while (mine.length >= MAX_SESSIONS_PER_STORE) this.sessions.delete(mine.shift()!.id);
    if (this.sessions.size >= MAX_SESSIONS) {
      const oldest = [...this.sessions.values()].sort((a, b) => a.expiresAt - b.expiresAt)[0];
      this.sessions.delete(oldest.id);
    }
    const session: Session = { id: randomUUID(), storeId, fileName, sheets, expiresAt: Date.now() + SESSION_TTL_MS };
    this.sessions.set(session.id, session);
    return session;
  }

  private getSession(id: string, storeId: string): Session {
    this.sweep();
    const s = this.sessions.get(id);
    // Another store's session id simply does not exist for this caller.
    if (!s || s.storeId !== storeId) {
      throw new NotFoundException('انتهت صلاحية الملف المرفوع (30 دقيقة). ارفعه من جديد.');
    }
    s.expiresAt = Date.now() + SESSION_TTL_MS;
    return s;
  }

  private sweep() {
    const now = Date.now();
    for (const [id, s] of this.sessions) if (s.expiresAt < now) this.sessions.delete(id);
  }
}

/**
 * Multer (busboy) reads multipart file names as Latin-1, so "مخزون.xlsx"
 * arrives as mojibake. Re-decode as UTF-8 when that yields valid text.
 */
export function utf8FileName(name: string): string {
  if (!/[\u0080-ÿ]/.test(name)) return name;
  const decoded = Buffer.from(name, 'latin1').toString('utf8');
  return decoded.includes('�') ? name : decoded;
}

function issue(code: string, level: 'error' | 'warning', message: string): Issue {
  return { code, level, message };
}

const ACTION_LABELS: Record<Action, string> = {
  create: 'جديد',
  update: 'تحديث',
  unchanged: 'بدون تغيير',
  skip: 'تجاهل',
  error: 'خطأ',
};

/** One title per issue type, for the summary list. */
const ISSUE_TITLES: Record<string, string> = {
  missing_title: 'أسطر بدون عنوان',
  missing_author: 'كتب جديدة بدون مؤلف',
  missing_price: 'كتب جديدة بدون سعر بيع',
  invalid_price: 'سعر بيع غير مفهوم',
  invalid_cost: 'سعر شراء غير مفهوم',
  invalid_quantity: 'كمية غير مفهومة',
  invalid_status: 'حالة توفر غير مفهومة',
  invalid_url: 'رابط صورة غير صالح',
  invalid_year: 'سنة غير مفهومة',
  duplicate_in_file: 'أسطر مكررة داخل الملف',
  ambiguous: 'عناوين تطابق أكثر من كتاب',
  exists: 'كتب موجودة مسبقًا (متجاهلة)',
};

export type { ColumnSuggestion, Row };
