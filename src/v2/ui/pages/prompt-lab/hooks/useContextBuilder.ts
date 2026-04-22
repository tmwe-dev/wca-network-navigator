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
    parts.push(`\n=== MATERIALE DI RIFERIMENTO (fornito dall'operatore — usa per arricchire/modificare prompt e KB) ===\n${referenceMaterial.trim()}\n=== FINE MATERIALE ===`);
  }

  // File uploadati
  if (uploadedFiles.length > 0) {
    const fileTexts = uploadedFiles.map((f) => `--- FILE: ${f.name} (${f.sizeKb}KB) ---\n${f.content}\n--- FINE FILE ---`);
    parts.push(`\n=== DOCUMENTI ALLEGATI (${uploadedFiles.length} file — usa come contesto per miglioramenti) ===\n${fileTexts.join("\n\n")}\n=== FINE DOCUMENTI ===`);
  }

  return parts.join("\n");
}
