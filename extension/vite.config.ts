// vite.config.ts — Multi-page Manifest V3 extension build.
//
// MV3 has strict rules that shape every decision here:
//
//  1. NO code-splitting across entry points — Chrome's service worker is a
//     single JS file; dynamic import() is allowed but shared chunks must be
//     explicitly named or bundled inline. We set manualChunks: undefined and
//     use `modulePreload: false` so Vite doesn't inject <link rel=modulepreload>
//     tags (the popup document never has a real network to follow them).
//
//  2. NO CDN script injection — CSP blocks remote scripts in extension pages.
//     FontAwesome and Google Fonts are linked as <link> stylesheets in HTML
//     (stylesheet CSP is separate from script-src). qrcode npm package and
//     firebase are bundled locally.
//
//  3. Output must be flat — manifest.json references "popup.html", "options.html",
//     "service-worker.js" etc. at the root of the dist folder. Vite's default
//     puts assets in /assets/; we override all entry chunk names to land at root.
//
//  4. The background service worker must be a classic script OR a module script.
//     We emit it as a module ("type": "module" in manifest.json) which Vite
//     handles fine — just don't let Rollup rename it via hashing.

import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  root: "src",
  publicDir: resolve(__dirname, "public"),

  build: {
    outDir: resolve(__dirname, "dist"),
    emptyOutDir: true,
    target: "es2022",
    modulePreload: false,       // no <link rel=modulepreload> in extension pages
    cssCodeSplit: false,        // single CSS bundle per entry (popup, options)
    sourcemap: false,

    rollupOptions: {
      input: {
        // ---- HTML entry points (popup + options) ----
        // Paths are relative to root ("src"), so "popup/popup.html" resolves
        // to src/popup/popup.html.
        popup:   resolve(__dirname, "src/popup/popup.html"),
        options: resolve(__dirname, "src/options/options.html"),

        // ---- Non-HTML entry points ----
        // The service worker must land at dist/service-worker.js (manifest ref).
        "service-worker": resolve(__dirname, "src/background/service-worker.ts"),
        // Content script — injected on demand via chrome.scripting.executeScript.
        content: resolve(__dirname, "src/content/content.ts"),
      },

      // Prevent Rollup from tree-shaking chrome.* side-effects in the SW
      preserveEntrySignatures: "strict",

      output: {
        // Land every entry chunk at the dist root with a stable, unhashed name.
        entryFileNames: "[name].js",
        // Shared chunks (e.g. shared services imported by popup + options)
        // also land at root with stable names.
        chunkFileNames: "chunks/[name].js",
        // CSS and asset files go into assets/
        assetFileNames: "assets/[name][extname]",
      },
    },
  },

  // Resolve aliases so deep imports stay short
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },

  // In dev/watch mode, Vite's HMR WebSocket is irrelevant for extensions —
  // disable the overlay so it doesn't try to inject runtime into the popup.
  server: {
    hmr: false,
  },
});
