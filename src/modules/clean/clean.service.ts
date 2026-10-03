import { Injectable, NotFoundException } from '@nestjs/common';
import { setBookCover } from '../../common/utils/book-cover';
import { PrismaService } from '../../prisma/prisma.service';
import { normalizeArabic } from '../../common/utils/normalize-arabic';

// ── Types ──────────────────────────────────────────────

export interface CleanReport {
  booksUpdated: number;
  duplicatesRemoved: number;
  invalidImagesCleared: number;
  authorsDeduped: number;
  categoriesRemapped: number;
  publishersDeduped: number;
}

// ── Author merge rules ─────────────────────────────────
// key = canonical name, values = aliases to merge into it

const AUTHOR_ALIASES: Record<string, string[]> = {
  'ابن القيم الجوزية': ['ابن القيم'],
  'ابن تيمية': ['شيخ الإسلام ابن تيمية', 'أحمد بن تيمية'],
  'ابن كثير': ['الحافظ ابن كثير', 'إسماعيل بن كثير'],
  'الإمام النووي': ['النووي', 'يحيى النووي'],
  'ابن حجر العسقلاني': ['ابن حجر', 'الحافظ ابن حجر'],
  'الإمام البخاري': ['البخاري', 'محمد بن إسماعيل البخاري'],
  'الإمام مسلم': ['مسلم', 'مسلم بن الحجاج'],
};

// ── Category normalization map ─────────────────────────
// Maps any variant to one of the canonical 7 categories

const CATEGORY_MAP: Record<string, string> = {
  // فقه
  'فقه': 'فقه',
  'فقه وأصوله': 'فقه',
  'أصول الفقه': 'فقه',
  'الفقه': 'فقه',
  // حديث
  'حديث': 'حديث',
  'الحديث وعلومه': 'حديث',
  'علوم الحديث': 'حديث',
  'الحديث': 'حديث',
  // تفسير
  'تفسير': 'تفسير',
  'التفسير وعلوم القرآن': 'تفسير',
  'علوم القرآن': 'تفسير',
  'قرآن': 'تفسير',
  'القرآن': 'تفسير',
  // عقيدة
  'عقيدة': 'عقيدة',
  'العقيدة': 'عقيدة',
  'أصول الدين': 'عقيدة',
  'توحيد': 'عقيدة',
  // تاريخ
  'تاريخ': 'تاريخ',
  'التاريخ': 'تاريخ',
  'السيرة النبوية': 'تاريخ',
  'سيرة': 'تاريخ',
  // لغة عربية
  'لغة عربية': 'لغة عربية',
  'اللغة العربية': 'لغة عربية',
  'نحو': 'لغة عربية',
  'صرف': 'لغة عربية',
  'بلاغة': 'لغة عربية',
  // فلسفة
  'فلسفة': 'فلسفة',
  'الفلسفة': 'فلسفة',
  'منطق': 'فلسفة',
  'فكر': 'فلسفة',
  'الفكر الإسلامي': 'فلسفة',
  // تاريخ (سيرة additions)
  'السيرة': 'تاريخ',
};

const CANONICAL_CATEGORIES = ['فقه', 'حديث', 'تفسير', 'عقيدة', 'تاريخ', 'لغة عربية', 'فلسفة'];

// ── Publisher normalization ────────────────────────────

const PUBLISHER_ALIASES: Record<string, string[]> = {
  'دار الكتب العلمية': ['دار الكتب العلميه', 'دار الكتب العلمية - بيروت'],
  'دار ابن كثير': ['دار ابن كثير للطباعة', 'دار ابن كثيرة'],
  'دار السلام': ['دار السلام للطباعة', 'دار السلام - الرياض'],
  'دار الفكر': ['دار الفكر العربي', 'دار الفكر - بيروت'],
  'مؤسسة الرسالة': ['مؤسسة الرسالة ناشرون', 'الرسالة'],
};

// ── Helpers ────────────────────────────────────────────

function normalizeSpaces(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * True only when the server positively says the image is gone (404/410).
 * A timeout, a network blip or a host that refuses HEAD is NOT proof — the old
 * check treated all of those as "invalid" and erased good covers.
 */
async function isImageDefinitelyGone(url: string): Promise<boolean> {
  if (!/^https?:\/\//i.test(url)) return false; // local /covers/… paths are not checked
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, { method: 'HEAD', signal: controller.signal });
    clearTimeout(timeout);
    return res.status === 404 || res.status === 410;
  } catch {
    return false;
  }
}

// ── Service ────────────────────────────────────────────

/**
 * Data clean-up for ONE store.
 *
 * Authors, publishers and categories are shared reference tables, so merging
 * their spelling variants necessarily affects every store using them; the
 * book-level steps (titles, duplicates, images) touch only this store's books.
 */
