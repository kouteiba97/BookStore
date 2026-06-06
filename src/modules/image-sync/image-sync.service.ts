import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { normalizeArabic } from '../../common/utils/normalize-arabic';
import * as fs from 'fs';
import * as path from 'path';
import { createWorker } from 'tesseract.js';

// ── Constants ─────────────────────────────────────────────

const IMAGES_FOLDER = path.join(process.cwd(), 'images');
const STATIC_FOLDER = path.join(process.cwd(), 'public', 'covers');
const BATCH_SIZE = 12;
const SUPPORTED_EXT = new Set(['.jpg', '.jpeg', '.png']);
const WEAK_PATTERN = /^(img|image|photo|pic|dsc|cam|screenshot|p\d+|img_\d+|dscn?\d+|dcim\d*)$/i;

// Noise words stripped before matching (but kept in stored title)
const NOISE_WORDS = new Set([
  'كتاب', 'شرح', 'جزء', 'المجلد', 'مجلد', 'الجزء', 'الكتاب',
  'متن', 'نص', 'مختصر', 'تفسير', 'كتب',
]);

// ── Types ─────────────────────────────────────────────────

export interface SyncOptions {
  allowCreate?: boolean; // default true
}

interface ImageFile {
  fullPath: string;
  filename: string;
  ext: string;
}

type MatchStrategy = 'exact' | 'partial' | 'denoised' | 'firstWords' | 'created';

interface ProcessedResult {
  filename: string;
  finalTitle: string;
  ocrUsed: boolean;
  matchStrategy?: MatchStrategy;
  action: 'updated' | 'created' | 'skipped' | 'error';
  reason?: string;
}

export interface SyncResult {
  totalProcessed: number;
  booksMatched: number;
  booksCreated: number;
  imagesUpdated: number;
  ocrUsedCount: number;
  skipped: number;
  errors: number;
  unmatchedTitles: string[];
}

// ── Service ───────────────────────────────────────────────

@Injectable()
export class ImageSyncService {
  private readonly logger = new Logger(ImageSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  // ── Public ────────────────────────────────────────────

  async syncFromFolder(
    storeSlug: string,
    options: SyncOptions = {},
  ): Promise<SyncResult> {
    const { allowCreate = true } = options;

    const store = await this.prisma.store.findUnique({ where: { slug: storeSlug } });
    if (!store) throw new NotFoundException(`Store not found: ${storeSlug}`);

    this.ensureStaticFolder();

    const files = this.scanFolder(IMAGES_FOLDER);
    if (files.length === 0) {
      return {
        totalProcessed: 0, booksMatched: 0, booksCreated: 0,
        imagesUpdated: 0, ocrUsedCount: 0, skipped: 0, errors: 0,
        unmatchedTitles: [],
      };
    }

    this.logger.log(`Found ${files.length} images in ${IMAGES_FOLDER}`);

    // Preload all existing books for in-memory fuzzy matching
    const allBooks = await this.prisma.book.findMany({
      where: { storeId: store.id },
      select: { id: true, title: true, titleNormalized: true },
    });

    // Build lookup map: normalized → bookId
    const bookMap = new Map<string, string>();
    for (const b of allBooks) {
      const key = b.titleNormalized ?? normalizeArabic(b.title);
      bookMap.set(key, b.id);
    }

    // Per-run dedup: normalized → bookId (includes newly created)
    const resolvedCache = new Map<string, string | null>();

    const result: SyncResult = {
      totalProcessed: 0, booksMatched: 0, booksCreated: 0,
      imagesUpdated: 0, ocrUsedCount: 0, skipped: 0, errors: 0,
      unmatchedTitles: [],
    };

    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      const batch = files.slice(i, i + BATCH_SIZE);
      const processed = await Promise.all(
        batch.map((f) => this.processImage(f, store.id, bookMap, resolvedCache, allowCreate)),
      );

      for (const p of processed) {
        result.totalProcessed++;
        if (p.ocrUsed) result.ocrUsedCount++;
        if (p.action === 'updated') { result.booksMatched++; result.imagesUpdated++; }
        else if (p.action === 'created') { result.booksCreated++; result.imagesUpdated++; }
        else if (p.action === 'skipped') {
          result.skipped++;
          if (p.reason === 'no match' && p.finalTitle) {
            result.unmatchedTitles.push(p.finalTitle);
          }
        }
        else if (p.action === 'error') result.errors++;
      }

      this.logger.log(
        `Batch ${Math.floor(i / BATCH_SIZE) + 1} done — ${result.imagesUpdated} updated so far`,
      );
    }

    this.logger.log(`Sync complete: ${JSON.stringify({ ...result, unmatchedTitles: result.unmatchedTitles.length })}`);
    return result;
  }

  // ── Core per-image processing ─────────────────────────

