/**
 * Serves the production build with the exact headers render.yaml applies, so
 * the Content-Security-Policy can be verified before it reaches customers.
 * Development aid only — Render serves the real thing.
 */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const dist = resolve(dirname(fileURLToPath(import.meta.url)), "../dist");
const PORT = Number(process.env.PORT ?? 4180);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

const HEADERS = {
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "SAMEORIGIN",
  "Permissions-Policy": "geolocation=(), microphone=(), camera=(), interest-cohort=()",
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
};

createServer(async (req, res) => {
  const url = decodeURIComponent((req.url ?? "/").split("?")[0]);

  // Never rewrite API paths to index.html: that would hand the app an HTML
  // page where it expects JSON, which is not how the real deployment behaves.
  if (url.startsWith("/api/")) {
    res.writeHead(502, { ...HEADERS, "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "no API in the static preview" }));
    return;
  }

  let file = resolve(dist, "." + url);

  try {
    const s = await stat(file);
    if (s.isDirectory()) file = resolve(file, "index.html");
  } catch {
    file = resolve(dist, "index.html"); // SPA rewrite, same as Render
  }

  try {
    const body = await readFile(file);
    res.writeHead(200, {
      ...HEADERS,
      "Content-Type": TYPES[extname(file)] ?? "application/octet-stream",
    });
    res.end(body);
  } catch {
    res.writeHead(404, HEADERS);
    res.end("not found");
  }
}).listen(PORT, () => console.log(`serving dist with production headers on http://localhost:${PORT}`));
