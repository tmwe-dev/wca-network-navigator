

## Diagnosi

Conferma dal DB (12.286 partner totali):
- `profile_description`: **12.268 valorizzati** (≈ 99.85%)
- `raw_profile_html`: 0
- `raw_profile_markdown`: 0
- `ai_parsed_at`: 0

I tre campi vuoti erano alimentati dal **vecchio scraper client-side** (Claude Engine V8 / wca-app). Oggi i dati arrivano dalla tabella esterna sincronizzata, che popola `profile_description` direttamente. Quindi:

- "**has_profile**" calcolato come `raw_profile_html IS NOT NULL` → sempre falso → AI dice "0 profili scaricati".
- Tool `create_download_job`, `download_single_partner`, modalità `no_profile` → riferiti a un workflow morto.
- Suggerimento "scarica profili → arricchirà i 1.080 record" → falso, i record sono già pieni.

## Strategia: 3 livelli

### Livello 1 — Ridefinire "has_profile" sul campo giusto

Cambio la sorgente di verità da `raw_profile_html` a `profile_description`. Touchpoint:

1. `supabase/functions/_shared/toolHandlersRead.ts`
   - `has_profile === true/false` → filtra su `profile_description IS [NOT] NULL`.
   - Output `has_profile` → `!!p.profile_description`.
   - `profile_summary` → usa `profile_description` se `raw_profile_markdown` assente.
2. `supabase/functions/_shared/platformTools.ts` (interface `CountryStatRow`).
3. `supabase/functions/ai-assistant/toolDefinitions.ts` → descrizione `has_profile`: "Has profile description (sourced from WCA sync)".
4. `src/hooks/usePartnerListStats.ts` → `withProfile` conta `profile_description`, `emailVerified/phoneVerified` non dipendono più da `raw_profile_html`.
5. Eventuali viste DB / RPC `get_country_stats` se calcolano `with_profile` sul campo vecchio (verifico in migration).

### Livello 2 — Disattivare i tool di download bulk dall'AI

I dati arrivano via sync esterno, l'AI non deve più orchestrare scraping. 

- `supabase/functions/ai-assistant/toolDefinitions.ts`: **rimuovo** `create_download_job` e cambio `download_single_partner` in tool `enrich_partner_profile` (scope: integrazione mirata via Partner Connect quando un singolo record è incompleto). Modalità `no_profile` rimossa.
- `supabase/functions/agent-execute/toolDefs.ts`: stessa potatura.
- `src/data/agentTemplates/roles.ts` e `src/v2/hooks/useAgentCapabilities.ts`: tolgo `create_download_job` dalle capability; resta `sync_wca_partners` (manuale) per gli admin.
- `src/data/agentTemplates/templates.ts` → "Agente Download" rinominato "Agente Sync & Verifica" con prompt allineato al nuovo flusso (sync → deep search → classificazione, **niente download**).

I componenti UI di download (WCAScraper, Download Center) **non li tocco**: sono usati per il sync manuale degli admin. Solo l'AI smette di proporli.

### Livello 3 — KB doctrine: dati già presenti

Aggiungo una entry `kb_entries` categoria `doctrine`:

- **`doctrine/data-availability`** — "I partner WCA arrivano già completi via sync esterno: profile_description, email, phone sono valorizzati per ≥99% dei record. NON proporre mai 'scarica profili' o 'arricchisci i record con i dettagli WCA'. Workflow validi su un partner: deep search (sito + social + LinkedIn), AI classification, alias generation, enrichment cross-network. Se mancano `profile_description` per <1% dei record → usa `enrich_partner_profile` su quel singolo ID."

Inietto questa entry come `criticalProcedures` nei core prompt: `luca`, `super-assistant`, `cockpit-assistant`, `contacts-assistant`. L'AI vedrà la regola inline, non solo nell'indice KB.

Aggiorno anche:
- `src/v2/agent/prompts/core/luca.ts` → guardrail soft "Mai suggerire download bulk: i dati WCA arrivano via sync."
- `supabase/functions/ai-assistant/index.ts` linea 442 → `filterMode no_profile` → label aggiornata o rimossa.
- `src/components/intelliflow/overlay/useIntelliFlowOverlay.ts` linea 36 → suggerimenti rotta Network: rimuovo "Scarica tutti i partner / Aggiorna profili mancanti", aggiungo "Deep search USA / Classifica per servizio / Verifica email USA".

## File toccati (sintesi)

**Edge functions (5)**
1. `supabase/functions/_shared/toolHandlersRead.ts` — has_profile su profile_description
2. `supabase/functions/_shared/platformTools.ts` — interface stats
3. `supabase/functions/ai-assistant/toolDefinitions.ts` — rimuovo create_download_job, ridefinisco download_single_partner
4. `supabase/functions/agent-execute/toolDefs.ts` — stessa potatura
5. `supabase/functions/ai-assistant/index.ts` — labels filterMode

**Client (5)**
6. `src/hooks/usePartnerListStats.ts` — sorgente profilo
7. `src/data/agentTemplates/roles.ts` — capability ridotte
8. `src/data/agentTemplates/templates.ts` — Agente Download → Sync & Verifica
9. `src/v2/hooks/useAgentCapabilities.ts` — capability ridotte
10. `src/components/intelliflow/overlay/useIntelliFlowOverlay.ts` — suggerimenti Network

**Prompt + KB (3)**
11. `src/v2/agent/prompts/core/luca.ts` (+ super/cockpit/contacts) — guardrail soft
12. `src/data/agentPrompts.ts` — aggiungo `doctrine/data-availability` ai criticalProcedures dei 4 agenti
13. **Migration DB** — INSERT in `kb_entries` la nuova entry doctrine

**NON tocco**
- `WCAScraper`, `Download Center`, `useWcaJobs`, `sync-wca-partners` (uso admin manuale).
- Schema DB `partners` (i campi vecchi restano per analytics storica).
- Hard guards / auth / pannelli UI principali.

## Verifica post-implementazione

1. Query `partners US` → riassunto mostra "1.078 con profilo (sync WCA)" non "0 scaricati".
2. AI **non suggerisce più** "Vuoi scaricare i profili?" come azione.
3. Suggerimenti su `/network` aggiornati (no "Aggiorna profili mancanti").
4. `tsc --noEmit` pulito.
5. Smoke test su LUCA: "mostra partner US" → output corretto + azioni suggerite valide (deep search / filtro città / alias / classificazione servizi).
6. Hard guards intatti: tentativo `DELETE` da AI ancora bloccato.