  private async processImage(
    file: ImageFile,
    storeId: string,
    bookMap: Map<string, string>,
    resolvedCache: Map<string, string | null>,
    allowCreate: boolean,
  ): Promise<ProcessedResult> {
    try {
      // STEP A — extract from filename
      const { title: filenameTitle, isWeak } = this.extractFromFilename(file.filename);

      let finalTitle = filenameTitle;
      let ocrUsed = false;

      // STEP B — OCR fallback when filename is weak
      if (isWeak) {
        const ocrTitle = await this.runOcr(file.fullPath);
        if (ocrTitle && ocrTitle.length >= 3) {
          finalTitle = ocrTitle;
          ocrUsed = true;
        }
      }

      if (!finalTitle || finalTitle.length < 2) {
        return { filename: file.filename, finalTitle: '', ocrUsed, action: 'skipped', reason: 'empty title' };
      }

      // STEP C — publish the cover (R2 when configured, else local disk)
      const publicUrl = await this.publishCover(file);

      // STEP D — fuzzy resolve book
      const resolved = await this.resolveBook(finalTitle, storeId, bookMap, resolvedCache, allowCreate);

      if (!resolved) {
        return { filename: file.filename, finalTitle, ocrUsed, action: 'skipped', reason: 'no match' };
      }

      await this.prisma.book.update({ where: { id: resolved.bookId }, data: { imageUrl: publicUrl } });

      // If newly created, register in bookMap for subsequent images
      const normKey = normalizeArabic(finalTitle);
      if (!bookMap.has(normKey)) bookMap.set(normKey, resolved.bookId);

      return {
        filename: file.filename, finalTitle, ocrUsed,
        matchStrategy: resolved.strategy,
        action: resolved.created ? 'created' : 'updated',
      };

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Failed to process ${file.filename}: ${message}`);
      return { filename: file.filename, finalTitle: '', ocrUsed: false, action: 'error', reason: message };
    }
  }

  // ── Fuzzy book resolution ─────────────────────────────

  private async resolveBook(
    rawTitle: string,
    storeId: string,
    bookMap: Map<string, string>,
    cache: Map<string, string | null>,
    allowCreate: boolean,
  ): Promise<{ bookId: string; strategy: MatchStrategy; created: boolean } | null> {
    const normalized = normalizeArabic(rawTitle);
    const denoised = this.removeNoiseWords(normalized);

    // ── Strategy A: exact normalized match ───────────────
    const exactId = bookMap.get(normalized);
    if (exactId) return { bookId: exactId, strategy: 'exact', created: false };

    // ── Strategy B: denoised match ───────────────────────
    if (denoised !== normalized) {
      const denoisedId = bookMap.get(denoised);
      if (denoisedId) return { bookId: denoisedId, strategy: 'denoised', created: false };
    }

    // ── Strategy C: partial contains (in-memory scan) ────
    const partialId = this.partialMatch(normalized, bookMap) ??
                      this.partialMatch(denoised, bookMap);
    if (partialId) return { bookId: partialId, strategy: 'partial', created: false };

    // ── Strategy D: first 2–3 words match ────────────────
    const firstWordsId = this.firstWordsMatch(normalized, bookMap);
    if (firstWordsId) return { bookId: firstWordsId, strategy: 'firstWords', created: false };

    // ── Strategy E: DB-level contains fallback ────────────
    if (!cache.has(normalized)) {
      const dbMatch = await this.dbContainsSearch(normalized, denoised, storeId);
      cache.set(normalized, dbMatch);
      if (dbMatch) {
        bookMap.set(normalized, dbMatch); // warm the in-memory map
        return { bookId: dbMatch, strategy: 'partial', created: false };
      }
    } else if (cache.get(normalized)) {
      return { bookId: cache.get(normalized)!, strategy: 'partial', created: false };
    }

    // ── Strategy F: create book if allowed ───────────────
    if (!allowCreate) return null;

    const newBook = await this.createMinimalBook(rawTitle, normalized, storeId);
    bookMap.set(normalized, newBook.id);
    cache.set(normalized, newBook.id);
    return { bookId: newBook.id, strategy: 'created', created: true };
  }

  // ── Matching helpers ──────────────────────────────────

  /**
   * Check if any book's normalized title contains the query, or query contains book title.
   */
  private partialMatch(query: string, bookMap: Map<string, string>): string | null {
    if (query.length < 3) return null;
    for (const [key, id] of bookMap) {
      if (key.includes(query) || query.includes(key)) return id;
    }
    return null;
  }

  /**
   * Match on first 2–3 significant words (min 2 chars each).
   */
  private firstWordsMatch(normalized: string, bookMap: Map<string, string>): string | null {
    const words = normalized.split(' ').filter((w) => w.length >= 2);
    if (words.length < 2) return null;

    const prefix2 = words.slice(0, 2).join(' ');
    const prefix3 = words.length >= 3 ? words.slice(0, 3).join(' ') : null;

    for (const [key, id] of bookMap) {
      if (prefix3 && key.includes(prefix3)) return id;
      if (key.startsWith(prefix2) || key.includes(prefix2)) return id;
    }
    return null;
  }

  private async dbContainsSearch(
    normalized: string,
    denoised: string,
    storeId: string,
  ): Promise<string | null> {
    const words = denoised.split(' ').filter((w) => w.length >= 3);
    if (!words.length) return null;

    const match = await this.prisma.book.findFirst({
      where: {
        storeId,
        OR: [
          { titleNormalized: { contains: normalized } },
          { titleNormalized: { contains: denoised } },
          // word-level: at least the first significant word
          ...(words[0] ? [{ titleNormalized: { contains: words[0] } }] : []),
        ],
      },
      select: { id: true },
    });

    return match?.id ?? null;
  }

  // ── Minimal book creation ─────────────────────────────

  private async createMinimalBook(rawTitle: string, normalized: string, storeId: string) {
    // Ensure "غير مصنف" category exists
    const category = await this.prisma.category.upsert({
      where: { name: 'غير مصنف' },
      create: { name: 'غير مصنف' },
      update: {},
    });

    // Ensure "غير معروف" author exists
    const author = await this.prisma.author.upsert({
      where: { name: 'غير معروف' },
      create: { name: 'غير معروف' },
      update: {},
    });

    return this.prisma.book.create({
      data: {
        title: rawTitle,
        titleNormalized: normalized,
        storeId,
        categoryId: category.id,
        authorId: author.id,
      },
    });
  }

  // ── Title cleaning ────────────────────────────────────

  private extractFromFilename(filename: string): { title: string; isWeak: boolean } {
    const noExt = path.parse(filename).name;
    let title = noExt.replace(/[_\-]+/g, ' ').trim();
    title = this.normalizeTitleText(title);

    const hasArabic = /[\u0600-\u06FF]/.test(title);
    const isWeak =
      title.length < 3 ||
      !hasArabic ||                                        // timestamp / random / Latin filenames
      WEAK_PATTERN.test(title.replace(/\s/g, ''));

    return { title, isWeak };
  }

  /** Strip tashkeel + basic Arabic char normalization (no noise removal — keep for stored title) */
  private normalizeTitleText(text: string): string {
    return text
      .replace(/[\u064B-\u065F\u0670]/g, '')
      .replace(/[أإآ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** Remove noise words from a normalized title for matching only */
  private removeNoiseWords(normalized: string): string {
    const words = normalized.split(' ').filter((w) => !NOISE_WORDS.has(w));
    return words.join(' ').trim();
  }

  // ── OCR ────────────────────────────────────────────────

  private async runOcr(imagePath: string): Promise<string | null> {
    try {
      const worker = await createWorker('ara', 1, {
        logger: () => undefined,
      });
      const { data } = await worker.recognize(imagePath);
      await worker.terminate();
      const bestLine = this.extractBestLine(data.text ?? '');
      return bestLine ? this.normalizeTitleText(bestLine) : null;
    } catch {
      return null;
    }
  }

  private extractBestLine(rawText: string): string | null {
    const arabicRe = /[\u0600-\u06FF]/;
    const lines = rawText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length >= 3 && arabicRe.test(l));
    if (!lines.length) return null;
    lines.sort((a, b) => b.length - a.length);
    return lines[0];
  }

  // ── File helpers ──────────────────────────────────────

  private scanFolder(folder: string): ImageFile[] {
    if (!fs.existsSync(folder)) {
      this.logger.warn(`Images folder not found: ${folder}`);
      return [];
    }
    return fs
      .readdirSync(folder)
      .filter((f) => SUPPORTED_EXT.has(path.extname(f).toLowerCase()))
      .map((f) => ({
        fullPath: path.join(folder, f),
        filename: f,
        ext: path.extname(f).toLowerCase(),
      }));
  }

  private ensureStaticFolder(): void {
    if (!fs.existsSync(STATIC_FOLDER)) {
      fs.mkdirSync(STATIC_FOLDER, { recursive: true });
    }
  }

  /**
   * Publish a cover image and return the URL to store on the book.
   * Prefers R2; falls back to the local /covers/ static folder when R2 is
   * not configured (so local dev keeps working without an R2 account).
   */
  private async publishCover(file: ImageFile): Promise<string> {
    const destFilename = this.safeFilename(file.filename);

    if (this.storage.enabled) {
      const body = fs.readFileSync(file.fullPath);
      return this.storage.upload(`covers/${destFilename}`, body, this.contentType(file.ext));
    }

    const destPath = path.join(STATIC_FOLDER, destFilename);
    fs.copyFileSync(file.fullPath, destPath);
    return `/covers/${destFilename}`;
  }

  private contentType(ext: string): string {
    switch (ext.toLowerCase()) {
      case '.png':
        return 'image/png';
      case '.jpg':
      case '.jpeg':
        return 'image/jpeg';
      default:
        return 'application/octet-stream';
    }
  }

  private safeFilename(original: string): string {
    const ext = path.extname(original);
    const base = path.basename(original, ext)
      .replace(/[^\w\u0600-\u06FF\-\.]/g, '_')
      .slice(0, 80);
    return `${base}${ext}`;
  }
}
