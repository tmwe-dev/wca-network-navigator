/**
 * seed-kb.ts — Reads all .md files from public/kb-source/ and upserts them into kb_entries.
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

function extractTags(content: string): string[] {
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

async function seed() {
  const files = walk(KB_DIR);
  if (files.length === 0) {
    console.log(`⚠️  Nessun file .md trovato in ${KB_DIR}`);
    console.log("   Crea la cartella public/kb-source/ e inserisci i file markdown.");
    process.exit(0);
  }

  console.log(`📚 Trovati ${files.length} file markdown in ${KB_DIR}`);
  let ok = 0;
  let fail = 0;

  for (const file of files) {
    const content = fs.readFileSync(file, "utf-8");
    const sourcePath = "kb-source/" + path.relative(KB_DIR, file);
    const category = categoryFromPath(file);
    const title = titleFromContent(content, path.basename(file, ".md"));
    const tags = extractTags(content);

    const { error } = await supabase.from("kb_entries").upsert(
      {
        title,
        content,
        category,
        source_path: sourcePath,
        tags,
        priority: category === "workflow" ? 10 : 5,
        is_active: true,
      },
      { onConflict: "source_path" },
    );

    if (error) {
      console.error(`  ✗ ${sourcePath}: ${error.message}`);
      fail++;
    } else {
      console.log(`  ✓ ${sourcePath} → [${category}] ${title}`);
      ok++;
    }
  }

  console.log(`\n✅ Completato: ${ok} inserite, ${fail} errori`);
}

seed().then(() => process.exit(0));