@Injectable()
export class CleanService {
  constructor(private readonly prisma: PrismaService) {}

  async cleanDatabase(storeSlug: string): Promise<CleanReport> {
    const store = await this.prisma.store.findUnique({ where: { slug: storeSlug } });
    if (!store) throw new NotFoundException('Store not found');
    const storeId = store.id;

    const report: CleanReport = {
      booksUpdated: 0,
      duplicatesRemoved: 0,
      invalidImagesCleared: 0,
      authorsDeduped: 0,
      categoriesRemapped: 0,
      publishersDeduped: 0,
    };

    await this.dedupeAuthors(report);
    await this.dedupePublishers(report);
    await this.normalizeCategories(report);
    await this.cleanBooks(storeId, report);
    await this.removeDuplicateBooks(storeId, report);
    await this.validateImages(storeId, report);

    return report;
  }

  // ── 1. Deduplicate / merge authors ──────────────────

  private async dedupeAuthors(report: CleanReport): Promise<void> {
    for (const [canonical, aliases] of Object.entries(AUTHOR_ALIASES)) {
      // Ensure canonical author exists
      const canonicalAuthor = await this.prisma.author.upsert({
        where: { name: canonical },
        create: { name: canonical },
        update: {},
      });

      for (const alias of aliases) {
        const aliasAuthor = await this.prisma.author.findUnique({ where: { name: alias } });
        if (!aliasAuthor || aliasAuthor.id === canonicalAuthor.id) continue;

        // Re-point all books to canonical author
        await this.repointAuthor(aliasAuthor.id, canonicalAuthor.id);

        await this.prisma.author.delete({ where: { id: aliasAuthor.id } });
        report.authorsDeduped++;
      }
    }

    // Normalize author names (trim + deduplicate by normalized key)
    const authors = await this.prisma.author.findMany();
    const seen = new Map<string, string>(); // normalized → first id

    for (const author of authors) {
      const cleaned = normalizeSpaces(author.name);
      const key = normalizeArabic(cleaned);

      if (seen.has(key)) {
        const keepId = seen.get(key)!;
        await this.repointAuthor(author.id, keepId);
        await this.prisma.author.delete({ where: { id: author.id } });
        report.authorsDeduped++;
      } else {
        seen.set(key, author.id);
        if (cleaned !== author.name) {
          await this.prisma.author.update({
            where: { id: author.id },
            data: { name: cleaned },
          });
        }
      }
    }
  }

  // ── 2. Deduplicate / merge publishers ───────────────

  private async dedupePublishers(report: CleanReport): Promise<void> {
    for (const [canonical, aliases] of Object.entries(PUBLISHER_ALIASES)) {
      const canonicalPub = await this.prisma.publisher.upsert({
        where: { name: canonical },
        create: { name: canonical },
        update: {},
      });

      for (const alias of aliases) {
        const aliasPub = await this.prisma.publisher.findUnique({ where: { name: alias } });
        if (!aliasPub || aliasPub.id === canonicalPub.id) continue;

        await this.repointPublisher(aliasPub.id, canonicalPub.id);
        await this.prisma.publisher.delete({ where: { id: aliasPub.id } });
        report.publishersDeduped++;
      }
    }

    // Normalize publisher names
    const publishers = await this.prisma.publisher.findMany();
    const seen = new Map<string, string>();

    for (const pub of publishers) {
      const cleaned = normalizeSpaces(pub.name);
      const key = normalizeArabic(cleaned);

      if (seen.has(key)) {
        const keepId = seen.get(key)!;
        await this.repointPublisher(pub.id, keepId);
        await this.prisma.publisher.delete({ where: { id: pub.id } });
        report.publishersDeduped++;
      } else {
        seen.set(key, pub.id);
        if (cleaned !== pub.name) {
          await this.prisma.publisher.update({
            where: { id: pub.id },
            data: { name: cleaned },
          });
        }
      }
    }
  }

  // ── 3. Normalize categories ──────────────────────────

  private async normalizeCategories(report: CleanReport): Promise<void> {
    // Canonical categories are created only when a variant actually needs
    // merging into one — never added to a catalogue the owner has curated.
    const canonicalMap = new Map<string, string>(); // name → id
    const canonicalId = async (name: string) => {
      if (!canonicalMap.has(name)) {
        const cat = await this.prisma.category.upsert({ where: { name }, create: { name }, update: {} });
        canonicalMap.set(name, cat.id);
      }
      return canonicalMap.get(name)!;
    };

    const allCategories = await this.prisma.category.findMany();

    for (const cat of allCategories) {
      // Already canonical
      if (CANONICAL_CATEGORIES.includes(cat.name)) continue;

      const targetName = CATEGORY_MAP[cat.name] ?? CATEGORY_MAP[normalizeArabic(cat.name)];
      if (!targetName) continue;

      const targetId = await canonicalId(targetName);

      await this.prisma.book.updateMany({
        where: { categoryId: cat.id },
        data: { categoryId: targetId },
      });

      // Remove BookOnSubject references before deleting if needed
      await this.prisma.category.delete({ where: { id: cat.id } });
      report.categoriesRemapped++;
    }
  }

