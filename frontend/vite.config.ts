import path from "path"
import { defineConfig, type Plugin } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

/** Where the storefront is served from. Overridden per deploy via SITE_URL. */
const SITE_URL = (process.env.SITE_URL ?? "https://bookstore-storefront.onrender.com").replace(/\/$/, "")

const TITLE = "مكتبة البيان — كتب شرعية وعلوم إسلامية"
const DESCRIPTION =
  "مكتبة متخصصة في الكتب الشرعية والعلوم الإسلامية والمراجع الأكاديمية. توصيل إلى 58 ولاية والدفع عند الاستلام."

/**
 * Injects the social-preview and canonical tags at build time, so the absolute
 * URLs they require follow SITE_URL instead of being hardcoded in index.html
 * and going stale the moment the domain changes.
 */
function socialMeta(): Plugin {
  return {
    name: "social-meta",
    transformIndexHtml() {
      return [
        // Security policy shipped in the document itself.
        //
        // render.yaml also sets these as real HTTP headers, but that only takes
        // effect on a Blueprint sync. Delivering the policy here means the
        // protection travels with the build and cannot silently be missing.
        // `frame-ancestors` is deliberately absent: it is ignored in a meta
        // policy, so clickjacking cover comes from the header form only.
        {
          tag: "meta",
          attrs: {
            "http-equiv": "Content-Security-Policy",
            content:
              "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https:; base-uri 'self'; form-action 'self'",
          },
          injectTo: "head-prepend",
        },
        { tag: "meta", attrs: { name: "referrer", content: "strict-origin-when-cross-origin" }, injectTo: "head" },
        { tag: "link", attrs: { rel: "canonical", href: SITE_URL + "/" }, injectTo: "head" },
        { tag: "meta", attrs: { property: "og:type", content: "website" }, injectTo: "head" },
        { tag: "meta", attrs: { property: "og:site_name", content: "مكتبة البيان" }, injectTo: "head" },
        { tag: "meta", attrs: { property: "og:locale", content: "ar_DZ" }, injectTo: "head" },
        { tag: "meta", attrs: { property: "og:title", content: TITLE }, injectTo: "head" },
        { tag: "meta", attrs: { property: "og:description", content: DESCRIPTION }, injectTo: "head" },
        { tag: "meta", attrs: { property: "og:url", content: SITE_URL + "/" }, injectTo: "head" },
        { tag: "meta", attrs: { property: "og:image", content: SITE_URL + "/og-image.png" }, injectTo: "head" },
        { tag: "meta", attrs: { property: "og:image:width", content: "1200" }, injectTo: "head" },
        { tag: "meta", attrs: { property: "og:image:height", content: "630" }, injectTo: "head" },
        { tag: "meta", attrs: { property: "og:image:alt", content: "مكتبة البيان" }, injectTo: "head" },
        { tag: "meta", attrs: { name: "twitter:card", content: "summary_large_image" }, injectTo: "head" },
        { tag: "meta", attrs: { name: "twitter:title", content: TITLE }, injectTo: "head" },
        { tag: "meta", attrs: { name: "twitter:description", content: DESCRIPTION }, injectTo: "head" },
        { tag: "meta", attrs: { name: "twitter:image", content: SITE_URL + "/og-image.png" }, injectTo: "head" },
      ]
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), socialMeta()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      "/api": "http://localhost:3000",
    },
  },
})
