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
const DELAY_MS = 250;
const REQUEST_TIMEOUT = 8000;

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

  // ── Image Resolution (Google → OpenLibrary) ─────────

  async getBookImage(title: string, author?: string): Promise<string | null> {
    const cleanTitle = this.cleanSearchQuery(title);
    const cleanAuthor = author ? this.cleanSearchQuery(author) : undefined;

    return (
      (await this.searchGoogleBooks(cleanTitle, cleanAuthor)) ??
      (await this.searchOpenLibrary(cleanTitle, cleanAuthor))
    );
  }

  private async searchGoogleBooks(title: string, author?: string): Promise<string | null> {
    try {
      let q = `intitle:${title}`;
      if (author) q += `+inauthor:${author}`;

      const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=1&fields=totalItems,items(volumeInfo/imageLinks)`;

      const response = await this.fetchJson<GoogleBooksResponse>(url);

      if (!response?.items?.length) return null;

      const links = response.items[0].volumeInfo?.imageLinks;
      const thumbnail = links?.thumbnail ?? links?.smallThumbnail;

      if (!thumbnail) return null;

      return thumbnail.replace(/^http:/, 'https:');
    } catch {
      return null;
    }
  }

  private async searchOpenLibrary(title: string, author?: string): Promise<string | null> {
    try {
      const params = new URLSearchParams({ title, limit: '1', fields: 'cover_i' });
      if (author) params.set('author', author);

      const url = `https://openlibrary.org/search.json?${params}`;

      const response = await this.fetchJson<OpenLibraryResponse>(url);

      if (!response?.docs?.length) return null;

      const coverId = response.docs[0].cover_i;
      if (!coverId) return null;

      return `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`;
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