  // ── 4. Clean books (titles + titleNormalized) ────────

  private async cleanBooks(storeId: string, report: CleanReport): Promise<void> {
    const books = await this.prisma.book.findMany({
      where: { storeId },
      select: { id: true, title: true, titleNormalized: true },
    });

    for (const book of books) {
      const cleanTitle = normalizeSpaces(book.title);
      const normalized = normalizeArabic(cleanTitle);

      if (cleanTitle !== book.title || normalized !== book.titleNormalized) {
        await this.prisma.book.update({
          where: { id: book.id },
          data: { title: cleanTitle, titleNormalized: normalized },
        });
        report.booksUpdated++;
      }
    }
  }

  // ── Re-point helpers ─────────────────────────────────

  /**
   * Move every book link from one author to another, then let the caller delete
   * the now-orphaned author. A book already linked to BOTH would collide on the
   * (bookId, authorId) primary key, so those rows are dropped instead of moved.
   */
  private async repointAuthor(fromId: string, toId: string): Promise<void> {
    const alreadyOnTarget = await this.prisma.bookAuthor.findMany({
      where: { authorId: toId },
      select: { bookId: true },
    });
    const bookIds = alreadyOnTarget.map((r) => r.bookId);

    if (bookIds.length) {
      await this.prisma.bookAuthor.deleteMany({
        where: { authorId: fromId, bookId: { in: bookIds } },
      });
    }

    await this.prisma.bookAuthor.updateMany({
      where: { authorId: fromId },
      data: { authorId: toId },
    });
  }

  /** Publisher equivalent of {@link repointAuthor}. */
  private async repointPublisher(fromId: string, toId: string): Promise<void> {
    const alreadyOnTarget = await this.prisma.bookPublisher.findMany({
      where: { publisherId: toId },
      select: { bookId: true },
    });
    const bookIds = alreadyOnTarget.map((r) => r.bookId);

    if (bookIds.length) {
      await this.prisma.bookPublisher.deleteMany({
        where: { publisherId: fromId, bookId: { in: bookIds } },
      });
    }

    await this.prisma.bookPublisher.updateMany({
      where: { publisherId: fromId },
      data: { publisherId: toId },
    });
  }

  // ── 5. Remove duplicate books ────────────────────────

  /**
   * Removes a book only when it is indistinguishable from an older one: same
   * title, authors, publishers, year, price and notes. Books that merely share
   * a title and author are often different editions or volumes of a series and
   * are kept. A book that appears on an order is never removed.
   */
  private async removeDuplicateBooks(storeId: string, report: CleanReport): Promise<void> {
    const books = await this.prisma.book.findMany({
      where: { storeId },
      select: {
        id: true,
        titleNormalized: true,
        year: true,
        price: true,
        notes: true,
        authors: { select: { authorId: true }, orderBy: { position: 'asc' } },
        publishers: { select: { publisherId: true }, orderBy: { position: 'asc' } },
        _count: { select: { orderItems: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const seen = new Set<string>();

    for (const book of books) {
      if (!book.titleNormalized) continue;
      const key = [
        book.titleNormalized,
        book.authors.map((a) => a.authorId).join(','),
        book.publishers.map((p) => p.publisherId).join(','),
        book.year ?? '',
        book.price?.toString() ?? '',
        normalizeSpaces(book.notes ?? ''),
      ].join('::');

      if (!seen.has(key)) {
        seen.add(key);
        continue;
      }
      if (book._count.orderItems > 0) continue;

      // Cascades remove its inventory, gallery and academic links.
      await this.prisma.book.delete({ where: { id: book.id } });
      report.duplicatesRemoved++;
    }
  }

  // ── 6. Validate images ───────────────────────────────

  private async validateImages(storeId: string, report: CleanReport): Promise<void> {
    const books = await this.prisma.book.findMany({
      where: { storeId, imageUrl: { not: null } },
      select: { id: true, imageUrl: true },
    });

    // Check in batches of 10
    const BATCH = 10;
    for (let i = 0; i < books.length; i += BATCH) {
      const batch = books.slice(i, i + BATCH);

      await Promise.all(
        batch.map(async (book) => {
          if (await isImageDefinitelyGone(book.imageUrl!)) {
            await setBookCover(this.prisma, book.id, null);
            report.invalidImagesCleared++;
          }
        }),
      );
    }
  }
}
