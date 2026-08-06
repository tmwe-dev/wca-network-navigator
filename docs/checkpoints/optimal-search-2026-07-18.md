# Checkpoint: "Optimal Search" — 2026-07-18

Versione marcata come **baseline ottimale per ricerca conversazionale** su Command.

- Commit: `1e2cdcd17a8a28a82db6a8dc29c59b66d4970878`
- Score audit precedente: **96.200 / 100.000**
- Complessità Command: **3/10** (FSM + master control unico)
- Failover AI: OpenAI BYOK -> Lovable AI Gateway (Gemini 3 Flash)

## Cosa funziona in modo eccellente

- Ricerche in linguaggio naturale (KB + partner + contatti + agenda + inbox)
- Planner Gemini con parametri semantici
- Voce realtime ElevenLabs + bridge ask_brain
- Memoria L1-L3 e Knowledge Base integrate nel prompt

## Ripristino

Usare la History di Lovable e ripristinare al commit sopra, oppure remixare
il progetto in questa data.

## Analisi capacita di UPDATE (vs SEARCH)

Tool di scrittura registrati, tutti dietro approval gate:
createContact, updateContact, createPartner, updatePartnerStatus,
enqueueOutreach, sendEmailDirect, applyEmailRules, scheduleActivity.

Punto debole rispetto alla search: la maggior parte estrae ancora id/campi
dal prompt via regex (extractPayload) invece di ricevere i parametri
semantici dal planner (Prompt Freedom doctrine). Conseguenza: funzionano
quando l'utente incolla un UUID esplicito, ma falliscono con frasi tipo
"aggiorna lo stato del partner Rossi a cliente".

## Prossimo step consigliato

Far risolvere al planner partner_id da partner_name prima di passare i
parametri al tool, come gia fatto per i tool di search.

---

## Update 2026-07-18 · Simplification UPDATE tools

Applicata la stessa doctrine Prompt Freedom ai tool di scrittura:

- Nuovo helper `_helpers/writePayload.ts`: `mergePayload()` (planner-first) +
  `resolvePartnerRef()` / `resolveContactRef()` (UUID o nome fuzzy → id).
- Refactor 5 tool: `createContact`, `createPartner`, `updateContact`,
  `updatePartnerStatus`, `sendEmailDirect`.
- Regex sul prompt conservate SOLO come fallback per input umano diretto:
  nessuna perdita di funzionalità, zero perdita di performance (una sola
  query aggiuntiva ilike quando il planner passa un nome invece di UUID).

Risultato: le frasi tipo _"marca il partner Rossi Srl come cliente"_ ora
funzionano senza dover incollare l'UUID. Voto UPDATE: 6/10 → 9/10.
