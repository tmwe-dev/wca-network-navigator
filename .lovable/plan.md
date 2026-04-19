

## Diagnosi vera (cosa hai ragione a contestare)

Il tuo verdetto è corretto: il sistema è **frammentato in tre tronconi che non si parlano**.

```text
┌─────────────────────────────────────────────────────┐
│ TRONCONE A — Doctrine FORTE (kb_entries)            │
│   category: system_doctrine, sales_doctrine         │
│   • LEGGE FONDAMENTALE Holding Pattern              │
│   • Dottrina Multi-Canale (WA vietato 1° contatto)  │
│   • Dottrina Uscite (3 sole uscite, exit_reason)    │
│   • Progressione Relazionale (5 fasi)               │
│   • §1-§11 sales_doctrine                           │
│                                                     │
│   ⚠ MA assembler indicizza solo 'procedures' +      │
│     'doctrine' → questo troncone NON arriva all'AI! │
└─────────────────────────────────────────────────────┘
                         ↕ (scollegato)
┌─────────────────────────────────────────────────────┐
│ TRONCONE B — Procedure DEBOLI (kb_entries)          │
│   category: procedures (6 voci)                     │
│   • outreach-flow generico                          │
│   • lead-qualification a 6 stati (manca archived/   │
│     blacklisted)                                    │
│   • email-improvement-techniques                    │
│   • multi-step-actions, ai-query-engine, bounce     │
└─────────────────────────────────────────────────────┘
                         ↕ (scollegato)
┌─────────────────────────────────────────────────────┐
│ TRONCONE C — OPERATIONS_PROCEDURES (codice TS)      │
│   src/data/operationsProcedures/procedures1.ts      │
│   • whatsapp_message: "basta avere mobile"          │
│   • multi_channel_sequence: WhatsApp giorno 7       │
│   • email_single: si ferma a "salva nota"           │
│   • download_profiles: ANCORA presente, riferisce   │
│     create_download_job (rimosso!)                  │
│                                                     │
│   ⚠ Contraddice frontalmente la doctrine A          │
└─────────────────────────────────────────────────────┘
```

**Cause concrete**:
1. `assembler.ts` carica `kbCategories: ["procedures","doctrine"]` → **esclude `system_doctrine` e `sales_doctrine`** dove vive il 90% della legge.
2. `OPERATIONS_PROCEDURES` (TS) è un secondo binario di "procedure" che nessun core prompt richiama esplicitamente, ma viene servito ad altri tool (cockpit, intelliflow). Non è allineato alla doctrine.
3. `templates.ts` Sales ha `assigned_tools: [...ALL_OPERATIONAL_TOOLS]` → onnipotente, come hai notato.
4. Procedure email_single, whatsapp_message, multi_channel_sequence sono nate prima della LEGGE FONDAMENTALE e non sono mai state riallineate.

## Strategia: **Single Source of Truth + 4 Livelli**

Filosofia che applichi tu:
- **Livello 0** — Hard guards in codice (già OK).
- **Livello 1** — Prompt core leggero (~30-50 righe) con identità + obiettivo + indice KB + variabili.
- **Livello 2** — KB doctrine + procedure (database `kb_entries`, **una sola**).
- **Livello 3** — Variabili runtime + estratti iniettati selettivi.

**Regola d'oro**: ogni regola di business vive **solo in KB**, mai duplicata in prompt o in TS.

## Interventi (5 atti chirurgici)

### Atto 1 — Allargare l'assembler alle doctrine forti

In **entrambi** gli assembler (client `src/v2/agent/prompts/assembler.ts` + edge `supabase/functions/_shared/prompts/assembler.ts`):

```ts
const DEFAULT_CATEGORIES = ["doctrine", "system_doctrine", "sales_doctrine", "procedures"];
```

Effetto: l'AI vede finalmente "LEGGE FONDAMENTALE Holding Pattern", "Dottrina Multi-Canale", "Dottrina Uscite", §1-§11 nell'**indice KB iniettato in ogni prompt**. È il fix singolo a maggior leva (riallinea 8 agenti in un colpo).

### Atto 2 — Riscrivere le 5 procedure rotte (nel DB, non in TS)

