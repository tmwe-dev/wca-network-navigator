

## Piano: Dottrina Commerciale L0 + Integrazione Sistema

Implementazione in 7 parti, tutte verificate sui file reali del progetto.

### PARTE A — Migration SQL: 6 KB Entries Dottrinali (system_doctrine, priority 10, tag `system_core`)

Nuovo file `supabase/migrations/<timestamp>_dottrina_commerciale_l0.sql` con 6 INSERT in `kb_entries`:
1. **§1 LEGGE FONDAMENTALE** — Circuito di Attesa (tassonomia stati, regole inviolabili, mapping con `lead_status`)
2. **§2 PROGRESSIONE RELAZIONALE** — 5 fasi sconosciuto→referente, modulazione tono, warmth_score
3. **§3 DOTTRINA USCITE** — converted/archived/blacklisted con motivi validi/non validi
4. **§4 DOTTRINA MULTI-CANALE** — matrice canale×fase, regole email/LI/WA/telefono
5. **§5 APPRENDIMENTO COMMERCIALE** — cosa salvare, mutazione profilo, segnali
6. **§6 KB SUPERVISOR** — 3 livelli di calibrazione (strutturale/logica/strategica)

Tutti con `user_id=NULL` (globali), `category='system_doctrine'`, `priority=10`, `is_active=true`, tag include `system_core` → caricamento automatico via `loadKBContext` LEVEL 0 (già presente in `contextLoader.ts:139-140`).

### PARTE B — `supabase/functions/ai-assistant/systemPrompt.ts`

- **Riga 41-42**: tradurre Golden Rules #7 e #8 in italiano (INTELLIGENCE PRE-AZIONE, PERSONALIZZAZIONE OBBLIGATORIA)
- **Aggiungere costante `COMMERCIAL_DOCTRINE`** prima di `KB_LOADING_INSTRUCTION`
- **Riga 61-67**: aggiungere `COMMERCIAL_DOCTRINE` nell'array `parts` tra `GOLDEN_RULES` e `KB_LOADING_INSTRUCTION`

### PARTE C — `supabase/functions/_shared/contextTagExtractor.ts`

Sostituire il blocco `relationship_stage` (righe 62-65) con logica estesa che:
- Aggiunge categoria `system_doctrine` e tag `commercial_doctrine`
- Mappa stage → tag specifici tramite `stageTagMap` (new, contacted, holding, engaged, qualified, negotiation, converted)

### PARTE D — `supabase/functions/ai-assistant/index.ts` + `contextLoader.ts`

Nel file `index.ts` intorno alla riga 365 (subito dopo `extractContextTags`):
- Se `conversationContext.partner_id` è presente, fetch async di `partners` (lead_status, last_interaction_at, interaction_count)
- Costruire `holdingContextBlock` con stato + giorni stagnazione + warning >30/>90 giorni
- Aggiungere il blocco a `contextBlocks` (riga 398-406) con `key:"holding_state", priority:90`

### PARTE E — `supabase/functions/generate-outreach/promptBuilder.ts` + `contextAssembler.ts`

**promptBuilder.ts**: estendere `OutreachPromptContext` con `commercialState, touchCount, lastChannel, lastOutcome, daysSinceLastContact, warmthScore`. Aggiungere `commercialBlock` nel `userPrompt` prima del GOAL con istruzioni tono dinamiche basate su touchCount e warmthScore.

**contextAssembler.ts**: in `assembleOutreachContext` (vicino riga 203 dove c'è già `partnerId`), leggere `partners.lead_status, interaction_count, last_interaction_at` e ritornare i nuovi campi nell'oggetto `OutreachContextBlocks`.

### PARTE F — `supabase/functions/generate-email/promptBuilder.ts` + `contextAssembler.ts`

Stesso pattern di Parte E:
- Estendere `EmailPromptContext` con i 6 campi commerciali
- Inserire `commercialBlock` nel `userPrompt` prima di `GOAL DELLA COMUNICAZIONE` (riga 240)
- In `contextAssembler.ts` leggere stato commerciale dal `partner` già caricato (è in `loadStandalonePartner` riga 143 — `lead_status` già selezionato) e calcolare giorni

### PARTE G — `supabase/functions/agent-execute/index.ts`

Aggiungere const `commercialDoctrine` (DOTTRINA COMMERCIALE LEGGE SUPREMA, 8 regole per agenti) prima del blocco "I TUOI CLIENTI ASSEGNATI" (riga ~150) e iniettarla in `contextBlock`. Verrà inclusa automaticamente in `assembleContext` (riga 407) tramite un nuovo blocco `{ key: "commercial_doctrine", content: commercialDoctrine, priority: 98, minTokens: 300 }`.

### Verifica finale

Dopo l'implementazione, eseguire i grep di verifica del prompt (A-I) per confermare:
- 6 entries `Dottrina Commerciale §X` nella migration
- `COMMERCIAL_DOCTRINE`/`MACCHINA COMMERCIALE` in systemPrompt.ts
- Regole 7-8 tradotte (INTELLIGENCE PRE-AZIONE, PERSONALIZZAZIONE OBBLIGATORIA)
- `commercial_doctrine` + `stageTagMap` in contextTagExtractor.ts
- `holding_state` / `daysInHolding` / `STATO COMMERCIALE` in contextLoader/index ai-assistant
- `commercialState`/`touchCount`/`STATO COMMERCIALE` in entrambi i promptBuilder
- `DOTTRINA COMMERCIALE`/`LEGGE SUPREMA` in agent-execute
- `tsc --noEmit --skipLibCheck` senza errori

### Note tecniche

- Le KB entries L0 vengono caricate automaticamente da `loadKBContext` LEVEL 0 (già implementato) perché matchano `category='system_doctrine'` + `tags overlaps ['system_core']`
- Il blocco `holding_state` ha priority 90 (sopra profilo, sotto dottrina KB 100)
- Nessuna modifica a `client.ts`, `types.ts`, `config.toml`
- Nessuna nuova edge function — solo estensioni a quelle esistenti
- Tassonomia `lead_status` esistente preservata (mapping documentato in §1)

