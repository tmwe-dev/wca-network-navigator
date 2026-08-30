# Fase 0.D — Foglio delle decisioni

Cosa entra nella V3 e cosa no. Finché questo foglio non è chiuso, non si scrive codice V3.

Stato: **CHIUSO — le 4 decisioni aperte sono state prese il 2026-08-30 (§3).**

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
| MCP, Globe, Deep Search, RA Explorer/Scraping (23 funz. acquisizione) | dominio a sé | fuori per sempre — resta in V2 (D2) |
| A/B test, simulate/eval classificatore | sperimentazione | fuori — Laboratorio |
| Agent autopilot / simulate | 5.083 eventi ma non è il ciclo del messaggio | fuori dal nucleo, resta attivo in V2 |

### Codice da rimuovere davvero (unica eliminazione proposta ora)

| File | Verifica | Azione |
|---|---|---|
| `_shared/assistantEngine.ts` + `toolExecutionLoop.ts` + `platformTools*` | **0 importatori** | rimuovere |
| `unified-assistant` | proxy puro verso `ai-assistant` | rimuovere l'hop, i chiamanti puntano diretto |
| `command-ask-brain` | 0 eventi, duplica `ai-assistant` | rimuovere dopo strumentazione |
| Header orfani `GoldenHeaderBar`, `AutoPageTitle` | 0 usi | rimuovere |

## 3. Decisioni prese (2026-08-30)

### D1 — Classificatori → **uno solo canonico, gli altri diventano alias**
`classify-inbound-message` (35.608 eventi) è il canonico.
`classify-inbound-content` e `funnemail-classify` restano deployati ma diventano gusci sottili: stesso contratto d'ingresso, delegano al canonico, nessuna logica propria. Nessun chiamante va modificato, nessun flusso si interrompe.
Da eliminare: le tre implementazioni parallele di prompt e parsing. Restano tre porte, un solo motore.
Conseguenza per la V3: il Modulo 4 espone **una** capacità "classifica messaggio in entrata".

### D2 — Acquisizione lead → **resta in V2 per sempre**
Le 23 funzioni di acquisizione (scraping, WCA, ReportAziende, deep search, estensioni browser) non vengono mai migrate. Continuano a girare dove sono e scrivono sulle stesse tabelle.
La V3 **legge** i contatti che producono, non li produce. Nessun Modulo 8.
Conseguenza: `src/v3` non contiene nulla di acquisizione; le pagine RA Explorer / Deep Search / Scraping restano raggiungibili dalla V2.

### D3 — Voce (Aurora / ElevenLabs) → **abbandonata**
Si smette di mantenerla. Tutto l'investimento conversazionale va su Command.
Da dismettere: `voice-brain-bridge`, `elevenlabs-agent-sync`, sincronizzazione prompt agente, pagine vocali. Prima si spengono i cron/webhook, poi si rimuove il codice.
Conseguenza: **un solo cervello nel sistema**, senza eccezioni.

### D4 — Destino della V2 → **si decide dopo il Modulo 7**
Per ora V2 e V3 convivono. La V3 non importa mai da V2 (regola di lint). La scelta se spegnere la V2 o assorbirne il Laboratorio si riprende a Modulo 7 chiuso.

---

## 5. Effetto netto delle decisioni

| | Prima | Dopo |
|---|---:|---:|
| Motori di classificazione | 3 | 1 (3 porte) |
| Cervelli conversazionali | 9 | 1 |
| Domini da migrare in V3 | 8 | 7 (acquisizione esclusa) |
| Superfici vocali da mantenere | 1 | 0 |


---

## 4. Regola che vale comunque

Prima di spegnere qualsiasi funzione: strumentarla in `edge_metrics`, osservare 30 giorni, poi decidere. Oggi solo 37 funzioni su 150 loggano — l'assenza di eventi non è una prova.
