#!/usr/bin/env node
// scripts/generate-icons.js
//
// Generates the three icon sizes required by manifest.json (16, 48, 128 px)
// from a single source SVG at src/assets/icon.svg using the `sharp` library.
//
// Run once after changing the logo:
//   node scripts/generate-icons.js
//
// Output goes to public/icons/ which Vite copies to dist/ verbatim.

import { createRequire } from "module";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { mkdirSync } from "fs";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const src = resolve(root, "src/assets/icon.svg");
const outDir = resolve(root, "public/icons");

mkdirSync(outDir, { recursive: true });

const sizes = [16, 48, 128];

for (const size of sizes) {
  const outPath = resolve(outDir, `icon${size}.png`);
  await sharp(src).resize(size, size).png().toFile(outPath);
  console.log(`  ✓  icon${size}.png`);
}

console.log("✅  Icons generated → public/icons/");
