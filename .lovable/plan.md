# Fix Token Explosion + Resilienza Parser TMWE

Risolve l'errore "Parser non è riuscito a estrarre nulla in scope per chunk #0" causato da:
1. Cap hardcoded `max_tokens=8000` su scope `kb-supervisor` → output JSON troncato a metà stringa.
2. `ResponseSchema.safeParse` all-or-nothing su Zod → una proposta malformata fa scartare TUTTE le 20.

## Modifiche (5 file)

### File 1 — `supabase/functions/_shared/scopeConfigs.ts`
Aggiungere campo opzionale `maxTokens?: number` all'interface `ScopeConfig` e settarlo a `32000` sullo scope `kb-supervisor`:

```ts
export interface ScopeConfig {
  // ...esistenti
  maxTokens?: number;
}

case "kb-supervisor":
  return {
    systemPrompt: `...`,
    tools: PLATFORM_TOOLS,
    model: "google/gemini-2.5-flash",
    temperature: 0.2,
    maxTokens: 32000,        // ← NEW: budget output ampio per JSON TMWE densi
    creditLabel: "KB Supervisor",
  };
```

### File 2 — `supabase/functions/ai-assistant/aiCallHandler.ts`
Rimuovere il cap hardcoded `8000` e leggere il budget dallo scope config. Propagare `finish_reason` al chiamante per loggarlo.

```ts
// PRIMA (linee 211-223): hardcoded 8000 per kb-supervisor
// DOPO: leggi maxTokens dalla scope config, fallback undefined
let scopeTemperature: number | undefined;
let scopeMaxTokens: number | undefined;
if (scope) {
  try {
    const sc = getScopeConfig(scope);
    if (typeof sc.temperature === "number") scopeTemperature = sc.temperature;
    if (typeof sc.maxTokens === "number") scopeMaxTokens = sc.maxTokens;
  } catch { /* ignore */ }
}
// Fallback di sicurezza solo se scope non l'ha dichiarato
if (scope === "kb-supervisor" && scopeMaxTokens === undefined) {
  scopeMaxTokens = 32000;
}
if (scope === "kb-supervisor" && scopeTemperature === undefined) {
  scopeTemperature = 0.2;
}
```

Inoltre, in `makeAiCall` (linee 156-168) loggare esplicitamente `finish_reason === "length"` come truncation symptom:

```ts
if (!hasContent && !hasToolCalls) {
  const fr = choice?.finish_reason;
  console.warn("[AI] empty content from model", {
    model: options.model,
    finish_reason: fr,
    truncated: fr === "length",
    usage: data?.usage,
  });
  // ...
}
```

### File 3 — `src/v2/ui/pages/prompt-lab/hooks/harmonizeAnalyzer.ts`

**3a. Auto-repair JSON troncato.** Aggiungere helper `repairTruncatedJson` che chiude stringhe/array/oggetti aperti:

```ts
function repairTruncatedJson(s: string): string {
  let out = s;
  // Conta apici non escapati
  let inString = false;
  let escape = false;
  for (let i = 0; i < out.length; i++) {
    const ch = out[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\") { escape = true; continue; }
    if (ch === '"') inString = !inString;
  }
  if (inString) out += '"';
  // Bilancia parentesi
  let openObj = 0, openArr = 0;
  inString = false; escape = false;
  for (const ch of out) {
    if (escape) { escape = false; continue; }
    if (ch === "\\") { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{") openObj++;
    else if (ch === "}") openObj--;
    else if (ch === "[") openArr++;
    else if (ch === "]") openArr--;
  }
  // Rimuovi virgola finale prima della chiusura, se presente
  out = out.replace(/,\s*$/, "");
  while (openArr-- > 0) out += "]";
  while (openObj-- > 0) out += "}";
  return out;
}
```

**3b. Validazione Zod individuale per proposta** (richiesta esplicita utente). Sostituire `parseProposalsFromText` (linee 187-250):

