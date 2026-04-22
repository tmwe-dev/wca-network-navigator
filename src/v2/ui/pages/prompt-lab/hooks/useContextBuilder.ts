/**
 * useContextBuilder — Builds extra context for global improvement requests.
 *
 * Assembles:
 * - System manifest
 * - Company profile from app_settings
 * - Reference material
 * - Uploaded files
 */

import { getAppSetting } from "@/data/appSettings";
import { buildSystemManifest, buildCompanyProfile } from "../utils/systemManifest";
import type { ParsedFile } from "../utils/fileParser";

const MAX_REFERENCE_CHARS = 4_000;
const MAX_FILES = 4;
const MAX_FILE_CHARS = 2_500;
const MAX_TOTAL_FILE_CHARS = 8_000;

function compactText(text: string, maxChars: number, label: string): string {
  const normalized = text.replace(/\u0000/g, "").replace(/\s{3,}/g, "  ").trim();
  if (!normalized) return "";
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, maxChars).trimEnd()}\n[… ${label} troncato per stabilità runtime]`;
}

/** Costruisce il contesto extra (materiale di riferimento + file + manifest + profilo). */
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
