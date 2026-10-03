import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { ImagesService } from '../images/images.service';
import { normalizeArabic } from '../../common/utils/normalize-arabic';
import { parse } from 'csv-parse/sync';
import * as XLSX from 'xlsx';

// ── Types ──────────────────────────────────────────────

/** The columns we read. Anything else in the file is ignored. */
const COLUMNS = ['title', 'author', 'category', 'publisher', 'year'] as const;
type Column = (typeof COLUMNS)[number];
type RawRow = Partial<Record<Column, string>>;

interface RowError {
  row: number;
  title: string | null;
  reason: string;
}

export interface ImportResult {
  total: number;
  created: number;
  skipped: number;
  errors: number;
  errorDetails: RowError[];
}

export interface ImportOptions {
  /** Look covers up online for new books (slow: several HTTP calls each). */
  images?: boolean;
}

/** A validated row that will become a book. */
interface PlannedBook {
  rowNum: number;
  title: string;
  titleNormalized: string;
  author: string;
  category: string;
  publisher: string | null;
  year: number | null;
}

// ── Constants ──────────────────────────────────────────

/** Rows per file. A bigger catalogue is imported in several files. */
const MAX_ROWS = 5000;
/** Books written per transaction. */
const WRITE_CHUNK = 500;
/** Names resolved per query. */
const NAME_CHUNK = 1000;
/** Concurrent cover lookups — external APIs, so kept polite. */
const IMAGE_CONCURRENCY = 8;
const DEFAULT_CATEGORY = 'عام';