```ts
export function parseProposalsFromText(raw: string, chunk: GapCandidate[]): HarmonizeProposal[] {
  const jsonStr = extractJsonObject(raw);
  if (!jsonStr) {
    console.warn("[harmonizeAnalyzer] no JSON found", { rawPreview: raw.slice(0, 200) });
    return [];
  }
  let parsedRaw: unknown;
  try {
    parsedRaw = JSON.parse(jsonStr);
  } catch (e1) {
    // Tentativo 2: repair JSON troncato
    try {
      parsedRaw = JSON.parse(repairTruncatedJson(jsonStr));
      console.warn("[harmonizeAnalyzer] JSON repaired after truncation");
    } catch (e2) {
      console.warn("[harmonizeAnalyzer] JSON.parse failed even after repair", {
        err: String(e1), preview: jsonStr.slice(0, 200),
      });
      return [];
    }
  }

  // Validazione INDIVIDUALE per proposta (resilienza all-or-nothing)
  const rawObj = parsedRaw as Record<string, unknown>;
  const rawProposals = Array.isArray(rawObj?.proposals) ? rawObj.proposals : [];
  const validProposals: z.infer<typeof ProposalSchema>[] = [];
  let skipped = 0;
  for (const [i, rawP] of rawProposals.entries()) {
    const r = ProposalSchema.safeParse(rawP);
    if (r.success) {
      validProposals.push(r.data);
    } else {
      skipped++;
      console.warn(`[harmonizeAnalyzer] proposal #${i} skipped`, {
        firstIssue: r.error.issues[0],
        rawProposal: typeof rawP === "object" ? Object.keys(rawP as object) : typeof rawP,
      });
    }
  }
  if (skipped > 0) {
    console.warn(`[harmonizeAnalyzer] ${skipped}/${rawProposals.length} proposte scartate, ${validProposals.length} valide recuperate`);
  }

  return validProposals.map((p, idx): HarmonizeProposal => {
    // mapping invariato (linee 209-249 originali)
    // ...
  });
}
```

### File 4 — `src/v2/ui/pages/prompt-lab/harmonizer/harmonizerLibraryAnalyzer.ts`
Stessa logica `repairTruncatedJson` applicata a `parseExtended` (linee 205-243):

```ts
function parseExtended(raw: string, chunkIndex: number): {...} {
  const empty = { facts: [], conflicts: [], crossRefs: [] };
  const json = extractJsonObject(raw);
  if (!json) return empty;
  let parsedRaw: unknown;
  try { parsedRaw = JSON.parse(json); }
  catch {
    try { parsedRaw = JSON.parse(repairTruncatedJson(json)); }
    catch { return empty; }
  }
  // ... resto invariato
}
```

(Importare `repairTruncatedJson` da `harmonizeAnalyzer.ts` o duplicare localmente; preferibile esportarla.)

### File 5 — UI feedback toast su truncation
In `useHarmonizerLibraryIngestion.ts` (o equivalente), quando un chunk completa con N proposte recuperate dopo skip, mostrare toast informativo:
- Truncation detected → "Output AI troncato sul chunk #N: recuperate X proposte parziali"
- Skip Zod → "Y proposte scartate per validazione, Z accettate"

(Verifico hook esistente al momento dell'implementazione e aggiungo solo il logging side-effect dove c'è già infra toast.)

## Deploy

Edge function da ridistribuire: **`unified-assistant`** (consuma scopeConfigs + aiCallHandler).

## Verifica

Dopo il deploy, il prossimo run TMWE su Chunk #0 dovrebbe:
- Generare output completo (non più troncato a "fatti_canonici", "cu...")
- Anche se 1-2 proposte hanno enum sbagliati, le restanti 18-20 vengono salvate
- Log `[AI] empty content from model` con `truncated: true` se ricapita (segnale per alzare ulteriormente budget)

## Effetti collaterali

- Costo AI per chiamata kb-supervisor sale (output max 32K vs 8K). Accettato: le chunk TMWE sono dense, alternativa è split aggiuntivo lato collector che è più invasivo.
- Nessun impatto su altri scope (cockpit/contacts/import/extension/strategic): `maxTokens` resta `undefined` per loro e l'AI gateway userà il default del modello.

Approvi e procedo end-to-end?
