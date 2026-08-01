/**
 * kb-source-index-integrity — FASE 4 (KB e memoria), campagna 90K.
 *
 * Guardia anti-drift fra `public/kb-source/index.json` e i file reali su disco.
 * `scripts/seed-kb.ts` legge index.json come fonte autorevole dei metadati
 * (slug, title, tags, category, priority) e ricade su euristiche da path per
 * i file non indicizzati: un disallineamento silenzioso degrada la KB
 * (slug generati, categorie sbagliate) senza alcun errore visibile.
 *
 * Esclusioni INTENZIONALI dall'indice (documentate, non drift):
 *  - README.md              → documentazione della cartella, non contenuto KB
 *  - harmonizer/*.md        → caricati a runtime da harmonizerKbInjector via HTTP
 *  - libreria-tmwe.md       → catalogo servito con metadati derivati dal frontmatter
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const KB_DIR = path.resolve(__dirname, "../../public/kb-source");

interface IndexEntry {
  path: string;
  slug: string;
  title: string;
  tags: string[];
  category?: string;
  priority?: number;
}

const index = JSON.parse(
  fs.readFileSync(path.join(KB_DIR, "index.json"), "utf-8"),
) as { version: number; entries: IndexEntry[] };

/** File .md volutamente fuori indice (vedi header). */
const EXCLUDED = (rel: string): boolean =>
  rel === "README.md" || rel === "libreria-tmwe.md" || rel.startsWith("harmonizer/");

function listMarkdown(dir: string, base = dir): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listMarkdown(full, base);
    if (!entry.name.endsWith(".md")) return [];
    return [path.relative(base, full).split(path.sep).join("/")];
  });
}

describe("KB source index integrity", () => {
  const files = listMarkdown(KB_DIR);

  it("index.json è in versione 2 e non vuoto", () => {
    expect(index.version).toBe(2);
    expect(index.entries.length).toBeGreaterThan(0);
  });

  it("ogni voce dell'indice punta a un file esistente", () => {
    const missing = index.entries
      .map((e) => e.path)
      .filter((p) => !fs.existsSync(path.join(KB_DIR, p)));
    expect(missing).toEqual([]);
  });

  it("slug e path sono univoci", () => {
    const slugs = index.entries.map((e) => e.slug);
    const paths = index.entries.map((e) => e.path);
    expect(slugs.filter((s, i) => slugs.indexOf(s) !== i)).toEqual([]);
    expect(paths.filter((p, i) => paths.indexOf(p) !== i)).toEqual([]);
  });

  it("ogni voce ha title e almeno un tag", () => {
    const invalid = index.entries.filter(
      (e) => !e.title?.trim() || !Array.isArray(e.tags) || e.tags.length === 0,
    );
    expect(invalid.map((e) => e.path)).toEqual([]);
  });

  it("nessun file .md non escluso resta fuori dall'indice", () => {
    const indexed = new Set(index.entries.map((e) => e.path));
    const orphans = files.filter((f) => !EXCLUDED(f) && !indexed.has(f));
    expect(orphans).toEqual([]);
  });

  it("i file esclusi non compaiono nell'indice (esclusione coerente)", () => {
    const wrongly = index.entries.map((e) => e.path).filter(EXCLUDED);
    expect(wrongly).toEqual([]);
  });
});
