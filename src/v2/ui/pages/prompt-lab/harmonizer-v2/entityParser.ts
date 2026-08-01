/**
 * entityParser — Splitta un documento markdown in entità autonome.
 *
 * Pipeline V2: ogni heading di livello 1/2/3 diventa una candidata "entity"
 * processata da una micro-call AI separata (no più chunk fissi).
 *
 * Caratteristiche:
 *  - Fence-aware: ignora heading dentro code block ```...```
 *  - Riusa inferCategory + readMeta da harmonizeCollector (single source of truth)
 *  - Skip body < 50 char
 *  - ID stabile = hash sha256 troncato a 12 char di `${table}::${normalizedTitle}`
 */
import { CATEGORY_TO_TABLE_INTERNAL, inferCategoryPublic, readMetaPublic } from "../hooks/harmonizeCollectorExports";

export interface EntityToParse {
  /** Hash stabile sha256(title+table) troncato a 12 char. */
  id: string;
  title: string;
  /** Body senza heading né riga di metadata. */
  content: string;
  /** Tabella inferita (kb_entries / operative_prompts / ...). */
  inferredTable: string;
  category: string;
  chapter?: string;
  priority?: number;
  figure?: string;
  sourceLineStart: number;
  sourceLineEnd: number;
}

const MIN_BODY_CHARS = 100;
/** Massimo livello di heading che genera una nuova entità. H3+ vengono inglobati nel body. */
const MAX_ENTITY_HEADING_LEVEL = 2;

function stripFrontmatter(text: string): string {
  return text.replace(/^---\n[\s\S]*?\n---\n/, "").trim();
}

/** Hash sha256 → hex troncato a 12 char. Browser-safe (Web Crypto). */
async function stableId(seed: string): Promise<string> {
  const enc = new TextEncoder().encode(seed);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  const hex = Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hex.slice(0, 12);
}

/**
 * Splitta il documento rispettando i code fence:
 * un heading dentro ``` ... ``` NON è considerato divisore di sezione.
 * Output: array di blocchi { headerLevel, headerText, bodyLines, lineStart, lineEnd }.
 */
interface RawSection {
  headerLevel: number;
  headerLine: string;
  bodyLines: string[];
  lineStart: number; // 1-based
  lineEnd: number;   // 1-based, inclusive
}

function splitFenceAware(source: string): RawSection[] {
  const lines = source.split("\n");
  const sections: RawSection[] = [];
  let inFence = false;
  let current: RawSection | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Toggle fence (``` o ~~~).
    if (/^(```|~~~)/.test(trimmed)) {
      inFence = !inFence;
      if (current) current.bodyLines.push(line);
      continue;
    }

    if (!inFence) {
      // Splittiamo SOLO su H1/H2. H3+ rimangono parte del body dell'entità H2 corrente.
      const match = line.match(/^(#{1,6})\s+(.+)$/);
      if (match && match[1].length <= MAX_ENTITY_HEADING_LEVEL) {
        // Chiudi sezione corrente.
        if (current) {
          current.lineEnd = i; // riga precedente (0-based i ↔ 1-based i)
          sections.push(current);
        }
        current = {
          headerLevel: match[1].length,
          headerLine: line,
          bodyLines: [],
          lineStart: i + 1,
          lineEnd: i + 1,
        };
        continue;
      }
    }

    if (current) current.bodyLines.push(line);
  }

  if (current) {
    current.lineEnd = lines.length;
    sections.push(current);
  }

  return sections;
}

/** Estrae il titolo "pulito" rimuovendo emoji decorative comuni. */
function extractTitle(headerLine: string): string {
  const m = headerLine.match(/^#{1,6}\s*(?:📄|📚|🎯|🤖|✉️|📞|📊|⚙️|🔧)?\s*(.+?)\s*$/);
  return m ? m[1].trim() : headerLine.replace(/^#+\s*/, "").trim();
}

function stripMetadataLines(body: string): string {
  return body
    .replace(/^\*\*(?:Categoria suggerita|Capitolo|Priorit[àa]|Figura(?:\s*\(opzionale\))?):\*\*.+$/gim, "")
    .replace(/^(?:Categoria suggerita|Capitolo|Priorit[àa]|Figura(?:\s*\(opzionale\))?):.+$/gim, "")
    .trim();
}

function normalizeTitleKey(title: string): string {
  return title.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Parser principale. Async perché usa Web Crypto per gli ID stabili.
 */
export async function parseEntities(rawSource: string): Promise<EntityToParse[]> {
  const source = stripFrontmatter(rawSource);
  if (!source) return [];

  const sections = splitFenceAware(source);
  const out: EntityToParse[] = [];

  for (const sec of sections) {
    const title = extractTitle(sec.headerLine);
    if (!title || title.toLowerCase().includes("placeholder")) continue;

    const rawBody = sec.bodyLines.join("\n").trim();
    const fullSection = `${sec.headerLine}\n${rawBody}`;

    const categoryMeta = readMetaPublic(fullSection, "Categoria suggerita");
    const chapter = readMetaPublic(fullSection, "Capitolo");
    const priorityRaw = readMetaPublic(fullSection, "Priorità") ?? readMetaPublic(fullSection, "Priorita");
    const figure = readMetaPublic(fullSection, "Figura (opzionale)") ?? readMetaPublic(fullSection, "Figura");

    const category = (categoryMeta ?? inferCategoryPublic(title, rawBody)).trim().toLowerCase();
    const inferredTable = CATEGORY_TO_TABLE_INTERNAL[category] ?? "kb_entries";

    const cleanBody = stripMetadataLines(rawBody);
    if (cleanBody.length < MIN_BODY_CHARS) continue;

    const id = await stableId(`${inferredTable}::${normalizeTitleKey(title)}`);

    out.push({
      id,
      title,
      content: cleanBody,
      inferredTable,
      category,
      chapter: chapter?.trim(),
      priority: priorityRaw ? Number(priorityRaw.replace(/[^\d]/g, "")) || 50 : 50,
      figure: figure?.trim(),
      sourceLineStart: sec.lineStart,
      sourceLineEnd: sec.lineEnd,
    });
  }

  return out;
}