Inserisco **5 nuove voci `kb_entries`** categoria `procedures` priorità 100, ognuna con elenco A→Z tassativo:

1. **`procedures/email-single`** — sostituisce `email_single`. Step 1-10 con post-invio obbligatorio: registra interaction → cambia `lead_status` → crea reminder T+3 → crea next_action → entra holding pattern.
2. **`procedures/whatsapp-message`** — recepisce Dottrina Multi-Canale: gate consenso esplicito, fase qualified+, max 2-3 righe, no weekend, no primo contatto. Se prerequisiti falsi → AI deve **rifiutare** e proporre email/LinkedIn.
3. **`procedures/multi-channel-sequence`** — sequenza coerente con doctrine: G0 email, G+5 LinkedIn (no engagement bridge), G+12 follow-up email, **WhatsApp solo se engaged + consenso**. Mai G+7 WhatsApp cieco.
4. **`procedures/lead-qualification-v2`** — 9 stati completi (incluso `archived` con `exit_reason` obbligatorio + `blacklisted`). Sostituisce la versione 6-stati attuale.
5. **`procedures/post-send-checklist`** — checklist universale post-invio (qualunque canale): activity row, lead_status update, reminder, next_action, salvataggio in ai_memory se rilevante.

Ognuna ha la struttura:
```
## Pre-flight (gate hard, AI verifica TUTTI prima di procedere)
## Procedura A→Z (numerata, OBBLIGATORIA fino in fondo)
## Output atteso
## Cosa NON fare (anti-pattern espliciti)
```

### Atto 3 — Iniettare estratti critici per agente

