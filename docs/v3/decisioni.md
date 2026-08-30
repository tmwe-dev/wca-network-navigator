# Fase 0.D — Foglio delle decisioni

Cosa entra nella V3 e cosa no. Finché questo foglio non è chiuso, non si scrive codice V3.

Stato: **BOZZA — in attesa delle 4 decisioni aperte (§3).**

---

## 1. Tengo — non si discute (il ciclo del messaggio)

Queste capacità hanno volume reale misurato o sono strutturali. Entrano nella V3 senza ulteriore verifica.

| # | Capacità | Motivo |
|---|---|---|
| 1 | Login whitelist + ruoli + operatore attivo | senza questo non si entra |
| 2 | Anagrafica contatti/partner + deduplica + soft-delete | è il dato |
| 3 | Holding pattern siblings | regola di business già consolidata |
| 4 | Ingest email IMAP (PEEK) + cartelle + allegati + stato sync | 22.164 eventi |
| 5 | Contesto conversazione | 15.330 eventi |
| 6 | Un classificatore in entrata | 66.000 eventi complessivi sui tre |
| 7 | Regole/gruppi mittente + policy engine + routing | 32.700 eventi |
| 8 | Scout mittente | alimenta la classificazione |
| 9 | Generazione messaggio (email + WA + LI) | il cuore |
| 10 | Editorial review obbligatorio | vincolo non negoziabile |
| 11 | Invio + log consegna + bounce + layout HTML | il cuore |
| 12 | Approvazione umana prima dell'invio | governance |
| 13 | Cadenze e scheduler outreach | 30.577 eventi |
| 14 | Code di invio + drenaggio task | 59.343 eventi |
| 15 | Promemoria e follow-up | attivo |
| 16 | Agenda | attivo |
| 17 | Pipeline / trattative / attività | attivo |
| 18 | Log decisionale AI + audit azioni | governance |
| 19 | Crediti e budget AI | protegge la spesa |
| 20 | Metriche edge | è l'unico modo per decidere cosa spegnere |
| 21 | Command (un solo cervello) + ricerca vaga + memoria | il moltiplicatore |
| 22 | Import file / CSV / OCR biglietti | ingresso dati manuale |

## 2. Non tengo — esce dalla V3

Nessuna cancellazione immediata: **resta in V2 e raggiungibile**, ma la V3 non lo ospita e non lo importa.

| Cosa | Numeri | Decisione |
|---|---|---|
| Galassia, Prompt Lab (5 funz.), AI Arena, AI Test Hub, Design Preview, E2E Status | strumentazione | fuori — Laboratorio |
| Harmonizer, Sherlock, `super-mario`, `optimus-analyze`, `decision-dashboard` | nessun log | fuori — Laboratorio |
| Famiglia `kb-*` (10 funzioni) | supervisione KB | fuori — la V3 legge la KB, non la amministra |
| TMWE / Findair (11 funzioni) incl. `finder-api-chat`, login popup | dominio esterno | fuori — rientra come tool di Command se serve |
| MCP, Globe, Deep Search, RA Explorer/Scraping (23 funz. acquisizione) | dominio a sé | fuori dal nucleo — rientra come Modulo 8 dopo il Modulo 7 |
| A/B test, simulate/eval classificatore | sperimentazione | fuori — Laboratorio |
| Agent autopilot / simulate | 5.083 eventi ma non è il ciclo del messaggio | fuori dal nucleo, resta attivo in V2 |

### Codice da rimuovere davvero (unica eliminazione proposta ora)

| File | Verifica | Azione |
|---|---|---|
| `_shared/assistantEngine.ts` + `toolExecutionLoop.ts` + `platformTools*` | **0 importatori** | rimuovere |
| `unified-assistant` | proxy puro verso `ai-assistant` | rimuovere l'hop, i chiamanti puntano diretto |
| `command-ask-brain` | 0 eventi, duplica `ai-assistant` | rimuovere dopo strumentazione |
| Header orfani `GoldenHeaderBar`, `AutoPageTitle` | 0 usi | rimuovere |

## 3. Decisioni aperte — servono le tue risposte

### D1 — I tre classificatori
`classify-inbound-message` (35.608) · `classify-inbound-content` (15.341) · `funnemail-classify` (15.370) girano sullo stesso flusso.
Opzioni: (a) uno solo canonico e gli altri diventano alias sottili; (b) uno solo e gli altri spenti dopo 30 giorni di doppia scrittura di confronto; (c) restano due, uno per la posta operativa e uno per Funnemail.

### D2 — Acquisizione lead (scraping, WCA, ReportAziende, deep search)
23 funzioni. È metà del valore commerciale, ma non è il ciclo del messaggio.
Opzioni: (a) fuori dal nucleo, rientra come Modulo 8 dopo il 7; (b) dentro subito nel Modulo 2 Contatti; (c) resta per sempre in V2.

### D3 — Voce (Aurora / ElevenLabs)
Opzioni: (a) nel nucleo, stessi tool di Command, nessun secondo cervello; (b) fuori dal nucleo per ora, resta in V2; (c) si abbandona.

### D4 — Destino della V2
Opzioni: (a) V2 resta viva come "Laboratorio" a tempo indeterminato; (b) V2 muore quando i 7 moduli sono in V3, il Laboratorio viene portato in V3 come sezione separata; (c) si decide più avanti.

---

## 4. Regola che vale comunque

Prima di spegnere qualsiasi funzione: strumentarla in `edge_metrics`, osservare 30 giorni, poi decidere. Oggi solo 37 funzioni su 150 loggano — l'assenza di eventi non è una prova.
