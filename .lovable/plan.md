

## Stato verificato (non supposizione, ho letto il codice)

REPAIR-K è completamente applicato a runtime. Verifica puntuale:

| Fix | File | Riga | Stato |
|---|---|---|---|
| K1 | `_shared/cadenceEngine.ts` | 7 stati + sequence + checkCadence + getNextEngagementStep | ✔ presente |
| K2 | `_shared/stateTransitions.ts` | TRANSITION_GATES + evaluateTransitions + applyTransition | ✔ presente |
| K3 | `generate-outreach/index.ts:16,108-132` | import checkCadence, hasWhatsAppConsent, 422 cadence_violation, log CADENCE_VIOLATION | ✔ presente |
| K4 | `agent-autonomous-cycle/index.ts:5-6,267,283,303,359,378` | import K1+K2, Phase 2.5 con state_transition + sequence_step | ✔ presente |
| K5 | `agent-execute/index.ts:121-141` | cadenceBlock iniettato in contextBlock | ✔ presente |
| K6 | `agent-execute/index.ts:570-618` | handler `state_transition` + `sequence_step` | ✔ presente |

## Differenza vs prompt che mi hai inviato

Il tuo prompt usa la tassonomia **`first_touch_sent / holding / engaged / qualified / archived`**.
Il codice in produzione usa la tassonomia **canonica del DB**: `new / contacted / in_progress / negotiation / converted / lost / archived`.

Questo NON è un fix mancato — è una correzione strutturale che abbiamo deciso e applicato nel turno scorso ("Correzione strutturale REPAIR-K") proprio perché:

1. il DB e il resto del CRM (Kanban, filtri, lead scoring, status badges, RLS) usano gli stati canonici;
2. introdurre `first_touch_sent / holding / engaged / qualified` nello stato `lead_status` di `partners` avrebbe creato record invisibili ai filtri esistenti e rotto la pipeline visuale;
3. il piano correttivo precedente è stato approvato esplicitamente da te (context `8F42B1C3…`), non è una mia decisione unilaterale.

Riapplicare il prompt alla lettera ora:
- introdurrebbe nuovi `lead_status` non riconosciuti dal CRM;
- romperebbe i `STAGE_TAG_MAP` di `contextTagExtractor.ts` e `stateToTone` di `promptBuilder.ts` allineati alla tassonomia canonica;
- spegnerebbe Phase 2.5 perché `activePartners` non troverebbe più partner negli stati attesi.

## Cosa farò appena approvato

Una sola di queste due opzioni — chiedimi quale preferisci.

### Opzione A — verifica runtime e basta (raccomandata)

1. Re-deploy difensivo di `generate-outreach`, `agent-autonomous-cycle`, `agent-execute`.
2. Smoke test:
   - `generate-outreach` con parametri che violano cadenza → atteso `422 cadence_violation`;
   - `agent-autonomous-cycle` invocato → verifica che Phase 2.5 logghi proposte;
   - `agent-execute` con task fittizio `state_transition` → verifica handler.
3. Audit log K1–K6 con riga/file e esito test, identico al formato J1–J11.

Nessuna riga modificata. Risultato: certificazione runtime che K è davvero attivo.

### Opzione B — riallineare ALLA LETTERA al prompt

Sostituire la tassonomia canonica con quella del prompt (`first_touch_sent / holding / engaged / qualified`).

Implica:
- migration DB su `partners.lead_status` per ammettere i nuovi valori (oggi probabilmente vincolati da check constraint o enum);
- aggiornamento di Kanban, filtri, badge, lead scoring, `contextTagExtractor`, `promptBuilder`, e ogni RLS che filtra per stato;
- regressione semantica garantita su tutte le viste CRM finché ogni consumer non viene riallineato.

Costo alto, beneficio nullo rispetto ad A: la logica di cadenza e transizione funziona già, solo con etichette di stato diverse.

## File toccati

- Opzione A: solo redeploy. Zero scritture.
- Opzione B: ~10 file applicativi + migration DB. Scope da concordare.

## Risultato atteso

Fine del falso negativo "0/6 fix K applicati" con prova runtime, e decisione esplicita su tassonomia stati prima di toccare ancora il codice.

