import path from "path"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

// The admin app is served under "/admin" (path-based behind a reverse proxy,
// e.g. bayan.com/admin — or a subdomain that also serves it at /admin).
export default defineConfig({
  base: "/admin/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5175,
    // Talk to the same NestJS backend as the public site.
    proxy: {
      "/api": "http://localhost:3000",
    },
  },
})
