

# Fase 3: Consolidamento 13 Edge Functions AI → 5 con Routing Interno

## Mappatura attuale → destinazione

```text
FUNZIONE ATTUALE              LOC    → MACRO-FUNZIONE          SCOPE/ACTION
─────────────────────────────────────────────────────────────────────────────
ai-assistant                  3806   → unified-assistant       scope:"partner_hub"
cockpit-assistant              176   → unified-assistant       scope:"cockpit"
contacts-assistant             325   → unified-assistant       scope:"contacts"
import-assistant               324   → unified-assistant       scope:"import"
extension-brain                158   → unified-assistant       scope:"extension"
super-assistant                223   → unified-assistant       scope:"strategic"

generate-email                 888   → generate-content        action:"email"
generate-outreach              577   → generate-content        action:"outreach"
improve-email                  159   → generate-content        action:"improve"
analyze-email-edit             163   → generate-content        action:"analyze_edit"

daily-briefing                 251   → ai-utility              action:"briefing"
categorize-content              95   → ai-utility              action:"categorize"
ai-deep-search-helper           85   → ai-utility              action:"deep_search"

agent-execute                  ——    → INVARIATO (standalone)
agent-autonomous-cycle         ——    → INVARIATO (standalone)
```

## Strategia: Facade + proxy (zero downtime)

Le 3 nuove macro-funzioni (`unified-assistant`, `generate-content`, `ai-utility`) ricevono un campo `scope` o `action` nel body e fanno routing interno alla logica corretta. Le 13 funzioni originali vengono convertite in **proxy di 10 righe** che richiamano la macro-funzione iniettando il campo di routing. Questo garantisce:
- Zero breaking changes lato client (tutti i 15+ call-site continuano a funzionare)
- Migrazione graduale dei call-site al nuovo naming
- Deploy indipendente

## File da creare

### 1. `supabase/functions/unified-assistant/index.ts` (~200 LOC)
- Riceve `body.scope` (partner_hub | cockpit | contacts | import | extension | strategic)
- Carica il system prompt corretto per lo scope
- Istanzia i tool handler condivisi (platformTools, toolHandlers*)
- Chiama AI Gateway con tool-calling
- Le logiche specifiche di ogni ex-funzione (system prompt, tool set, response format) diventano moduli in `_shared/assistantScopes/`

### 2. `supabase/functions/_shared/assistantScopes.ts` (~400 LOC)
- Esporta `getScopeConfig(scope)` → `{ systemPrompt, tools, responseFormat }`
- Contiene i 6 system prompt (estratti dalle funzioni originali) e la configurazione tool per ogni scope

### 3. `supabase/functions/generate-content/index.ts` (~150 LOC)
- Riceve `body.action` (email | outreach | improve | analyze_edit)
- Routing a 4 handler interni
- Le logiche di generate-email (888 LOC) e generate-outreach (577 LOC) vengono estratte in `_shared/contentGenerators.ts`

### 4. `supabase/functions/_shared/contentGenerators.ts` (~600 LOC)
- `handleGenerateEmail(body, supabase)` — logica estratta da generate-email
- `handleGenerateOutreach(body, supabase)` — logica estratta da generate-outreach
- `handleImproveEmail(body, supabase)` — logica estratta da improve-email
- `handleAnalyzeEdit(body, supabase)` — logica estratta da analyze-email-edit

### 5. `supabase/functions/ai-utility/index.ts` (~80 LOC)
- Riceve `body.action` (briefing | categorize | deep_search)
- Routing ai 3 handler, logica inline (sono funzioni piccole: 251+95+85 LOC)

### 6. Proxy delle 13 funzioni originali (~10 LOC ciascuna)
Ogni funzione originale diventa un proxy:
```typescript
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const body = await req.json();
  body.scope = "partner_hub"; // o action = "email", etc.
  const resp = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/unified-assistant`, {
    method: "POST",
    headers: { ...Object.fromEntries(req.headers), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return new Response(resp.body, { status: resp.status, headers: Object.fromEntries(resp.headers) });
});
```

## File client da aggiornare (opzionale, fase successiva)
Nessun file client cambia in questa fase. I proxy garantiscono retrocompatibilità. In una fase futura i 15 call-site potranno essere migrati al nuovo naming.

## Ordine di esecuzione
1. Creare `_shared/assistantScopes.ts` e `_shared/contentGenerators.ts`
2. Creare le 3 macro-funzioni (`unified-assistant`, `generate-content`, `ai-utility`)
3. Convertire le 13 funzioni originali in proxy
4. Deploy e test con `curl_edge_functions`
5. Aggiornare test `edgeFunctionDecomposition.test.ts`

## Rischio
Basso. Le funzioni originali diventano proxy trasparenti — se qualcosa non funziona, basta ripristinare il codice originale nella singola funzione. Il client non cambia.

