/**
 * What one exported book says about itself, for social-media posts.
 *
 * Pure mapping from stored data — nothing is invented: a field the book does
 * not have is null/absent, never guessed. Internal data (ids, store ids, stock
 * counts, timestamps) is deliberately left out.
 *
 * This is the single place to extend when captions arrive: e.g. add
 * `captions: { instagram, facebook, tiktok, whatsapp }` built from these same
 * fields, and the export writes them alongside metadata.json.
 */
export interface SocialBookSource {
  title: string;
  description: string | null;
  notes: string | null;
  year: number | null;
  price: { toString(): string } | null;
  category: { name: string } | null;
  authors: { name: string }[];
  publishers: { name: string }[];
  inventory: { status: string } | null;
}

export interface SocialPostMetadata {
  schemaVersion: 1;
  title: string;
  authors: string[];
  publishers: string[];
  category: string | null;
  year: number | null;
  price: { amount: number; currency: 'DZD'; formatted: string } | null;
  availability: { code: string; label: string } | null;
  store: { name: string; link: string | null };
  description: string | null;
  /** "معلومات إضافية": edition, volumes, binding… as the store wrote it. */
  details: string | null;
  /** File names of the pictures in this folder, cover first. */
  images: string[];
  /** Pictures the book has that could not be included (unreachable, not an image…). */
  missingImages: number;
}

export const AVAILABILITY_LABELS: Record<string, string> = {
  available: 'متوفر',
  on_request: 'حسب الطلب',
  rare: 'نادر',
};

export function buildSocialMetadata(
  book: SocialBookSource,
  ctx: { storeName: string; link: string | null; images: string[]; missingImages: number },
): SocialPostMetadata {
  const amount = book.price == null ? null : Number(book.price.toString());
  const status = book.inventory?.status ?? null;
  return {
    schemaVersion: 1,
    title: book.title,
    authors: book.authors.map((a) => a.name),
    publishers: book.publishers.map((p) => p.name),
    category: book.category?.name ?? null,
    year: book.year ?? null,
    price:
      amount != null && Number.isFinite(amount)
        ? { amount, currency: 'DZD', formatted: `${amount.toLocaleString('en-US')} دج` }
        : null,
    availability: status ? { code: status, label: AVAILABILITY_LABELS[status] ?? status } : null,
    store: { name: ctx.storeName, link: ctx.link },
    description: book.description?.trim() || null,
    details: book.notes?.trim() || null,
    images: ctx.images,
    missingImages: ctx.missingImages,
  };
}

/** The same facts as readable Arabic text, ready to copy into a post. */
export function metadataText(m: SocialPostMetadata): string {
  const lines: string[] = [`📚 ${m.title}`];
  if (m.authors.length) lines.push(`✍️ ${m.authors.length > 1 ? 'المؤلفون' : 'المؤلف'}: ${m.authors.join('، ')}`);
  if (m.publishers.length) lines.push(`🏛️ ${m.publishers.length > 1 ? 'دور النشر' : 'دار النشر'}: ${m.publishers.join('، ')}`);
  if (m.category) lines.push(`🗂️ التصنيف: ${m.category}`);
  if (m.year) lines.push(`📅 سنة النشر: ${m.year}`);
  if (m.details) lines.push(`ℹ️ ${m.details}`);
  if (m.price) lines.push(`💰 السعر: ${m.price.formatted}`);
  if (m.availability) lines.push(`📦 ${m.availability.label}`);
  if (m.description) lines.push('', m.description);
  lines.push('', `— ${m.store.name}`);
  if (m.store.link) lines.push(m.store.link);
  return lines.join('\n') + '\n';
}
