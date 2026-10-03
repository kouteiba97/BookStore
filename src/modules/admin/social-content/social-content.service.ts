import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { StoreResolver } from '../../../common/tenant/store-resolver.service';
import { normalizeArabic } from '../../../common/utils/normalize-arabic';
import { loadImage, type LoadedImage } from '../../../common/utils/image-source';
import { safeEntryName, ZipWriter, type ZipSink } from '../../../common/utils/zip-writer';
import { ExportSocialContentDto, MAX_EXPORT_BOOKS, SocialFilterDto } from './social-content.dto';
import { buildSocialMetadata, metadataText } from './social-post';

// ── Limits ─────────────────────────────────────────────────

/** Exports running at once across the server; more get a 429. */
const MAX_CONCURRENT_EXPORTS = 2;
/** Pictures being downloaded at once within one export. */
const FETCH_WINDOW = 4;
/** One picture. Covers are well under 1 MB; anything this big is not a cover. */
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
/** Whole archive. Past this, remaining books are exported without pictures. */
const MAX_ARCHIVE_BYTES = 500 * 1024 * 1024;
const IMAGE_TIMEOUT_MS = 15_000;
/** Pictures per book when the gallery is included. */
const MAX_PICTURES_PER_BOOK = 20;

// ── Shapes ─────────────────────────────────────────────────

/** One row of the content browser — a deliberately small, explicit shape. */
export interface SocialBookRow {
  id: string;
  title: string;
  authors: string[];
  publishers: string[];
  category: string | null;
  price: number | null;
  year: number | null;
  status: string | null;
  cover: string | null;
  pictures: number;
}

const exportSelect = {
  id: true,
  title: true,
  description: true,
  notes: true,
  year: true,
  price: true,
  imageUrl: true,
  category: { select: { name: true } },
  inventory: { select: { status: true } },
  authors: { select: { author: { select: { name: true } } }, orderBy: { position: 'asc' } },
  publishers: { select: { publisher: { select: { name: true } } }, orderBy: { position: 'asc' } },
  images: { select: { url: true }, orderBy: { position: 'asc' } },
} satisfies Prisma.BookSelect;

type ExportBook = Prisma.BookGetPayload<{ select: typeof exportSelect }>;

export interface ExportPlan {
  books: ExportBook[];
  storeName: string;
  includeGallery: boolean;
  /** Ids sent that are not books of this store (deleted, or foreign). */
  skipped: number;
  /** Books matching the filter beyond MAX_EXPORT_BOOKS. */
  truncated: number;
  release: () => void;
}