@Injectable()
export class ImportService {
  private readonly logger = new Logger(ImportService.name);
  /** Stores with an import in progress. Two at once could duplicate books. */
  private readonly running = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly imagesService: ImagesService,
  ) {}

  // ── Public ──────────────────────────────────────────

  async importBooks(
    storeSlug: string,
    file: Express.Multer.File,
    options: ImportOptions = {},
  ): Promise<ImportResult> {
    const store = await this.resolveStore(storeSlug);
    const rows = this.parseFile(file);

    if (rows.length === 0) {
      throw new BadRequestException('File is empty or contains no data rows');
    }
    if (rows.length > MAX_ROWS) {
      throw new BadRequestException(
        `File has ${rows.length} rows; the limit is ${MAX_ROWS} per import. Split it into smaller files.`,
      );
    }
    if (this.running.has(store.id)) {
      throw new ConflictException('An import is already running for this store. Try again when it finishes.');
    }

    this.running.add(store.id);
    try {
      return await this.run(store.id, rows, options);
    } finally {
      this.running.delete(store.id);
    }
  }

  private async run(storeId: string, rows: RawRow[], options: ImportOptions): Promise<ImportResult> {
    const started = Date.now();
    const result: ImportResult = { total: rows.length, created: 0, skipped: 0, errors: 0, errorDetails: [] };
    const fail = (row: number, title: string | null, reason: string) => {
      result.errors++;
      result.errorDetails.push({ row, title, reason });
    };

    // 1. Validate and normalise every row (no database work yet).
    const valid: PlannedBook[] = [];
    rows.forEach((raw, i) => {
      const rowNum = i + 2; // header is row 1
      const title = this.clean(raw.title);
      const author = this.clean(raw.author);
      if (!title) return fail(rowNum, null, 'Missing required field: title');
      if (!author) return fail(rowNum, title, 'Missing required field: author');
      const year = parseInt(this.clean(raw.year), 10);
      valid.push({
        rowNum,
        title,
        titleNormalized: normalizeArabic(title),
        author,
        category: this.clean(raw.category) || DEFAULT_CATEGORY,
        publisher: this.clean(raw.publisher) || null,
        year: Number.isFinite(year) && year > 0 && year < 3000 ? year : null,
      });
    });

    // 2. Resolve every author / category / publisher in a few bulk queries.
    const authorIds = await this.resolveNames('author', valid.map((r) => r.author));
    const categoryIds = await this.resolveNames('category', valid.map((r) => r.category));
    const publisherIds = await this.resolveNames(
      'publisher',
      valid.map((r) => r.publisher).filter((p): p is string => !!p),
    );

    // 3. De-duplicate against the store AND within the file, in order, so the
    //    first occurrence wins and a repeated row is skipped — never created twice.
    const seen = await this.loadExistingKeys(storeId);
    const toCreate: (PlannedBook & { authorId: string; categoryId: string; publisherId: string | null })[] = [];
    for (const row of valid) {
      const authorId = authorIds.get(row.author)!;
      const key = `${row.titleNormalized}::${authorId}`;
      if (seen.has(key)) {
        result.skipped++;
        continue;
      }
      seen.add(key);
      toCreate.push({
        ...row,
        authorId,
        categoryId: categoryIds.get(row.category)!,
        publisherId: row.publisher ? publisherIds.get(row.publisher)! : null,
      });
    }

    // 4. Covers, only for the books that will actually be created.
    const covers = options.images === false ? new Map<number, string>() : await this.lookupCovers(toCreate);

    // 5. Write in chunks; each chunk is one transaction, so a book never
    //    exists without its author, publisher and inventory rows.
    for (let i = 0; i < toCreate.length; i += WRITE_CHUNK) {
      const chunk = toCreate.slice(i, i + WRITE_CHUNK).map((r) => ({ ...r, id: randomUUID() }));
      try {
        await this.prisma.$transaction([
          this.prisma.book.createMany({
            data: chunk.map((r) => ({
              id: r.id,
              storeId,
              title: r.title,
              titleNormalized: r.titleNormalized,
              year: r.year,
              categoryId: r.categoryId,
              imageUrl: covers.get(r.rowNum) ?? null,
            })),
          }),
          this.prisma.bookAuthor.createMany({
            data: chunk.map((r) => ({ bookId: r.id, authorId: r.authorId, position: 0 })),
          }),
          this.prisma.bookPublisher.createMany({
            data: chunk
              .filter((r) => r.publisherId)
              .map((r) => ({ bookId: r.id, publisherId: r.publisherId!, position: 0 })),
          }),
          this.prisma.inventory.createMany({
            data: chunk.map((r) => ({ bookId: r.id, storeId, status: 'available' as const })),
          }),
          // Keep the gallery in step with the cover (picture 0).
          this.prisma.bookImage.createMany({
            data: chunk
              .filter((r) => covers.has(r.rowNum))
              .map((r) => ({ bookId: r.id, url: covers.get(r.rowNum)!, position: 0 })),
          }),
        ]);
        result.created += chunk.length;
      } catch (err) {
        this.logger.error(`Import chunk failed (${chunk.length} rows)`, err instanceof Error ? err.stack : String(err));
        for (const r of chunk) fail(r.rowNum, r.title, 'Database write failed; row not imported');
      }
    }

    result.errorDetails.sort((a, b) => a.row - b.row);
    this.logger.log(
      `Import: ${result.created} created, ${result.skipped} skipped, ${result.errors} errors in ${Date.now() - started} ms`,
    );
    return result;
  }

  // ── File Parsing ─────────────────────────────────────

  private parseFile(file: Express.Multer.File): RawRow[] {
    const ext = this.getExtension(file.originalname);

    let records: Record<string, unknown>[];
    if (ext === '.csv') records = this.parseCsv(file.buffer);
    else if (ext === '.xlsx' || ext === '.xls') records = this.parseExcel(file.buffer);
    else throw new BadRequestException('Unsupported file format. Use CSV or XLSX.');

    // Copy only the known columns into fresh objects. Values may be numbers
    // (a spreadsheet title like "1984") — stringify them instead of crashing.
    return records.map((rec) => {
      const row: RawRow = {};
      for (const col of COLUMNS) {
        const v = Object.prototype.hasOwnProperty.call(rec, col) ? rec[col] : undefined;
        if (v !== undefined && v !== null) row[col] = String(v);
      }
      return row;
    });
  }

  private parseCsv(buffer: Buffer): Record<string, unknown>[] {
    try {
      return parse(buffer, {
        // Only recognised headers become keys; anything else (including a
        // "__proto__" column) is dropped before it reaches an object.
        columns: (header: string[]) =>
          header.map((h) => {
            const key = String(h).trim().toLowerCase();
            return (COLUMNS as readonly string[]).includes(key) ? key : false;
          }),
        skip_empty_lines: true,
        trim: true,
        bom: true,
        relax_column_count: true,
        to: MAX_ROWS + 1,
      });
    } catch (err) {
      throw new BadRequestException(`Could not read the CSV file: ${(err as Error).message}`);
    }
  }

  private parseExcel(buffer: Buffer): Record<string, unknown>[] {
    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(buffer, {
        type: 'buffer',
        // Read no further than the row limit, and skip what we never use.
        sheetRows: MAX_ROWS + 2,
        cellFormula: false,
        cellHTML: false,
        cellStyles: false,
      });
    } catch {
      throw new BadRequestException('Could not read the Excel file');
    }
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) throw new BadRequestException('Excel file has no sheets');

    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
      header: 1,
      raw: false, // formatted text: numbers and dates arrive as strings
      defval: '',
    });
    const [header = [], ...data] = rows;
    const keys = header.map((h) => String(h ?? '').trim().toLowerCase());
    return data
      .filter((r) => r.some((v) => String(v ?? '').trim() !== ''))
      .map((r) => {
        const rec: Record<string, unknown> = {};
        keys.forEach((k, i) => {
          if ((COLUMNS as readonly string[]).includes(k)) rec[k] = r[i];
        });
        return rec;
      });
  }

  // ── Entity Resolution ─────────────────────────────────

  /**
   * Find-or-create every distinct name with two queries per chunk: an insert
   * that skips names already present (race-safe on the unique index), then a
   * read of the ids.
   */
  private async resolveNames(
    type: 'author' | 'category' | 'publisher',
    names: string[],
  ): Promise<Map<string, string>> {
    const unique = [...new Set(names)];
    const ids = new Map<string, string>();
    const model = this.prisma[type] as any;

    for (let i = 0; i < unique.length; i += NAME_CHUNK) {
      const chunk = unique.slice(i, i + NAME_CHUNK);
      await model.createMany({ data: chunk.map((name) => ({ name })), skipDuplicates: true });
      const found: { id: string; name: string }[] = await model.findMany({
        where: { name: { in: chunk } },
        select: { id: true, name: true },
      });
      for (const f of found) ids.set(f.name, f.id);
    }
    return ids;
  }

  // ── Deduplication ───────────────────────────────────

  /** `titleNormalized::primaryAuthorId` for every book already in the store. */
  private async loadExistingKeys(storeId: string): Promise<Set<string>> {
    const books = await this.prisma.book.findMany({
      where: { storeId },
      select: {
        titleNormalized: true,
        authors: { select: { authorId: true }, orderBy: { position: 'asc' }, take: 1 },
      },
    });
    const set = new Set<string>();
    for (const b of books) {
      const authorId = b.authors[0]?.authorId;
      if (b.titleNormalized && authorId) set.add(`${b.titleNormalized}::${authorId}`);
    }
    return set;
  }

  // ── Covers ──────────────────────────────────────────

  /** Online cover lookups with bounded concurrency; failures just mean no cover. */
  private async lookupCovers(rows: PlannedBook[]): Promise<Map<number, string>> {
    const covers = new Map<number, string>();
    let next = 0;
    const worker = async () => {
      while (next < rows.length) {
        const row = rows[next++];
        try {
          const url = await this.imagesService.getBookImage(row.title, row.author);
          if (url) covers.set(row.rowNum, url);
        } catch {
          /* no cover */
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(IMAGE_CONCURRENCY, rows.length) }, worker));
    return covers;
  }

  // ── Helpers ─────────────────────────────────────────

  private async resolveStore(slug: string) {
    const store = await this.prisma.store.findUnique({ where: { slug } });
    if (!store) throw new NotFoundException('Store not found');
    return store;
  }

  private clean(value: string | undefined): string {
    return (value ?? '').replace(/\s+/g, ' ').trim();
  }

  private getExtension(filename: string): string {
    const dot = filename.lastIndexOf('.');
    return dot === -1 ? '' : filename.slice(dot).toLowerCase();
  }
}
