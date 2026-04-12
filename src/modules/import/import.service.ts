import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { normalizeArabic } from '../../common/utils/normalize-arabic';
import { parse } from 'csv-parse/sync';
import * as XLSX from 'xlsx';

// ── Types ──────────────────────────────────────────────

interface RawRow {
  title?: string;
  author?: string;
  category?: string;
  publisher?: string;
  year?: string;
  language?: string;
}

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

// ── Constants ──────────────────────────────────────────

const BATCH_SIZE = 50;
const REQUIRED_FIELDS: (keyof RawRow)[] = ['title', 'author'];

@Injectable()
export class ImportService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Public ──────────────────────────────────────────

  async importBooks(storeSlug: string, file: Express.Multer.File): Promise<ImportResult> {
    const store = await this.resolveStore(storeSlug);
    const rows = this.parseFile(file);

    if (rows.length === 0) {
      throw new BadRequestException('File is empty or contains no data rows');
    }

    const result: ImportResult = { total: rows.length, created: 0, skipped: 0, errors: 0, errorDetails: [] };

    // Pre-load caches to avoid N+1 queries
    const authorCache = new Map<string, string>();
    const categoryCache = new Map<string, string>();
    const publisherCache = new Map<string, string>();
    const existingBooks = await this.loadExistingBooks(store.id);

    // Process in batches
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const batchOffset = i;

      await Promise.all(
        batch.map((row, idx) =>
          this.processRow(row, batchOffset + idx + 2, store.id, {
            authorCache,
            categoryCache,
            publisherCache,
            existingBooks,
          }, result),
        ),
      );
    }

    return result;
  }

  // ── File Parsing ─────────────────────────────────────

  private parseFile(file: Express.Multer.File): RawRow[] {
    const ext = this.getExtension(file.originalname);

    if (ext === '.csv') {
      return this.parseCsv(file.buffer);
    }

    if (ext === '.xlsx' || ext === '.xls') {
      return this.parseExcel(file.buffer);
    }

    throw new BadRequestException('Unsupported file format. Use CSV or XLSX.');
  }

  private parseCsv(buffer: Buffer): RawRow[] {
    return parse(buffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
      relax_column_count: true,
    });
  }

  private parseExcel(buffer: Buffer): RawRow[] {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];

    if (!sheetName) {
      throw new BadRequestException('Excel file has no sheets');
    }

    const sheet = workbook.Sheets[sheetName];
    return XLSX.utils.sheet_to_json<RawRow>(sheet, { defval: '' });
  }

  // ── Row Processing ──────────────────────────────────

  private async processRow(
    raw: RawRow,
    rowNum: number,
    storeId: string,
    caches: {
      authorCache: Map<string, string>;
      categoryCache: Map<string, string>;
      publisherCache: Map<string, string>;
      existingBooks: Set<string>;
    },
    result: ImportResult,
  ): Promise<void> {
    try {
      // 1. Validate
      const validation = this.validateRow(raw);
      if (validation) {
        result.errors++;
        result.errorDetails.push({ row: rowNum, title: raw.title ?? null, reason: validation });
        return;
      }

      const title = raw.title!.trim();
      const authorName = this.normalizeSpacing(raw.author!);
      const categoryName = raw.category ? this.normalizeSpacing(raw.category) : 'عام';
      const publisherName = raw.publisher ? this.normalizeSpacing(raw.publisher) : null;
      const year = raw.year ? parseInt(raw.year, 10) || null : null;
      const titleNormalized = normalizeArabic(title);

      // 2. Resolve references
      const authorId = await this.findOrCreateEntity(authorName, 'author', caches.authorCache);
      const categoryId = await this.findOrCreateEntity(categoryName, 'category', caches.categoryCache);
      const publisherId = publisherName
        ? await this.findOrCreateEntity(publisherName, 'publisher', caches.publisherCache)
        : null;

      // 3. Deduplication
      const dedupeKey = this.dedupeKey(storeId, titleNormalized, authorId);
      if (caches.existingBooks.has(dedupeKey)) {
        result.skipped++;
        return;
      }

      // 4. Create book + inventory
      const book = await this.prisma.book.create({
        data: {
          title,
          titleNormalized,
          year,
          storeId,
          authorId,
          categoryId,
          publisherId,
        },
      });

      await this.prisma.inventory.create({
        data: {
          bookId: book.id,
          storeId,
          status: 'available',
        },
      });

      // Update cache so subsequent rows in the same batch detect duplicates
      caches.existingBooks.add(dedupeKey);
      result.created++;
    } catch {
      result.errors++;
      result.errorDetails.push({ row: rowNum, title: raw.title ?? null, reason: 'Unexpected processing error' });
    }
  }

  // ── Validation ──────────────────────────────────────

  private validateRow(row: RawRow): string | null {
    for (const field of REQUIRED_FIELDS) {
      if (!row[field] || row[field]!.trim().length === 0) {
        return `Missing required field: ${field}`;
      }
    }
    return null;
  }

  // ── Entity Resolution (Find or Create) ─────────────

  private async findOrCreateEntity(
    name: string,
    type: 'author' | 'category' | 'publisher',
    cache: Map<string, string>,
  ): Promise<string> {
    const key = name.toLowerCase();
    const cached = cache.get(key);
    if (cached) return cached;

    const upsertArgs = { where: { name }, create: { name }, update: {}, select: { id: true } };

    let record: { id: string };
    switch (type) {
      case 'author':
        record = await this.prisma.author.upsert(upsertArgs);
        break;
      case 'category':
        record = await this.prisma.category.upsert(upsertArgs);
        break;
      case 'publisher':
        record = await this.prisma.publisher.upsert(upsertArgs);
        break;
    }

    cache.set(key, record.id);
    return record.id;
  }

  // ── Deduplication ───────────────────────────────────

  private async loadExistingBooks(storeId: string): Promise<Set<string>> {
    const books = await this.prisma.book.findMany({
      where: { storeId },
      select: { titleNormalized: true, authorId: true },
    });

    const set = new Set<string>();
    for (const book of books) {
      if (book.titleNormalized && book.authorId) {
        set.add(this.dedupeKey(storeId, book.titleNormalized, book.authorId));
      }
    }
    return set;
  }

  private dedupeKey(storeId: string, titleNormalized: string, authorId: string): string {
    return `${storeId}::${titleNormalized}::${authorId}`;
  }

  // ── Helpers ─────────────────────────────────────────

  private async resolveStore(slug: string) {
    const store = await this.prisma.store.findUnique({ where: { slug } });
    if (!store) throw new NotFoundException('Store not found');
    return store;
  }

  private normalizeSpacing(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
  }

  private getExtension(filename: string): string {
    const dot = filename.lastIndexOf('.');
    return dot === -1 ? '' : filename.slice(dot).toLowerCase();
  }
}
