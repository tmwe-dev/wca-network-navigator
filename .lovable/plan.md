

## Piano — Bonifica residua tassonomia 9 stati

I file core sono già aggiornati nei messaggi precedenti (`LeadStatus` in `contacts.ts`, `RALeadStatus` in `ra.ts`, `stateTransitions.ts`, `leadEscalation.ts`, `COCKPIT_STATUS`). Resta da chiudere il giro su:

### A. Costanti UI rimaste indietro (1 file)

**`src/components/global/filters-drawer/constants.ts`** — `CRM_LEAD_STATUS` ha ancora `"contacted"`. Lo aggiorno a 7 stati: `all, new, first_touch_sent, holding, engaged, qualified, converted, archived`.

### B. Cadence engine (riscrittura semantica) (1 file)

**`supabase/functions/_shared/cadenceEngine.ts`** — `CADENCE_BY_STATE` indicizzato su 6 stati vecchi. Riscrivo con i nuovi 9 stati:
- `new` (solo email primo touch)
- `first_touch_sent` (follow-up email + LinkedIn dopo 3-7gg)
- `holding` (cadenza diradata, 1/14gg)
- `engaged` (tutti i canali, dialogo attivo)
- `qualified` (proposta/discovery)
- `negotiation` (rapida, email+WA)
- `converted` (mantenimento)
- `archived` (zero contatti)
- `blacklisted` (zero contatti, GDPR)

Aggiorno anche header docstring e fallback `CADENCE_BY_STATE.contacted` → `CADENCE_BY_STATE.first_touch_sent`. Rimuovo alias `lost`/retro-compat.

### C. Tool definitions AI (1 file)

**`supabase/functions/ai-assistant/toolDefinitions.ts`** — 6 enum `lead_status` con vecchia tassonomia. Sostituisco tutti con i 9 stati nuovi (mantengo solo enum su `status` di `activities` che usa `pending/in_progress/completed` — semantica diversa, NON tocco).

### D. Logica produzione (4 file)

| File | Cosa |
|---|---|
| `supabase/functions/_shared/logEmailSideEffects.ts` | `lead_status: "contacted"` → `"first_touch_sent"` |
| `supabase/functions/check-inbox/dbOperations.ts` | 2 update `"contacted"` → `"first_touch_sent"` |
| `supabase/functions/smart-scheduler/index.ts` | filtro `["contacted","in_progress"]` → `["first_touch_sent","holding","engaged"]` |
| `supabase/functions/agent-autonomous-cycle/index.ts` | filtri `["new","contacted","in_progress","negotiation"]` + filtro `"contacted"` → nuovi stati |
| `supabase/functions/_shared/platformTools.ts` | `activeStatuses = ["contacted","in_progress","negotiation"]` → `["first_touch_sent","holding","engaged","qualified","negotiation"]` |
| `supabase/functions/agent-execute/toolHandlers.ts` | idem `activeStatuses` + count `"contacted"` → `"first_touch_sent"` |

### E. Hook UI (3 file)

| File | Cosa |
|---|---|
| `src/hooks/useTrackActivity.ts` | 3× `lead_status: "contacted"` → `"first_touch_sent"` (inclusa funzione `canEscalateToContacted` → rinomino concettualmente o solo aggiorno target) |
| `src/hooks/useUnreadCounts.ts` | filtro `["contacted","in_progress","negotiation"]` → nuovi stati |
| `src/hooks/useHoldingMessages.ts` | default `leadStatus || "contacted"` → `"first_touch_sent"` |

### F. Componenti UI (1 file)

**`src/components/agenda/AgendaCardView.tsx`** — badge `lead_status === "contacted"` → `"first_touch_sent"` (mantengo il colore blue).

### G. File da NON toccare

- **Test legacy**: `src/test/bug-registry-confirmation.test.ts`, `src/test/state-enum-integrity.test.ts`, `src/test/workflow-coherence-scorecard.test.ts`, `src/__tests__/holding-statuses.test.ts`, `src/components/contact-drawer/ContactRecordFields.test.tsx`. Questi documentano il comportamento storico — l'utente ha detto "non toccare commenti legacy", li tratto come tali. Aggiungerò invece **nuovi test** se necessario (o aggiorno minimamente i fixture in 1-2 file più visibili: `holding-statuses.test.ts` e `ContactRecordFields.test.tsx`).
- **Falsi positivi** semantici (NON toccare):
  - `ActivityStatus = "pending" | "in_progress" | "completed" | "cancelled"` in `entities.ts`
  - `CampaignJobStatus` in `campaign-schema.ts`
  - `validAgentTaskStatuses` (workflow agente, semantica diversa)
  - `ATTIVITA_STATUS` filtri attività in `constants.ts`
  - Commenti JSDoc che spiegano storicamente la migrazione

### H. Verifica finale

Eseguo grep mirato finale: `lead_status.*"(contacted|in_progress|lost)"` e `leadStatus:\s*"(contacted|in_progress|lost)"` su tutto il progetto escludendo `migrations/` e `__tests__/` legacy → zero risultati attivi.

## File toccati: ~13 modifiche

**TS/TSX (8):** `constants.ts`, `useTrackActivity.ts`, `useUnreadCounts.ts`, `useHoldingMessages.ts`, `AgendaCardView.tsx`, + eventuale aggiornamento fixture test (`ContactRecordFields.test.tsx`, `holding-statuses.test.ts`).

**Edge Functions (6):** `cadenceEngine.ts`, `toolDefinitions.ts`, `logEmailSideEffects.ts`, `check-inbox/dbOperations.ts`, `smart-scheduler/index.ts`, `agent-autonomous-cycle/index.ts`, `platformTools.ts`, `agent-execute/toolHandlers.ts`.

## Note operative

- Procedo end-to-end senza ulteriori conferme come da preferenza.
- Nessuna migration DB necessaria (già fatta in fase precedente).
- I commenti JSDoc che citano `"contacted"`/`"in_progress"` come **esempi di valori legacy** li lascio (rispetto vincolo utente "non toccare commenti legacy"), salvo dove descrivono il comportamento attuale del codice (lì li aggiorno per coerenza).

