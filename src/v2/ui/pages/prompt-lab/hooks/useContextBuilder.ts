/**
 * useContextBuilder — Builds extra context for global improvement requests.
 *
 * LOVABLE-109: Contesto filtrato per blocco + limiti file aumentati per KB grandi.
 *
 * Assembles:
 * - System manifest
 * - Company profile from app_settings
 * - Reference material
 * - Uploaded files (con limiti aumentati per documenti KB)
 *
 * Nuovo: filterContextForBlock() filtra dottrina e system map
 * per rilevanza al blocco specifico, riducendo rumore e token.
 */

import { getAppSetting } from "@/data/appSettings";
import { buildSystemManifest, buildCompanyProfile } from "../utils/systemManifest";
import type { ParsedFile } from "../utils/fileParser";
import type { Block } from "../types";

// Limiti aumentati per supportare KB grandi (es. 29K parole)
const MAX_REFERENCE_CHARS = 8_000;
const MAX_FILES = 6;
const MAX_FILE_CHARS = 6_000;
const MAX_TOTAL_FILE_CHARS = 20_000;

// Limiti REALI per stabilità AI: il modello non può ragionare su 3M token.
// Per "Migliora tutto" su KB grande, il contesto per blocco resta <15K chars.
const MAX_RELEVANT_DOCTRINE_CHARS = 10_000;  // budget reale per call
const MAX_RELEVANT_FILE_CHARS = 20_000;
const MAX_NEARBY_BLOCKS = 5;                  // top blocchi vicini con contenuto completo
const MAX_INDEX_BLOCKS = 100;                 // indice compatto per gli altri

function compactText(text: string, maxChars: number, label: string): string {
  const normalized = text.replace(/\u0000/g, "").replace(/\s{3,}/g, "  ").trim();
  if (!normalized) return "";
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, maxChars).trimEnd()}\n[… ${label} troncato per stabilità runtime]`;
}

/**
 * Calcola un punteggio di rilevanza tra un blocco e un testo di riferimento.
 * Usa keyword overlap pesato su label, tab e contenuto del blocco.
 */
function relevanceScore(block: Block, tabLabel: string, referenceText: string): number {
  const refLower = referenceText.toLowerCase();
  const keywords = [
    ...block.label.toLowerCase().split(/[\s\-_—/]+/).filter((w) => w.length > 3),
    ...tabLabel.toLowerCase().split(/[\s\-_—/]+/).filter((w) => w.length > 3),
  ];
  // Estrai anche keyword dal contenuto del blocco (prime 200 chars)
  const contentWords = block.content
    .slice(0, 200)
    .toLowerCase()
    .split(/[\s\-_—/,.;:]+/)
    .filter((w) => w.length > 4)
    .slice(0, 10);
  keywords.push(...contentWords);

  let score = 0;
  const seen = new Set<string>();
  for (const kw of keywords) {
    if (seen.has(kw)) continue;
    seen.add(kw);
    if (refLower.includes(kw)) score += 1;
  }
  return score;
}

/**
 * Passa la dottrina al Lab Agent, troncata a max 10K chars per call.
 *
 * Strategia: split per sezioni `### `, score per rilevanza al blocco, prendi
 * le top sezioni fino a esaurire il budget. Le sezioni omesse vengono
 * dichiarate nell'header per trasparenza.
 */
