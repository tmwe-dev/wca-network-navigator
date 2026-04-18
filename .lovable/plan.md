

## Audit corretto: piano riallineato alla struttura reale

Il prompt originale assume KB entries con `category='sales_doctrine'` e chapter `§1-§11` (struttura "Robin CAT-XX") che **non esistono** nel database. Le entry reali hanno category `negoziazione`/`voice_rules`/`frasi_modello`/`followup`/`chiusura` con chapter testuali. Anche il workflow `lead_qualification` non esiste in `commercial_workflows`.

Riallineo il piano alle entry reali e ai file effettivi.

### SEZIONE 1 — Aggiornamenti KB entries esistenti (via tool insert/update)

**Entry reali individuate da aggiornare:**

| ID | Title | Chapter | Fix |
|----|-------|---------|-----|
| `2b97b116…` | Comandamenti 1-5 della negoziazione | 10 Comandamenti | Fix D — gate "applica solo da FASE 3+" |
| `1bd31ef8…` | Comandamenti 6-10 della negoziazione | 10 Comandamenti | Fix D — stesso gate |
| `b40d9d19…` | Chiusura e follow-up vocale | Chiusura | Fix E — gate "solo per negotiation+" + tag `holding_pattern` |
| `30eb70b7…` | Modello 2-3: Follow-up e Proposta (EN) | Email Modello | Fix B — modulazione tono follow-up #1/#2/#3 + tag `tone_modulation`, `relationship_progression` |
| `ebae6d08…` | Fase 3-5: Proposta, Obiezioni, Chiusura | Protocollo Vendita 5 Fasi | Fix E — gate chiusura |
| `506d7e7c…` | 5 modelli di chiusura | Tecniche di Chiusura | Fix E — gate "negotiation+" + tag `negotiation_technique` |

**Fix mancanti (entry inesistenti):** Cold Outreach, Regole tono, Cliente nervoso → da **creare ex-novo** come 3 nuove KB entries con il contenuto della dottrina, invece di tentare UPDATE su entry assenti.

### SEZIONE 2 — Workflow `lead_qualification` (non esiste)

Invece di UPDATE, **inserire** il workflow nuovo in `commercial_workflows` con i 6 gate mappati agli stati commerciali (Discovery→new, First Touch→first_touch_sent, Nurturing→holding, Engagement→engaged, Proposal→qualified, Closing→negotiation).

### SEZIONE 3 — `generate-outreach/promptBuilder.ts`

**Fix K — Anti-ripetizione:** aggiungere blocco condizionale nel `systemPrompt` (dopo riga 126, dentro il template) che si attiva quando `touchCount > 0` con istruzione "NON ripetere presentazione, riferirsi ai messaggi precedenti".

**Fix L — Guardrail WhatsApp primo contatto:** aggiungere blocco condizionale `ch === "whatsapp" && (!touchCount || touchCount === 0)` con avviso che vìola dottrina §4.

### SEZIONE 4 — `generate-email/promptBuilder.ts`

**Fix M — Phase awareness in `buildStrategicAdvisor`:** estendere la firma della funzione per accettare `commercialState` e `touchCount`, e iniettare nel blocco "## Contesto:" la fase + tone guide. Aggiornare la chiamata in `buildEmailPrompts` (riga 187-192) per passare i nuovi parametri.

### SEZIONE 5 — `_shared/sameLocationGuard.ts`

**Fix N — Mapping tassonomia:** estendere `RelationshipMetrics` con campo `commercial_state: "new" | "holding" | "engaged"`. Calcolare il mapping `cold→new, warm→holding, active→engaged, stale→holding, ghosted→holding` dopo il calcolo di `stage` (riga 232) e includerlo nel return (riga 247).

### Esecuzione

1. **Migration SQL** per UPDATE delle 6 entry esistenti + INSERT delle 3 nuove (Cold Outreach, Regole Tono, Cliente Nervoso) + INSERT del workflow `lead_qualification`.
2. **Edit** dei 3 file edge function (outreach promptBuilder, email promptBuilder, sameLocationGuard).
3. **Verifica** finale con grep + read sulle entry KB aggiornate.

### Note critiche

- I tag `holding_pattern`, `relationship_progression`, `tone_modulation`, `closing`, `negotiation_technique`, `reactivation` verranno aggiunti dove pertinenti via `array_append` con guardia `NOT (... = ANY(tags))`.
- Le 3 nuove entry useranno `category='sales_doctrine'` (categoria nuova, allineata alla Dottrina L0) con `priority=8` e `user_id=NULL` (globali).
- Nessuna modifica al sistema di caricamento KB (già gestito da L0/L1).

