/**
 * Shared shape + serializer for book reads.
 *
 * A book now has many authors and many publishers, and can be attached to the
 * academic tree at speciality, year or subject level. To avoid breaking clients
 * written against the old single-value model (the Flutter apps, older cached
 * frontends), the serializer emits BOTH:
 *   - `authors` / `publishers` — full ordered arrays (the real model)
 *   - `author`  / `publisher`  — the primary one, or null (back-compat)
 */

/** Relation include used by every read path so responses stay consistent. */
export const bookInclude = {
  inventory: true,
  category: true,
  country: true,
  authors: { include: { author: true }, orderBy: { position: 'asc' } },
  publishers: { include: { publisher: true }, orderBy: { position: 'asc' } },
  fields: { include: { field: true } },
  years: { include: { year: { include: { field: true } } } },
  subjects: { include: { subject: { include: { year: { include: { field: true } } } } } },
} as const;

type Named = { id: string; name: string };

export function serializeBook(book: any): any {
  if (!book) return book;

  const authors: Named[] = (book.authors ?? []).map((r: any) => r.author).filter(Boolean);
  const publishers: Named[] = (book.publishers ?? []).map((r: any) => r.publisher).filter(Boolean);

  return {
    ...book,
    authors,
    publishers,
    // Back-compat singulars — the primary (first) entry.
    author: authors[0] ?? null,
    publisher: publishers[0] ?? null,
    // Academic placement, flattened for the client.
    fields: (book.fields ?? []).map((r: any) => r.field).filter(Boolean),
    years: (book.years ?? []).map((r: any) => r.year).filter(Boolean),
    subjects: (book.subjects ?? []).map((r: any) => r.subject).filter(Boolean),
  };
}

export function serializeBooks(books: any[]): any[] {
  return (books ?? []).map(serializeBook);
}
