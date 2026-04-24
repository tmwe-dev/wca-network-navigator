/**
 * harmonizerKbInjector — carica i file .md della KB Harmonizer rilevanti
 * per UN chunk e li concatena per essere accodati al system prompt.
 *
 * Filosofia:
 *  - La KB statica in `public/kb-source/harmonizer/*.md` è VINCOLANTE
 *    (schema tabelle, enum, policy hard, constraints).
 *  - Senza iniezione, il modello "vede" solo i NOMI dei file (sez. F del
 *    briefing) e inventa colonne/categorie inesistenti.
 *  - L'injector seleziona per chunk SOLO i file rilevanti (token budget).
 *
 * Mancanze tollerate: se un file 404 (es. 41-agents-existing.md non ancora
 * generato), viene saltato con un warning, non blocca la pipeline.
 */

/** Mappa: targetTable → file .md vincolanti per quella tabella. */
const TABLE_TO_KB_FILES: Record<string, string[]> = {
  agents: ["40-agents-schema.md", "41-agents-existing.md"],
  agent_personas: ["40-agents-schema.md"],
  kb_entries: ["50-kb-categories.md"],
  operative_prompts: ["50-kb-categories.md", "70-runtime-contracts.md"],
  email_prompts: ["70-runtime-contracts.md"],
  email_address_rules: ["30-business-constraints.md"],
  commercial_playbooks: ["50-kb-categories.md"],
  app_settings: ["60-code-policies-active.md"],
};

/**
 * File SEMPRE iniettati — ridotti al minimo critico per non saturare
 * la context window. Ordine = priorità (i primi sono garantiti).
 */
const ALWAYS_INJECT: string[] = [
  "60-code-policies-active.md",   // policy hard: bloccante
  "30-business-constraints.md",   // constraint business: bloccante
];

/**
 * Cap di sicurezza ridotto. Con 8KB rimane spazio per briefing (~6KB),
 * stato sessione (~3KB) e gap testo (~10KB). Sopra ai 12KB il modello
 * smetteva di rispondere (output vuoto → parser fallisce).
 */
const KB_INJECTION_BUDGET_CHARS = 8_000;

const KB_BASE_PATH = "/kb-source/harmonizer";

/** Cache in-memory per fetch idempotenti durante la sessione browser. */
const fileCache = new Map<string, string | null>();

async function fetchKbFile(filename: string): Promise<string | null> {
  if (fileCache.has(filename)) return fileCache.get(filename)!;
  try {
    const resp = await fetch(`${KB_BASE_PATH}/${filename}`);
    if (!resp.ok) {
      console.warn(`[kbInjector] ${filename} not found (${resp.status})`);
      fileCache.set(filename, null);
      return null;
    }
    const text = await resp.text();
    fileCache.set(filename, text);
    return text;
  } catch (e) {
    console.warn(`[kbInjector] fetch failed for ${filename}`, e);
    fileCache.set(filename, null);
    return null;
  }
}

/**
 * Costruisce il blocco KB iniettato per un chunk.
 *
 * @param targetTables tabelle target del chunk corrente
 * @returns testo markdown da accodare al system prompt, già taggato
 */
export async function buildHarmonizerKbContext(
  targetTables: string[],
): Promise<string> {
  // 1. Determina set di file rilevanti (sempre + tabelle).
  const fileSet = new Set<string>(ALWAYS_INJECT);
  for (const t of targetTables) {
    const files = TABLE_TO_KB_FILES[t] ?? [];
    for (const f of files) fileSet.add(f);
  }

  // 2. Fetch parallelo, ordinato per nome (per determinismo del prompt).
  // ALWAYS_INJECT mantiene il proprio ordine (priorità), poi tabelle in ordine.
  const tableFiles = Array.from(fileSet)
    .filter((f) => !ALWAYS_INJECT.includes(f))
    .sort();
  const fileList = [...ALWAYS_INJECT.filter((f) => fileSet.has(f)), ...tableFiles];
  const contents = await Promise.all(
    fileList.map(async (f) => ({ name: f, body: await fetchKbFile(f) })),
  );

  // 3. Concatena rispettando il budget chars.
  const parts: string[] = [];
  let used = 0;
  for (const { name, body } of contents) {
    if (!body) continue;
    const block = `\n\n--- FILE KB: ${name} ---\n${body.trim()}\n--- END ${name} ---`;
    if (used + block.length > KB_INJECTION_BUDGET_CHARS) {
      console.warn(`[kbInjector] budget exhausted at ${name}, stop injection`);
      break;
    }
    parts.push(block);
    used += block.length;
  }

  if (parts.length === 0) return "";

  return `\n\n# KB HARMONIZER — CONTENUTI VINCOLANTI INIETTATI\n\nI file seguenti sono la fonte di verità per schema tabelle, enum, categorie, policy hard e contratti runtime. Rispetta letteralmente i campi/valori indicati. NON inventare colonne, categorie o enum non elencati qui.\n${parts.join("\n")}`;
}