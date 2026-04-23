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

// Limiti per contesto filtrato per blocco
const MAX_RELEVANT_DOCTRINE_CHARS = 3_000;
const MAX_RELEVANT_FILE_CHARS = 4_000;
const MAX_NEARBY_BLOCKS = 6;
const MAX_INDEX_BLOCKS = 40;

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
 * Filtra la dottrina per rilevanza al blocco specifico.
 * Restituisce: contenuto completo dei top-N più rilevanti + indice compatto del resto.
 */
export function filterDoctrineForBlock(
  fullDoctrine: string,
  block: Block,
  tabLabel: string,
): string {
  // Splitta per sezioni (### header)
  const sections = fullDoctrine.split(/(?=^### )/m).filter((s) => s.trim());
  if (sections.length === 0) return fullDoctrine;

  // Calcola rilevanza per ogni sezione
  const scored = sections.map((section) => ({
    section,
    score: relevanceScore(block, tabLabel, section),
    title: section.split("\n")[0]?.replace(/^###\s*/, "").trim() || "(senza titolo)",
  }));

  // Ordina per score discendente
  scored.sort((a, b) => b.score - a.score);

  // Top rilevanti: contenuto completo (entro budget)
  const parts: string[] = [];
  let charBudget = MAX_RELEVANT_DOCTRINE_CHARS;
  const detailedCount = Math.min(scored.length, 8);

  parts.push("--- KB DOCTRINE RILEVANTE (dettaglio) ---");
  for (let i = 0; i < detailedCount && charBudget > 0; i++) {
    const s = scored[i];
    if (s.section.length <= charBudget) {
      parts.push(s.section);
      charBudget -= s.section.length;
    } else {
      parts.push(compactText(s.section, charBudget, s.title));
      charBudget = 0;
    }
  }
  parts.push("--- FINE KB DOCTRINE RILEVANTE ---");

  // Resto: solo indice (titoli)
  if (scored.length > detailedCount) {
    parts.push("\n--- INDICE KB DOCTRINE COMPLETA (solo titoli — non dettagliati per questo blocco) ---");
    for (let i = detailedCount; i < scored.length; i++) {
      parts.push(`• ${scored[i].title}`);
    }
    parts.push("--- FINE INDICE ---");
  }

  return parts.join("\n");
}

/**
 * Filtra la system map per rilevanza al blocco specifico.
 * Restituisce: blocchi dello stesso tab completi + indice compatto del resto.
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

  // Blocchi dello stesso tab: dettaglio completo (primi N)
  parts.push(`\n--- BLOCCHI VICINI (stesso tab: ${currentTabLabel}) — NON contraddirli ---`);
  for (const item of sameTab.slice(0, MAX_NEARBY_BLOCKS)) {
    const snippet = item.block.content.slice(0, 400).replace(/\s+/g, " ").trim();
    parts.push(`• ${item.block.label}: ${snippet}${item.block.content.length > 400 ? "…" : ""}`);
  }
  if (sameTab.length > MAX_NEARBY_BLOCKS) {
    parts.push(`  [+${sameTab.length - MAX_NEARBY_BLOCKS} altri blocchi nello stesso tab]`);
  }
  parts.push("--- FINE BLOCCHI VICINI ---");

  // Altri tab: solo indice compatto
  parts.push("\n--- INDICE ALTRI TAB (solo etichette — per coerenza globale) ---");
  let indexCount = 0;
  for (const [tab, blocks] of otherTabs) {
    if (indexCount >= MAX_INDEX_BLOCKS) {
      parts.push(`  [… altri tab omessi]`);
      break;
    }
    parts.push(`## ${tab} (${blocks.length} blocchi)`);
    for (const { block } of blocks.slice(0, 5)) {
      parts.push(`  - ${block.label}`);
      indexCount++;
    }
    if (blocks.length > 5) {
      parts.push(`  [+${blocks.length - 5} altri]`);
      indexCount++;
    }
  }
  parts.push("--- FINE INDICE ---");

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
