import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

// Plugins de runtime/debug da plataforma Manus (manus-runtime, debug-collector,
// storage-proxy) e o jsx-loc foram removidos: eram ferramentas do ambiente de
// scaffolding e injetavam um <script> inline de ~366 KB no index.html de produção,
// inviabilizando o carregamento em 3G/4G. O deploy é um SPA estático no GitHub Pages
// e não depende de nenhum deles.

export default defineConfig({
  base: process.env.NODE_ENV === "production" ? "/roteiro-policiamento/" : "/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port: 3000,
    strictPort: false,
    host: true,
    allowedHosts: ["localhost", "127.0.0.1"],
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
