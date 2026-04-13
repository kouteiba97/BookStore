import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ImagesService } from '../images/images.service';
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
const IMAGE_CONCURRENCY = 12;
const REQUIRED_FIELDS: (keyof RawRow)[] = ['title', 'author'];

@Injectable()
export class ImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly imagesService: ImagesService,
  ) {}

  // ── Public ──────────────────────────────────────────

  async importBooks(storeSlug: string, file: Express.Multer.File): Promise<ImportResult> {
    const store = await this.resolveStore(storeSlug);
    const rows = this.parseFile(file);

    if (rows.length === 0) {
      throw new BadRequestException('File is empty or contains no data rows');
    }

    const result: ImportResult = { total: rows.length, created: 0, skipped: 0, errors: 0, errorDetails: [] };

    const authorCache = new Map<string, string>();
    const categoryCache = new Map<string, string>();
    const publisherCache = new Map<string, string>();
    const imageCache = new Map<string, string | null>();
    const existingBooks = await this.loadExistingBooks(store.id);

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const batchOffset = i;

      // Pre-fetch images for the entire batch (limited concurrency) before any DB writes
      await this.prefetchImages(batch, imageCache);

      await Promise.all(
        batch.map((row, idx) =>
          this.processRow(row, batchOffset + idx + 2, store.id, {
            authorCache,
            categoryCache,
            publisherCache,
            existingBooks,
            imageCache,
          }, result),
        ),
      );
    }

    return result;
  }

  // ── Image Pre-fetching ──────────────────────────────

  private async prefetchImages(
    rows: RawRow[],
    imageCache: Map<string, string | null>,
  ): Promise<void> {
    // Collect unique (title, author) pairs not already in cache
    const seen = new Map<string, { title: string; author: string }>();

    for (const row of rows) {
      if (!row.title?.trim() || !row.author?.trim()) continue;

      const title = row.title.trim();
      const author = this.normalizeSpacing(row.author);
      const key = `${title}::${author}`;

      if (!imageCache.has(key) && !seen.has(key)) {
        seen.set(key, { title, author });
      }
    }

    const pairs = [...seen.values()];
    if (pairs.length === 0) return;

    // Fetch in chunks to keep concurrency within bounds
    for (let i = 0; i < pairs.length; i += IMAGE_CONCURRENCY) {
      const chunk = pairs.slice(i, i + IMAGE_CONCURRENCY);

      await Promise.all(
        chunk.map(async ({ title, author }) => {
          const key = `${title}::${author}`;
          try {
            const url = await this.imagesService.getBookImage(title, author);
            imageCache.set(key, url);
          } catch {
            imageCache.set(key, null);
          }
        }),
      );
    }
  }

  // ── File Parsing ─────────────────────────────────────

  private parseFile(file: Express.Multer.File): RawRow[] {
    const ext = this.getExtension(file.originalname);

    if (ext === '.csv') return this.parseCsv(file.buffer);
    if (ext === '.xlsx' || ext === '.xls') return this.parseExcel(file.buffer);

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
      imageCache: Map<string, string | null>;
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

      // 4. Resolve image from pre-fetched cache (null if not found or API failed)
      const imageUrl = caches.imageCache.get(`${title}::${authorName}`) ?? null;

      // 5. Create book with image
      const book = await this.prisma.book.create({
        data: {
          title,
          titleNormalized,
          year,
          storeId,
          authorId,
          categoryId,
          publisherId,
          imageUrl,
        },
      });

      // 6. Create inventory (unchanged)
      await this.prisma.inventory.create({
        data: {
          bookId: book.id,
          storeId,
          status: 'available',
        },
      });

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