export function filterDoctrineForBlock(
  fullDoctrine: string,
  block: Block,
  tabLabel: string,
): string {
  if (fullDoctrine.length <= MAX_RELEVANT_DOCTRINE_CHARS) {
    return `--- KB DOCTRINE (rilevante per "${block.label}") ---\n${fullDoctrine}\n--- FINE KB DOCTRINE ---`;
  }

  const sections = fullDoctrine.split(/(?=^### )/m).filter((s) => s.trim());
  if (sections.length === 0) {
    return fullDoctrine.slice(0, MAX_RELEVANT_DOCTRINE_CHARS);
  }

  const scored = sections.map((section) => ({
    section,
    score: relevanceScore(block, tabLabel, section),
    title: section.split("\n")[0]?.replace(/^###\s*/, "").trim() || "(senza titolo)",
  }));
  scored.sort((a, b) => b.score - a.score);

  const parts: string[] = [];
  let budget = MAX_RELEVANT_DOCTRINE_CHARS;
  let included = 0;
  for (const s of scored) {
    if (budget <= 0) break;
    const chunk = s.section.slice(0, budget);
    parts.push(chunk);
    budget -= chunk.length;
    included++;
  }
  const omitted = sections.length - included;
  const header = `--- KB DOCTRINE (top ${included} su ${sections.length} sezioni, ordinate per rilevanza a "${block.label}"${omitted > 0 ? ` — ${omitted} omesse per budget` : ""}) ---`;
  parts.unshift(header);
  parts.push("--- FINE KB DOCTRINE ---");

  return parts.join("\n");
}

/**
 * Costruisce la system map per il Lab Agent come compact index.
 *
 * Strategia (token-aware):
 * - Top 5 blocchi dello stesso tab (per relevanceScore) → contenuto COMPLETO
 *   per coerenza diretta con i vicini.
 * - Tutti gli altri (stesso tab residui + altri tab) → INDICE COMPATTO:
 *   solo `[tab] label`, niente più snippet da 800 chars.
 *
 * Risultato: contesto da ~250×800 = 200K chars → ~5×3K + 100×40 = ~19K chars.
 */
export function filterSystemMapForBlock(
  allBlocks: ReadonlyArray<{ tabLabel: string; block: Block }>,
  currentBlock: Block,
  currentTabLabel: string,
): string {
  const sameTab: Array<{ tabLabel: string; block: Block }> = [];
  const otherTabs = new Map<string, Array<{ block: Block }>>();

  for (const item of allBlocks) {
    if (item.block.id === currentBlock.id) continue;
    if (item.tabLabel === currentTabLabel) {
      sameTab.push(item);
    } else {
      if (!otherTabs.has(item.tabLabel)) otherTabs.set(item.tabLabel, []);
      otherTabs.get(item.tabLabel)!.push({ block: item.block });
    }
  }

  const parts: string[] = [];

  // Top N blocchi dello stesso tab: contenuto completo (per coerenza diretta)
  const nearbyScored = sameTab
    .map((item) => ({
      item,
      score: relevanceScore(item.block, currentTabLabel, currentBlock.content),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_NEARBY_BLOCKS);

  if (nearbyScored.length > 0) {
    parts.push(`--- BLOCCHI VICINI (top ${nearbyScored.length} dello stesso tab: ${currentTabLabel} — NON contraddirli) ---`);
    for (const { item } of nearbyScored) {
      parts.push(`### ${item.block.label}\n${item.block.content}`);
    }
    parts.push("--- FINE BLOCCHI VICINI ---");
  }

  // Indice compatto per TUTTI gli altri (solo label + tab — awareness)
  parts.push("\n--- INDICE SISTEMA (tutti gli altri blocchi — solo titoli per awareness) ---");
  let indexCount = 0;

  // Prima i restanti dello stesso tab (esclusi i top N)
  const nearbyIds = new Set(nearbyScored.map((n) => n.item.block.id));
  for (const item of sameTab) {
    if (nearbyIds.has(item.block.id)) continue;
    if (indexCount >= MAX_INDEX_BLOCKS) break;
    parts.push(`  [${currentTabLabel}] ${item.block.label}`);
    indexCount++;
  }

  // Poi gli altri tab
  for (const [tab, blocks] of otherTabs) {
    if (indexCount >= MAX_INDEX_BLOCKS) break;
    for (const { block } of blocks) {
      if (indexCount >= MAX_INDEX_BLOCKS) break;
      parts.push(`  [${tab}] ${block.label}`);
      indexCount++;
    }
  }
  parts.push("--- FINE INDICE SISTEMA ---");

  return parts.join("\n");
}

/**
 * Filtra il materiale di riferimento (file + testo) per rilevanza al blocco.
 * Per file grandi come la KB completa, estrae solo le sezioni rilevanti.
 */
export function filterReferenceForBlock(
  referenceMaterial: string,
  uploadedFiles: ParsedFile[],
  block: Block,
  tabLabel: string,
): string {
  const parts: string[] = [];

  // Materiale di riferimento: filtra sezioni rilevanti
  if (referenceMaterial.trim()) {
    const sections = referenceMaterial.split(/(?=^#{1,3}\s)/m).filter((s) => s.trim());
    if (sections.length > 1) {
      // File strutturato: filtra per rilevanza
      const scored = sections.map((s) => ({
        section: s,
        score: relevanceScore(block, tabLabel, s),
      }));
      scored.sort((a, b) => b.score - a.score);
      const relevant = scored
        .filter((s) => s.score > 0)
        .slice(0, 5);
      if (relevant.length > 0) {
        parts.push("=== MATERIALE DI RIFERIMENTO (sezioni rilevanti per questo blocco) ===");
        let budget = MAX_RELEVANT_FILE_CHARS;
        for (const r of relevant) {
          if (budget <= 0) break;
          parts.push(compactText(r.section, budget, "sezione riferimento"));
          budget -= Math.min(r.section.length, budget);
        }
        parts.push("=== FINE MATERIALE ===");
      }
    } else {
      // Testo breve: includi tutto (entro limite)
      parts.push(`=== MATERIALE DI RIFERIMENTO ===\n${compactText(referenceMaterial, MAX_RELEVANT_FILE_CHARS, "materiale")}\n=== FINE MATERIALE ===`);
    }
  }

  // File uploadati: filtra sezioni rilevanti per file grandi
  for (const f of uploadedFiles.slice(0, MAX_FILES)) {
    const sections = f.content.split(/(?=^#{1,3}\s)/m).filter((s) => s.trim());
    if (sections.length > 3) {
      // File strutturato grande: filtra
      const scored = sections.map((s) => ({
        section: s,
        score: relevanceScore(block, tabLabel, s),
      }));
      scored.sort((a, b) => b.score - a.score);
      const relevant = scored.filter((s) => s.score > 0).slice(0, 4);
      if (relevant.length > 0) {
        parts.push(`--- FILE: ${f.name} (sezioni rilevanti) ---`);
        let budget = MAX_FILE_CHARS;
        for (const r of relevant) {
          if (budget <= 0) break;
          parts.push(compactText(r.section, budget, f.name));
          budget -= Math.min(r.section.length, budget);
        }
        parts.push(`--- FINE FILE ---`);
      } else {
        parts.push(`--- FILE: ${f.name} (nessuna sezione direttamente rilevante per "${block.label}") ---`);
      }
    } else {
      // File piccolo: includi tutto
      parts.push(`--- FILE: ${f.name} (${f.sizeKb}KB) ---\n${compactText(f.content, MAX_FILE_CHARS, f.name)}\n--- FINE FILE ---`);
    }
  }

  return parts.join("\n\n");
}

/** Costruisce il contesto extra GLOBALE (manifest + profilo + file integrali). Usato per inventario iniziale. */
export async function buildExtraContext(
  userId: string,
  referenceMaterial: string = "",
  uploadedFiles: ParsedFile[] = [],
): Promise<string> {
  const parts: string[] = [];

  // System manifest (architettura, tool, side-effect)
  parts.push(buildSystemManifest());

  // Profilo azienda da app_settings
  try {
    const profileKeys = [
      "ai_company_name", "ai_company_alias", "ai_contact_name", "ai_contact_role",
      "ai_sector", "ai_tone", "ai_language", "ai_business_goals", "ai_behavior_rules", "ai_style_instructions",
    ];
    const settings: Record<string, string> = {};
    for (const key of profileKeys) {
      const val = await getAppSetting(key, userId);
      if (val) settings[key] = val;
    }
    if (Object.keys(settings).length > 0) {
      parts.push(buildCompanyProfile(settings));
    }
  } catch { /* skip profile if unavailable */ }

  // Materiale di riferimento (testo libero)
  if (referenceMaterial.trim()) {
    parts.push(`\n=== MATERIALE DI RIFERIMENTO (fornito dall'operatore — usa per arricchire/modificare prompt e KB) ===\n${compactText(referenceMaterial, MAX_REFERENCE_CHARS, "materiale di riferimento")}\n=== FINE MATERIALE ===`);
  }

  // File uploadati
  if (uploadedFiles.length > 0) {
    let remainingChars = MAX_TOTAL_FILE_CHARS;
    const hiddenFiles = Math.max(0, uploadedFiles.length - MAX_FILES);
    const fileTexts = uploadedFiles.slice(0, MAX_FILES).flatMap((f) => {
      if (remainingChars <= 0) return [];
      const budget = Math.min(MAX_FILE_CHARS, remainingChars);
      const compacted = compactText(f.content, budget, `file ${f.name}`);
      if (!compacted) return [];
      remainingChars -= compacted.length;
      return [`--- FILE: ${f.name} (${f.sizeKb}KB) ---\n${compacted}\n--- FINE FILE ---`];
    });
    if (hiddenFiles > 0) {
      fileTexts.push(`[Altri ${hiddenFiles} file non inclusi integralmente per stabilità runtime]`);
    }
    parts.push(`\n=== DOCUMENTI ALLEGATI (${uploadedFiles.length} file — usa come contesto per miglioramenti) ===\n${fileTexts.join("\n\n")}\n=== FINE DOCUMENTI ===`);
  }

  return parts.join("\n");
}