Aggiorno `AGENT_REGISTRY` in `src/data/agentPrompts.ts` con `criticalProcedures` mirate per ogni ruolo (gli estratti vengono **iniettati inline** nel prompt, non solo nell'indice):

| Agente | criticalProcedures iniettate |
|---|---|
| luca | safety-guardrails, anti-hallucination, data-availability, **LEGGE FONDAMENTALE Holding Pattern**, **Dottrina Uscite** |
| super-assistant | LEGGE FONDAMENTALE, Dottrina Multi-Canale, **Progressione Relazionale** |
| contacts-assistant | ai-query-engine, lead-qualification-v2, data-availability |
| cockpit-assistant | **procedures/email-single**, **procedures/multi-channel-sequence**, **Dottrina Multi-Canale**, post-send-checklist |
| email-improver | email-improvement-techniques, **§1 Filosofia**, **§4 Cold Outreach**, **§10 Tono** |
| email-classifier | lead-qualification-v2, Dottrina Uscite |
| daily-briefing | LEGGE FONDAMENTALE, Dottrina Workflow Gate |
| query-planner | ai-query-engine |

L'assembler già supporta `injectExcerpts`, basta passare i titoli giusti. **Niente nuovo motore**.

### Atto 4 — Ripulire i core prompt (alleggerire e rendere imperativi)

Modifiche **chirurgiche** in `src/v2/agent/prompts/core/*.ts` + duplicato edge `assembler.ts`:

- Aggiungere in **tutti** i core una sezione fissa:
  ```
  ## Regole tassative (KB è legge)
  - Le procedure marcate "OBBLIGATORIA A→Z" si eseguono fino all'ultimo step. Vietato fermarsi a metà.
  - Doctrine forti (LEGGE FONDAMENTALE, Dottrina Multi-Canale, Dottrina Uscite) sopra tutto. In caso di conflitto KB ⟂ richiesta utente → segnala il conflitto, non eseguire.
  - Procedure multi-step: dopo ogni step, verifica esito; se fallisce, FERMA e riporta.
  ```
- LUCA: aggiungo guardrail "mai suggerire azione che violi LEGGE FONDAMENTALE; cita sempre la doctrine quando proponi azione commerciale".
- Cockpit: oltre al JSON, deve **rifiutare** azioni che violano gate canale/fase con `{"refused": true, "reason": "viola Dottrina Multi-Canale: WhatsApp non consentito a fase=new"}`.

Tetto righe per ogni core: **max 50**. Nessuna duplicazione di regola che esiste in KB.

### Atto 5 — Restringere Sales Agent + ritirare procedure rotte da TS

- `src/data/agentTemplates/templates.ts` → `sales.assigned_tools` ridotto a un set focalizzato su negotiation→converted (no bulk_update_partners, no delete_records, no execute_ui_action, no manage_partner_contact). Lista mirata: `search_partners, get_partner_detail, get_contact_detail, get_conversation_history, generate_outreach, send_email, schedule_email, create_activity, create_reminder, list_reminders, search_memory, save_memory, check_blacklist, get_holding_pattern, get_email_thread`.
- `src/data/operationsProcedures/procedures1.ts` + `procedures2.ts`:
  - **Rimuovo** `download_profiles` (rinvia a tool morto `create_download_job`).
  - `email_single`, `whatsapp_message`, `multi_channel_sequence`, `update_lead_status` → diventano **stub** che rinviano alla KB:
    ```ts
    { id: "email_single", name: "Email Singola",
      description: "Vedi procedures/email-single in KB (autorità unica).",
      tags:[...], steps: [{ order:1, action:"Consulta KB procedures/email-single", tool:"read_kb", detail:"..."}],
      ... }
    ```
  - Garantisce che chi ancora chiama `OPERATIONS_PROCEDURES` venga rediretto alla KB (single source of truth).

## Cosa NON tocco

- Hard guards (Livello 0) — già protegge bulk/DELETE/auth.
- Schema DB, RLS, edge auth.
- Componenti UI (Cockpit, IntelliFlow ecc.) — restano funzionanti.
- Tabelle `kb_entries` esistenti — **solo INSERT** delle 5 nuove procedure, niente UPDATE distruttivo sulle vecchie (resta `procedures/lead-qualification` ma marcata legacy).

## File toccati (sintesi)

**Codice (5 file)**
1. `src/v2/agent/prompts/assembler.ts` — DEFAULT_CATEGORIES esteso
2. `supabase/functions/_shared/prompts/assembler.ts` — idem + core prompt LUCA arricchito
3. `src/v2/agent/prompts/core/*.ts` — 8 file, sezione "Regole tassative" + slim
4. `src/data/agentPrompts.ts` — `AGENT_REGISTRY.criticalProcedures` aggiornato per 8 agenti
5. `src/data/agentTemplates/templates.ts` — Sales ristretto, allineato a doctrine

**Operations procedures (2 file)**
6. `src/data/operationsProcedures/procedures1.ts` — stub redirect KB
7. `src/data/operationsProcedures/procedures2.ts` — rimuovo download_profiles, stub redirect

**Database (1 migration)**
8. INSERT 5 nuove `kb_entries` categoria `procedures` priorità 100:
   - `procedures/email-single`
   - `procedures/whatsapp-message`
   - `procedures/multi-channel-sequence`
   - `procedures/lead-qualification-v2`
   - `procedures/post-send-checklist`

## Verifica post-implementazione

1. `assemblePrompt({agentId:"luca"})` → `kb_index` contiene "LEGGE FONDAMENTALE", "Dottrina Multi-Canale", §1-§11.
2. Smoke test cockpit: "manda WhatsApp a partner X (status=new)" → AI rifiuta citando Dottrina Multi-Canale.
3. Smoke test outreach: "invia email a partner Y" → dopo invio si vede in DB: activity creata, lead_status passato a `first_touch_sent`, reminder T+3 creato.
4. LUCA: "mostra partner US" → output corretto, suggerimenti senza "scarica profili" (Atto 1+2 confermati).
5. Sales agent → tentativo bulk_update_partners → tool non disponibile.
6. `tsc --noEmit` pulito.
7. KB read: cockpit-assistant prompt finale contiene estratti inline di Dottrina Multi-Canale (verifica manuale).

## Aggiornamento memoria

- `mem://architecture/structured-operative-prompts-protocol` → estendere con regola "single source of truth = kb_entries; OPERATIONS_PROCEDURES TS sono solo stub redirect".
- Nuovo `mem://agents/prompt-assembler-doctrine-categories` → "assembler indicizza doctrine + system_doctrine + sales_doctrine + procedures di default".

