/**
 * seed-kb.ts — Reads all .md files from public/kb-source/ and upserts them into kb_entries.
 * Now also reads index.json for authoritative metadata (title, tags, slug, category, priority).
 * Usage: npx tsx scripts/seed-kb.ts
 * Requires env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const KB_DIR = path.resolve("public/kb-source");

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

/* ─── Index.json metadata ─── */

interface IndexEntry {
  path: string;
  slug: string;
  title: string;
  tags: string[];
  category?: string;
  priority?: number;
}

interface IndexFile {
  version: number;
  entries: IndexEntry[];
}

function loadIndex(): Map<string, IndexEntry> {
  const indexPath = path.join(KB_DIR, "index.json");
  const map = new Map<string, IndexEntry>();
  if (!fs.existsSync(indexPath)) {
    console.log("⚠️  index.json non trovato, uso fallback da frontmatter/path");
    return map;
  }
  try {
    const raw = JSON.parse(fs.readFileSync(indexPath, "utf-8")) as IndexFile;
    for (const entry of raw.entries) {
      map.set(entry.path, entry);
    }
    console.log(`📋 index.json caricato: ${map.size} voci`);
  } catch (e) {
    console.error("⚠️  Errore parsing index.json:", e);
  }
  return map;
}

/* ─── Helpers ─── */

function categoryFromPath(filePath: string): string {
  const rel = path.relative(KB_DIR, filePath);
  const dir = path.dirname(rel);
  if (dir && dir !== ".") return dir.split(path.sep)[0];
  const match = rel.match(/^\d+-(.+)\.md$/);
  if (match) return match[1].replace(/\.md$/, "");
  return "general";
}

function titleFromContent(content: string, fallback: string): string {
  const m = content.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : fallback;
}

function extractFrontmatterTags(content: string): string[] {
  const tags: string[] = [];
  const tagLine = content.match(/^tags:\s*\[(.+)\]/m);
  if (tagLine) {
    tags.push(
      ...tagLine[1]
        .split(",")
        .map((t) => t.trim().replace(/['"]/g, ""))
        .filter(Boolean),
    );
  }
  return tags;
}

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const full = path.join(dir, d.name);
    return d.isDirectory() ? walk(full) : full.endsWith(".md") ? [full] : [];
  });
}

/* ─── Seed ─── */

async function seed() {
  const files = walk(KB_DIR);
  if (files.length === 0) {
    console.log(`⚠️  Nessun file .md trovato in ${KB_DIR}`);
    console.log("   Crea la cartella public/kb-source/ e inserisci i file markdown.");
    process.exit(0);
  }

  const index = loadIndex();

  console.log(`📚 Trovati ${files.length} file markdown in ${KB_DIR}`);
  let ok = 0;
  let fail = 0;

  for (const file of files) {
    const content = fs.readFileSync(file, "utf-8");
    const relPath = path.relative(KB_DIR, file);
    const sourcePath = "kb-source/" + relPath;

    // Lookup in index.json (match by relative path)
    const meta = index.get(relPath);

    const title = meta?.title ?? titleFromContent(content, path.basename(file, ".md"));
    const tags = meta?.tags ?? extractFrontmatterTags(content);
    const category = meta?.category ?? categoryFromPath(file);
    const priority = meta?.priority ?? (category === "workflow" ? 10 : 5);

    const { error } = await supabase.from("kb_entries").upsert(
      {
        title,
        content,
        category,
        source_path: sourcePath,
        tags,
        priority,
        is_active: true,
      },
      { onConflict: "source_path" },
    );

    if (error) {
      console.error(`  ✗ ${sourcePath}: ${error.message}`);
      fail++;
    } else {
      console.log(`  ✓ ${sourcePath} → [${category}] ${title} (tags: ${tags.join(", ") || "–"})`);
      ok++;
    }
  }

  console.log(`\n✅ Completato: ${ok} inserite, ${fail} errori`);
}

seed().then(() => process.exit(0));
