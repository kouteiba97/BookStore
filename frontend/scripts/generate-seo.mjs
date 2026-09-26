/**
 * Writes public/robots.txt and public/sitemap.xml before the Vite build.
 *
 * Generated rather than committed so the URLs follow SITE_URL — when a real
 * domain replaces the onrender.com address, nothing here needs editing.
 *
 * Book pages are the pages worth indexing, so we try to list them. The API
 * sleeps on the free tier, so the fetch is best-effort with a short timeout:
 * a sleeping API produces a smaller sitemap, never a failed deploy.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(here, "../public");

const SITE = (process.env.SITE_URL ?? "https://bookstore-storefront.onrender.com").replace(/\/$/, "");
const API = (process.env.VITE_API_URL ?? "").replace(/\/$/, "");
const SLUG = process.env.VITE_STORE_SLUG ?? "elbayan";
// Mirrors src/lib/features.ts: the academic section only exists in the full edition.
const ACADEMIC = (process.env.VITE_EDITION ?? "basic") === "full";

const STATIC_ROUTES = [
  { path: "/", priority: "1.0", changefreq: "daily" },
  { path: "/search", priority: "0.5", changefreq: "weekly" },
  ...(ACADEMIC ? [{ path: "/academic", priority: "0.8", changefreq: "weekly" }] : []),
  { path: "/privacy", priority: "0.3", changefreq: "yearly" },
  { path: "/terms", priority: "0.3", changefreq: "yearly" },
];

async function fetchBooks() {
  if (!API) return [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(`${API}/api/v1/${SLUG}/books`, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const books = await res.json();
    return Array.isArray(books) ? books : [];
  } catch (err) {
    console.warn(`[seo] book list unavailable (${err.message}); sitemap will list static pages only.`);
    return [];
  } finally {
    clearTimeout(timer);
  }
}

const xmlEscape = (s) =>
  String(s).replace(/[<>&'"]/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]),
  );

const books = await fetchBooks();
const today = new Date().toISOString().slice(0, 10);

const urls = [
  ...STATIC_ROUTES.map((r) => ({ loc: SITE + r.path, priority: r.priority, changefreq: r.changefreq })),
  ...books.map((b) => ({
    loc: `${SITE}/books/${b.id}`,
    priority: "0.7",
    changefreq: "weekly",
  })),
];

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${xmlEscape(u.loc)}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`,
  )
  .join("\n")}
</urlset>
`;

const robots = `# مكتبة البيان
User-agent: *
Allow: /

# Nothing sensitive lives on this origin, but there is no value in indexing
# a search results page.
Disallow: /search?

Sitemap: ${SITE}/sitemap.xml
`;

mkdirSync(publicDir, { recursive: true });
writeFileSync(resolve(publicDir, "sitemap.xml"), sitemap, "utf8");
writeFileSync(resolve(publicDir, "robots.txt"), robots, "utf8");

console.log(`[seo] wrote sitemap.xml (${urls.length} urls: ${STATIC_ROUTES.length} static + ${books.length} books) and robots.txt for ${SITE}`);
