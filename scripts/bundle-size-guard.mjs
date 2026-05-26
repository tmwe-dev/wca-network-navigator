#!/usr/bin/env node
/**
 * Bundle size guard.
 * Calcola la dimensione totale di dist/assets/*.{js,css} e fallisce se
 * supera la soglia (env BUNDLE_MAX_KB, default 3500 KB).
 * Reporting-only se BUNDLE_GUARD_WARN_ONLY=1.
 */
import fs from "node:fs";
import path from "node:path";

const distDir = path.resolve("dist/assets");
if (!fs.existsSync(distDir)) {
  console.error("bundle-size: dist/assets non esiste. Esegui `npm run build` prima.");
  process.exit(1);
}

const MAX_KB = Number(process.env.BUNDLE_MAX_KB ?? 3500);
const WARN_ONLY = process.env.BUNDLE_GUARD_WARN_ONLY === "1";

const files = fs
  .readdirSync(distDir)
  .filter((f) => /\.(js|css)$/.test(f))
  .map((f) => {
    const stat = fs.statSync(path.join(distDir, f));
    return { file: f, kb: stat.size / 1024 };
  })
  .sort((a, b) => b.kb - a.kb);

const total = files.reduce((s, f) => s + f.kb, 0);

console.log(`bundle-size: ${files.length} asset, totale ${total.toFixed(0)} KB (limite ${MAX_KB} KB)`);
console.log("Top 10 più pesanti:");
for (const f of files.slice(0, 10)) {
  console.log(`  ${f.kb.toFixed(0).padStart(6)} KB  ${f.file}`);
}

if (total > MAX_KB) {
  const msg = `\n⚠️  Bundle size ${total.toFixed(0)} KB supera il limite di ${MAX_KB} KB.`;
  if (WARN_ONLY) {
    console.warn(msg + " (warn-only, non blocca)");
    process.exit(0);
  }
  console.error(msg);
  process.exit(1);
}
console.log("\n✅ Bundle size OK.");