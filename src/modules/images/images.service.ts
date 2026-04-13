import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { normalizeArabic } from '../../common/utils/normalize-arabic';

// ── Types ──────────────────────────────────────────────

interface GoogleVolume {
  volumeInfo?: {
    imageLinks?: {
      thumbnail?: string;
      smallThumbnail?: string;
    };
  };
}

interface GoogleBooksResponse {
  totalItems: number;
  items?: GoogleVolume[];
}

interface OpenLibraryDoc {
  cover_i?: number;
}

interface OpenLibraryResponse {
  numFound: number;
  docs?: OpenLibraryDoc[];
}

export interface FillResult {
  processed: number;
  updated: number;
  failed: number;
}

// ── Constants ──────────────────────────────────────────

const BATCH_SIZE = 20;
const DELAY_MS = 300;
const REQUEST_TIMEOUT = 10000;

@Injectable()
export class ImagesService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Public API ──────────────────────────────────────

  async fillMissingImages(storeSlug: string): Promise<FillResult> {
    const store = await this.resolveStore(storeSlug);
    return this.assignMissingImages(store.id);
  }

  // ── Core Pipeline ───────────────────────────────────

  private async assignMissingImages(storeId: string): Promise<FillResult> {
    const books = await this.prisma.book.findMany({
      where: { storeId, imageUrl: null },
      select: { id: true, title: true, author: { select: { name: true } } },
      take: BATCH_SIZE,
    });

    const result: FillResult = { processed: books.length, updated: 0, failed: 0 };

    for (const book of books) {
      const imageUrl = await this.getBookImage(book.title, book.author?.name);

      if (imageUrl) {
        await this.prisma.book.update({
          where: { id: book.id },
          data: { imageUrl },
        });
        result.updated++;
      } else {
        result.failed++;
      }

      await this.delay(DELAY_MS);
    }

    return result;
  }

  // ── Image Resolution — Multi-Strategy Pipeline ──────
  //
  // Strategy order (stops on first hit):
  //  1. Google Books — Arabic query + langRestrict=ar (title + author)
  //  2. Google Books — Arabic query, title only (broader match)
  //  3. Google Books — intitle: prefix (Latin-friendly fallback)
  //  4. OpenLibrary  — title + author
  //  5. OpenLibrary  — title only
  //

  async getBookImage(title: string, author?: string): Promise<string | null> {
    const rawTitle = this.stripDiacritics(title);
    const cleanTitle = this.cleanSearchQuery(title);
    const cleanAuthor = author ? this.cleanSearchQuery(author) : undefined;

    return (
      // 1. Google Books — plain Arabic query with author
      (await this.searchGoogleBooksArabic(rawTitle, author)) ??
      // 2. Google Books — plain Arabic title only (wider net)
      (await this.searchGoogleBooksArabic(rawTitle)) ??
      // 3. Google Books — intitle: prefix (legacy, works for some)
      (await this.searchGoogleBooksIntitle(cleanTitle, cleanAuthor)) ??
      // 4. OpenLibrary — title + author
      (await this.searchOpenLibrary(cleanTitle, cleanAuthor)) ??
      // 5. OpenLibrary — title only
      (cleanAuthor ? await this.searchOpenLibrary(cleanTitle) : null)
    );
  }

  // ── Google Books — Arabic plain query (best for Arabic) ──

  private async searchGoogleBooksArabic(title: string, author?: string): Promise<string | null> {
    try {
      let q = title;
      if (author) q += ` ${author}`;

      const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&langRestrict=ar&maxResults=3&fields=items(volumeInfo/imageLinks)`;

      const response = await this.fetchJson<GoogleBooksResponse>(url);
      return this.extractGoogleThumbnail(response);
    } catch {
      return null;
    }
  }

  // ── Google Books — intitle: prefix (Latin fallback) ──────

  private async searchGoogleBooksIntitle(title: string, author?: string): Promise<string | null> {
    try {
      let q = `intitle:${title}`;
      if (author) q += `+inauthor:${author}`;

      const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=1&fields=items(volumeInfo/imageLinks)`;

      const response = await this.fetchJson<GoogleBooksResponse>(url);
      return this.extractGoogleThumbnail(response);
    } catch {
      return null;
    }
  }

  private extractGoogleThumbnail(response: GoogleBooksResponse | null): string | null {
    if (!response?.items?.length) return null;

    // Try all results for one with an image
    for (const item of response.items) {
      const links = item.volumeInfo?.imageLinks;
      const thumbnail = links?.thumbnail ?? links?.smallThumbnail;
      if (thumbnail) {
        // Upgrade to higher quality (zoom=2) and force HTTPS
        return thumbnail
          .replace(/^http:/, 'https:')
          .replace(/zoom=\d/, 'zoom=2');
      }
    }
    return null;
  }

  // ── OpenLibrary ──────────────────────────────────────

  private async searchOpenLibrary(title: string, author?: string): Promise<string | null> {
    try {
      const params = new URLSearchParams({ title, limit: '3', fields: 'cover_i' });
      if (author) params.set('author', author);

      const url = `https://openlibrary.org/search.json?${params}`;

      const response = await this.fetchJson<OpenLibraryResponse>(url);

      if (!response?.docs?.length) return null;

      // Find the first doc with a cover
      for (const doc of response.docs) {
        if (doc.cover_i) {
          return `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  // ── Helpers ─────────────────────────────────────────

  private async fetchJson<T>(url: string): Promise<T | null> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

      const res = await fetch(url, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' },
      });

      clearTimeout(timeout);

      if (!res.ok) return null;

      return (await res.json()) as T;
    } catch {
      return null;
    }
  }

  /** Remove Arabic diacritics/tashkeel but keep the original letters (no normalization) */
  private stripDiacritics(text: string): string {
    return text
      .replace(/[\u064B-\u065F\u0670]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** Full normalization for search (hamza, ta marbuta, etc) */
  private cleanSearchQuery(text: string): string {
    return normalizeArabic(text)
      .replace(/[^\p{L}\p{N}\s]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private async resolveStore(slug: string) {
    const store = await this.prisma.store.findUnique({ where: { slug } });
    if (!store) throw new NotFoundException('Store not found');
    return store;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
