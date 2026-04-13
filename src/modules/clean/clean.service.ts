import { Injectable } from '@nestjs/common';
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

async function isImageUrlValid(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, { method: 'HEAD', signal: controller.signal });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

// ── Service ────────────────────────────────────────────

@Injectable()
export class CleanService {
  constructor(private readonly prisma: PrismaService) {}

  async cleanDatabase(): Promise<CleanReport> {
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
    await this.cleanBooks(report);
    await this.removeDuplicateBooks(report);
    await this.validateImages(report);

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
        await this.prisma.book.updateMany({
          where: { authorId: aliasAuthor.id },
          data: { authorId: canonicalAuthor.id },
        });

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
        await this.prisma.book.updateMany({
          where: { authorId: author.id },
          data: { authorId: keepId },
        });
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

        await this.prisma.book.updateMany({
          where: { publisherId: aliasPub.id },
          data: { publisherId: canonicalPub.id },
        });
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
        await this.prisma.book.updateMany({
          where: { publisherId: pub.id },
          data: { publisherId: keepId },
        });
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
    // Ensure all canonical categories exist
    const canonicalMap = new Map<string, string>(); // name → id
    for (const name of CANONICAL_CATEGORIES) {
      const cat = await this.prisma.category.upsert({
        where: { name },
        create: { name },
        update: {},
      });
      canonicalMap.set(name, cat.id);
    }

    const allCategories = await this.prisma.category.findMany();

    for (const cat of allCategories) {
      // Already canonical
      if (CANONICAL_CATEGORIES.includes(cat.name)) continue;

      const targetName = CATEGORY_MAP[cat.name] ?? CATEGORY_MAP[normalizeArabic(cat.name)];
      if (!targetName) continue;

      const targetId = canonicalMap.get(targetName)!;

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

  private async cleanBooks(report: CleanReport): Promise<void> {
    const books = await this.prisma.book.findMany({
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

  // ── 5. Remove duplicate books ────────────────────────

  private async removeDuplicateBooks(report: CleanReport): Promise<void> {
    const books = await this.prisma.book.findMany({
      select: { id: true, titleNormalized: true, authorId: true, storeId: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const seen = new Map<string, string>(); // dedupeKey → id to keep

    for (const book of books) {
      if (!book.titleNormalized) continue;
      const key = `${book.storeId}::${book.titleNormalized}::${book.authorId ?? 'null'}`;

      if (seen.has(key)) {
        // Delete duplicate (keep the older one)
        await this.prisma.inventory.deleteMany({ where: { bookId: book.id } });
        await this.prisma.bookOnSubject.deleteMany({ where: { bookId: book.id } });
        await this.prisma.book.delete({ where: { id: book.id } });
        report.duplicatesRemoved++;
      } else {
        seen.set(key, book.id);
      }
    }
  }

  // ── 6. Validate images ───────────────────────────────

  private async validateImages(report: CleanReport): Promise<void> {
    const books = await this.prisma.book.findMany({
      where: { imageUrl: { not: null } },
      select: { id: true, imageUrl: true },
    });

    // Check in batches of 10
    const BATCH = 10;
    for (let i = 0; i < books.length; i += BATCH) {
      const batch = books.slice(i, i + BATCH);

      await Promise.all(
        batch.map(async (book) => {
          const url = book.imageUrl!;
          const valid = await isImageUrlValid(url);
          if (!valid) {
            await this.prisma.book.update({
              where: { id: book.id },
              data: { imageUrl: null },
            });
            report.invalidImagesCleared++;
          }
        }),
      );
    }
  }
}
