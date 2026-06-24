// vite.config.ts — Multi-page Manifest V3 extension build.
//
// Key constraints this config solves:
//
//  1. FLAT OUTPUT — manifest.json references files at dist root:
//       "default_popup": "popup.html"
//       "service_worker": "service-worker.js"
//     With root set to the project root (not src/), Vite resolves absolute
//     paths for each entry and we rename them via entryFileNames / the
//     HTML plugin so everything lands flat.
//
//  2. NO modulePreload — Chrome extensions can't use <link rel=modulepreload>
//     (no network fetch). Disabling prevents Vite from injecting those tags.
//
//  3. STABLE NAMES — Rollup hash-suffixes chunks by default. We turn that off
//     so the service worker filename is always "service-worker.js" and
//     manifest.json never goes stale.
//
//  4. CSP — Only stylesheet CDN links (FontAwesome, Google Fonts) are used;
//     no remote JS is ever injected by Vite in production mode.

import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  // Root at the project root so absolute path inputs resolve unambiguously.
  root: resolve(__dirname),
  publicDir: resolve(__dirname, "public"),

  build: {
    outDir: resolve(__dirname, "dist"),
    emptyOutDir: true,
    target: "es2022",
    modulePreload: false,
    sourcemap: false,

    rollupOptions: {
      input: {
        // HTML pages — Vite processes these as multi-page app entries.
        // entryFileNames does NOT apply to HTML; Vite emits them as
        // "<entry-name>.html" at the output root automatically when the
        // input key matches the desired output filename.
        popup:   resolve(__dirname, "src/popup/popup.html"),
        options: resolve(__dirname, "src/options/options.html"),

        // Pure JS entries — service worker + content script.
        "service-worker": resolve(__dirname, "src/background/service-worker.ts"),
        content:          resolve(__dirname, "src/content/content.ts"),
      },

      preserveEntrySignatures: "strict",

      output: {
        // JS entry files land at dist root with stable (hash-free) names.
        entryFileNames: "[name].js",
        // Shared vendor/helper chunks land in a sub-folder.
        chunkFileNames: "chunks/[name].js",
        // Static assets (CSS, images) land in assets/.
        assetFileNames: "assets/[name][extname]",
      },
    },
  },

  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },

  server: {
    // HMR WebSocket makes no sense inside a Chrome extension popup.
    hmr: false,
  },
});
