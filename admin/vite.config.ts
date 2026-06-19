import path from "path"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

// The admin app is served under "/admin" (path-based behind a reverse proxy,
// e.g. bayan.com/admin). When deploying to a dedicated host that serves the
// build at its domain root (e.g. a Render static site), set VITE_BASE_PATH=/
// so asset URLs resolve.
export default defineConfig({
  base: process.env.VITE_BASE_PATH || "/admin/",
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