@Injectable()
export class SocialContentService {
  private readonly logger = new Logger(SocialContentService.name);
  private active = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly stores: StoreResolver,
  ) {}

  // ── Browse ───────────────────────────────────────────────

  async list(filter: SocialFilterDto, page: number, pageSize: number) {
    const storeId = await this.stores.getStoreId();
    const where = this.where(storeId, filter);

    const [rows, total] = await Promise.all([
      this.prisma.book.findMany({
        where,
        select: {
          id: true,
          title: true,
          year: true,
          price: true,
          imageUrl: true,
          category: { select: { name: true } },
          inventory: { select: { status: true } },
          authors: { select: { author: { select: { name: true } } }, orderBy: { position: 'asc' } },
          publishers: { select: { publisher: { select: { name: true } } }, orderBy: { position: 'asc' } },
          _count: { select: { images: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.book.count({ where }),
    ]);

    const items: SocialBookRow[] = rows.map((b) => ({
      id: b.id,
      title: b.title,
      authors: b.authors.map((a) => a.author.name),
      publishers: b.publishers.map((p) => p.publisher.name),
      category: b.category?.name ?? null,
      price: b.price == null ? null : Number(b.price),
      year: b.year,
      status: b.inventory?.status ?? null,
      cover: b.imageUrl,
      pictures: Math.max(b._count.images, b.imageUrl ? 1 : 0),
    }));

    return { items, total, page, pageSize, maxExport: MAX_EXPORT_BOOKS };
  }

  // ── Export ───────────────────────────────────────────────

  /**
   * Validate the request and load the books, before any byte is sent — so
   * every refusal is a proper HTTP error rather than a broken download.
   * Takes an export slot; the caller must call `release()`.
   */
  async plan(dto: ExportSocialContentDto): Promise<ExportPlan> {
    const hasIds = Array.isArray(dto.bookIds) && dto.bookIds.length > 0;
    if (hasIds === Boolean(dto.filter)) {
      throw new BadRequestException('Send either bookIds or filter');
    }
    if (this.active >= MAX_CONCURRENT_EXPORTS) {
      throw new HttpException(
        'Another export is being prepared. Try again in a moment.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    this.active++;
    let released = false;
    const release = () => {
      if (!released) {
        released = true;
        this.active--;
      }
    };

    try {
      const store = await this.stores.getStore();
      const storeRow = await this.prisma.store.findUnique({
        where: { id: store.id },
        select: { name: true },
      });

      let books: ExportBook[];
      let skipped = 0;
      let truncated = 0;

      if (hasIds) {
        const ids = [...new Set(dto.bookIds!)];
        // Scoped by store: an id from another store simply is not found.
        const found = await this.prisma.book.findMany({
          where: { id: { in: ids }, storeId: store.id },
          select: exportSelect,
        });
        const byId = new Map(found.map((b) => [b.id, b]));
        books = ids.map((id) => byId.get(id)).filter((b): b is ExportBook => !!b);
        skipped = ids.length - books.length;
      } else {
        const where = this.where(store.id, dto.filter!);
        const total = await this.prisma.book.count({ where });
        books = await this.prisma.book.findMany({
          where,
          select: exportSelect,
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
          take: MAX_EXPORT_BOOKS,
        });
        truncated = Math.max(0, total - books.length);
      }

      if (!books.length) throw new NotFoundException('No books to export');

      return {
        books,
        storeName: storeRow?.name ?? store.slug,
        includeGallery: dto.includeGallery === true,
        skipped,
        truncated,
        release,
      };
    } catch (err) {
      release();
      throw err;
    }
  }

  /**
   * Stream the archive. Pictures are fetched a few at a time and written in
   * order; at most FETCH_WINDOW pictures are ever held in memory.
   */
  async write(plan: ExportPlan, sink: ZipSink, signal: AbortSignal): Promise<{ bytes: number; missing: number }> {
    const started = Date.now();
    const zip = new ZipWriter(sink);
    const link = this.storefrontLink();

    // Folder per book; a repeated title gets " (2)", " (3)"…
    const used = new Map<string, number>();
    const folders = plan.books.map((b) => {
      const base = safeEntryName(b.title);
      const key = base.toLowerCase();
      const n = (used.get(key) ?? 0) + 1;
      used.set(key, n);
      return n === 1 ? base : `${base} (${n})`;
    });

    // Every picture to fetch, in output order.
    const jobs: { book: number; url: string }[] = [];
    plan.books.forEach((b, i) => {
      for (const url of this.pictureUrls(b, plan.includeGallery)) jobs.push({ book: i, url });
    });

    const pending = new Map<number, Promise<LoadedImage | null>>();
    let started_ = 0;
    let budgetExceeded = false;
    const start = (j: number) => {
      // Once the archive is full there is no point downloading more.
      pending.set(
        j,
        budgetExceeded
          ? Promise.resolve(null)
          : loadImage(jobs[j].url, { maxBytes: MAX_IMAGE_BYTES, timeoutMs: IMAGE_TIMEOUT_MS, signal }),
      );
    };

    let job = 0;
    let missingTotal = 0;
    const csv: string[][] = [];

    for (let i = 0; i < plan.books.length; i++) {
      if (signal.aborted) throw new Error('Export aborted');
      const book = plan.books[i];
      const names: string[] = [];
      let missing = 0;

      for (; job < jobs.length && jobs[job].book === i; job++) {
        while (started_ < jobs.length && started_ < job + FETCH_WINDOW) start(started_++);
        const img = await pending.get(job)!;
        pending.delete(job);

        if (img && !budgetExceeded && zip.size + img.data.length > MAX_ARCHIVE_BYTES) {
          budgetExceeded = true;
        }
        if (!img || budgetExceeded) {
          missing++;
          continue;
        }
        const name = names.length === 0 ? `cover${img.ext}` : `image-${names.length + 1}${img.ext}`;
        await zip.add(`${folders[i]}/${name}`, img.data);
        names.push(name);
      }

      const meta = buildSocialMetadata(
        {
          title: book.title,
          description: book.description,
          notes: book.notes,
          year: book.year,
          price: book.price,
          category: book.category,
          authors: book.authors.map((a) => a.author),
          publishers: book.publishers.map((p) => p.publisher),
          inventory: book.inventory,
        },
        { storeName: plan.storeName, link: link ? `${link}/books/${book.id}` : null, images: names, missingImages: missing },
      );
      await zip.add(`${folders[i]}/metadata.json`, Buffer.from(JSON.stringify(meta, null, 2) + '\n', 'utf8'));
      await zip.add(`${folders[i]}/metadata.txt`, Buffer.from(metadataText(meta), 'utf8'));
      missingTotal += missing;

      csv.push([
        folders[i],
        meta.title,
        meta.authors.join('، '),
        meta.publishers.join('، '),
        meta.category ?? '',
        meta.year?.toString() ?? '',
        meta.price ? String(meta.price.amount) : '',
        meta.availability?.label ?? '',
        String(names.length),
      ]);
    }

    // A spreadsheet of the whole export — handy for planning a week of posts.
    const header = ['المجلد', 'العنوان', 'المؤلف', 'دار النشر', 'التصنيف', 'السنة', 'السعر (دج)', 'التوفر', 'عدد الصور'];
    const csvText = [header, ...csv].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
    await zip.add('index.csv', Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(csvText, 'utf8')]));

    await zip.finish();
    this.logger.log(
      `Export: ${plan.books.length} books, ${zip.entries} files, ${(zip.size / 1048576).toFixed(1)} MB, ` +
        `${missingTotal} pictures missing, ${Date.now() - started} ms`,
    );
    return { bytes: zip.size, missing: missingTotal };
  }

  // ── Helpers ──────────────────────────────────────────────

  private where(storeId: string, f: SocialFilterDto): Prisma.BookWhereInput {
    const q = f.search?.trim();
    return {
      storeId,
      ...(f.categoryId ? { categoryId: f.categoryId } : {}),
      ...(f.publisherId ? { publishers: { some: { publisherId: f.publisherId } } } : {}),
      ...(f.status ? { inventory: { is: { status: f.status } } } : {}),
      ...(q
        ? {
            OR: [
              { titleNormalized: { contains: normalizeArabic(q), mode: 'insensitive' } },
              { title: { contains: q, mode: 'insensitive' } },
              { authors: { some: { author: { name: { contains: q, mode: 'insensitive' } } } } },
            ],
          }
        : {}),
    };
  }

  private pictureUrls(book: ExportBook, includeGallery: boolean): string[] {
    const gallery = book.images.map((i) => i.url).filter(Boolean);
    const all = gallery.length ? gallery : book.imageUrl ? [book.imageUrl] : [];
    return includeGallery ? all.slice(0, MAX_PICTURES_PER_BOOK) : all.slice(0, 1);
  }

  /** Public storefront origin, when configured, for a link back to each book. */
  private storefrontLink(): string | null {
    const raw = process.env.STOREFRONT_URL?.trim().replace(/\/+$/, '');
    return raw && /^https?:\/\//.test(raw) ? raw : null;
  }
}

/** CSV cell, quoted; a leading = + - @ is neutralised so Excel never runs it. */
function csvCell(value: string): string {
  const v = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${v.replace(/"/g, '""')}"`;
}
