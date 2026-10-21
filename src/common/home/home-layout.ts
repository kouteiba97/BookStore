/**
 * The storefront home page, below the search hero (which is fixed), is a list
 * of `HomeSection` rows the admin orders, hides and renames. Built-in blocks
 * render data the storefront already fetches; "books" sections are shelves of
 * hand-picked books (e.g. «جديد معرض الكتاب 2026»).
 */
export const BUILTIN_KINDS = ['categories', 'academic', 'latest', 'popular', 'request'] as const;
export type BuiltinKind = (typeof BUILTIN_KINDS)[number];

export const SHELF_KIND = 'books';

/** How many shelf books the home page shows; the rest are behind «عرض الكل». */
export const HOME_SHELF_LIMIT = 8;

/** A shelf holds at most this many books. */
export const MAX_SHELF_BOOKS = 500;

export function isBuiltin(kind: string): kind is BuiltinKind {
  return (BUILTIN_KINDS as readonly string[]).includes(kind);
}
