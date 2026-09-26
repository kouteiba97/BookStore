/**
 * Edition switch — one codebase, two products.
 *
 * - "basic" (default): the build for مكتبة البيان. Customers search by title,
 *   so the academic browse (fields → years → subjects) is hidden.
 * - "full": every feature, for the version of the platform sold to other stores.
 *
 * Hidden features stay in the code and the database; they are only left out of
 * the UI. Set VITE_EDITION=full at build time to bring them back.
 */
const EDITION = (import.meta.env.VITE_EDITION as string | undefined) ?? "basic";

export const features = {
  academic: EDITION === "full",
};
