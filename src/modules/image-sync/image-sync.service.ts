import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
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

// ── Types ─────────────────────────────────────────────────

interface ImageFile {
  fullPath: string;
  filename: string;
  ext: string;
}

interface ProcessedResult {
  filename: string;
  finalTitle: string;
  ocrUsed: boolean;
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
}

// ── Service ───────────────────────────────────────────────

@Injectable()
export class ImageSyncService {
  private readonly logger = new Logger(ImageSyncService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Public ────────────────────────────────────────────

  async syncFromFolder(storeSlug: string): Promise<SyncResult> {
    const store = await this.prisma.store.findUnique({ where: { slug: storeSlug } });
    if (!store) throw new NotFoundException(`Store not found: ${storeSlug}`);

    this.ensureStaticFolder();

    const files = this.scanFolder(IMAGES_FOLDER);
    if (files.length === 0) {
      return { totalProcessed: 0, booksMatched: 0, booksCreated: 0, imagesUpdated: 0, ocrUsedCount: 0, skipped: 0, errors: 0 };
    }

    this.logger.log(`Found ${files.length} images in ${IMAGES_FOLDER}`);

    // Title → bookId cache to avoid repeated DB hits
    const titleCache = new Map<string, string | null>(); // normalized title → bookId | null

    const result: SyncResult = {
      totalProcessed: 0,
      booksMatched: 0,
      booksCreated: 0,
      imagesUpdated: 0,
      ocrUsedCount: 0,
      skipped: 0,
      errors: 0,
    };

    // Process in batches
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      const batch = files.slice(i, i + BATCH_SIZE);
      const processed = await Promise.all(
        batch.map((f) => this.processImage(f, store.id, titleCache)),
      );

      for (const p of processed) {
        result.totalProcessed++;
        if (p.ocrUsed) result.ocrUsedCount++;
        if (p.action === 'updated') { result.booksMatched++; result.imagesUpdated++; }
        else if (p.action === 'created') { result.booksCreated++; result.imagesUpdated++; }
        else if (p.action === 'skipped') result.skipped++;
        else if (p.action === 'error') result.errors++;
      }

      this.logger.log(`Batch ${Math.floor(i / BATCH_SIZE) + 1} done — ${result.imagesUpdated} updated so far`);
    }

    this.logger.log(`Sync complete: ${JSON.stringify(result)}`);
    return result;
  }

  // ── Core per-image processing ─────────────────────────

  private async processImage(
    file: ImageFile,
    storeId: string,
    titleCache: Map<string, string | null>,
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

      const normalized = normalizeArabic(finalTitle);

      // STEP C — copy image to static folder
      const destFilename = this.safeFilename(file.filename);
      const destPath = path.join(STATIC_FOLDER, destFilename);
      fs.copyFileSync(file.fullPath, destPath);
      const publicUrl = `/covers/${destFilename}`;

      // STEP D — find or create book
      const bookId = await this.resolveBook(normalized, finalTitle, storeId, titleCache);

      if (bookId) {
        // Check if book already has a valid image
        const book = await this.prisma.book.findUnique({ where: { id: bookId }, select: { imageUrl: true } });
        if (book?.imageUrl && !book.imageUrl.startsWith('/covers/')) {
          // Has external image, skip unless it's a local one we'd prefer to override
          // We DO override external images with local photos (local is always better)
        }

        await this.prisma.book.update({ where: { id: bookId }, data: { imageUrl: publicUrl } });

        return { filename: file.filename, finalTitle, ocrUsed, action: 'updated' };
      }

      return { filename: file.filename, finalTitle, ocrUsed, action: 'skipped', reason: 'book not found' };

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Failed to process ${file.filename}: ${message}`);
      return { filename: file.filename, finalTitle: '', ocrUsed: false, action: 'error', reason: message };
    }
  }

  // ── Title resolution ───────────────────────────────────

  /**
   * Look up by normalized title (contains match) or create a minimal book.
   * Returns bookId.
   */
  private async resolveBook(
    normalized: string,
    rawTitle: string,
    storeId: string,
    cache: Map<string, string | null>,
  ): Promise<string | null> {
    if (cache.has(normalized)) return cache.get(normalized)!;

    // Try to find existing book
    const match = await this.prisma.book.findFirst({
      where: {
        storeId,
        OR: [
          { titleNormalized: { contains: normalized } },
          { titleNormalized: normalized },
          { title: { contains: rawTitle } },
        ],
      },
      select: { id: true },
    });

    if (match) {
      cache.set(normalized, match.id);
      return match.id;
    }

    cache.set(normalized, null);
    return null;
  }

  // ── Filename extraction ────────────────────────────────

  private extractFromFilename(filename: string): { title: string; isWeak: boolean } {
    const noExt = path.parse(filename).name;

    // Replace separators with space
    let title = noExt.replace(/[_\-]+/g, ' ').trim();

    // Strip diacritics, normalize Arabic chars
    title = this.normalizeTitleText(title);

    const isWeak = title.length < 3 || WEAK_PATTERN.test(title.replace(/\s/g, ''));

    return { title, isWeak };
  }

  private normalizeTitleText(text: string): string {
    return text
      .replace(/[\u064B-\u065F\u0670]/g, '')   // strip tashkeel
      .replace(/[أإآ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // ── OCR ────────────────────────────────────────────────

  private async runOcr(imagePath: string): Promise<string | null> {
    try {
      const worker = await createWorker('ara', 1, {
        logger: () => undefined, // silence progress logs
      });

      const { data } = await worker.recognize(imagePath);
      await worker.terminate();

      const text = data.text ?? '';
      const bestLine = this.extractBestLine(text);
      return bestLine ? this.normalizeTitleText(bestLine) : null;
    } catch {
      return null;
    }
  }

  /**
   * Pick the "most prominent" line — longest Arabic line as proxy for title.
   */
  private extractBestLine(rawText: string): string | null {
    const arabicLineRe = /[\u0600-\u06FF]/;
    const lines = rawText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length >= 3 && arabicLineRe.test(l));

    if (!lines.length) return null;

    // Take the longest line (titles tend to be the largest text → most characters recognized)
    lines.sort((a, b) => b.length - a.length);
    return lines[0];
  }

  // ── Helpers ────────────────────────────────────────────

  private scanFolder(folder: string): ImageFile[] {
    if (!fs.existsSync(folder)) {
      this.logger.warn(`Images folder not found: ${folder}`);
      return [];
    }

    return fs
      .readdirSync(folder)
      .filter((f) => {
        const ext = path.extname(f).toLowerCase();
        return SUPPORTED_EXT.has(ext);
      })
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

  private safeFilename(original: string): string {
    const ext = path.extname(original);
    const base = path.basename(original, ext)
      .replace(/[^\w\u0600-\u06FF\-\.]/g, '_')
      .slice(0, 80);
    return `${base}${ext}`;
  }
}
