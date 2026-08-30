# Fase 0.C — Mappa di innesto V3

Dove va ogni cosa, dichiarato prima di scrivere codice. 22 pagine in tutto, contro le ~150 rotte della V2.

Legenda tipo: **L** = Lista · **D** = Dettaglio · **O** = Operativa (vedi `contratto-pagina.md`).

## Modulo 1 — Identità & accesso

| Pagina | Path | Tipo | Domanda | Filtri (sx) | Workflow (dx) |
|---|---|---|---|---|---|
| Accesso | `/v3/login` | O | Chi sei? | — | — |
| Operatori | `/v3/operatori` | L | Chi può fare cosa? | ruolo, stato | invita, ruoli, revoca |

Sostituisce: `login`, `reset-password`, `auth-callback`, `admin-users`, `settings/admin-users`, `staff`.

## Modulo 2 — Contatti

| Pagina | Path | Tipo | Domanda | Filtri (sx) | Workflow (dx) |
|---|---|---|---|---|---|
| Contatti | `/v3/contatti` | L | Chi devo contattare? | ricerca, paese, gruppo, stato, tag | nuovo, import, azioni massive |
| Scheda contatto | `/v3/contatti/:id` | D | Chi è e cosa ci siamo detti? | — | scrivi, programma, unisci, archivia |
| Import | `/v3/import` | O | Cosa sto caricando? | — | carica, mappa campi, conferma |
| Duplicati | `/v3/duplicati` | L | Cosa devo unire? | soglia, tipo | unisci, ignora |
| Cestino | `/v3/cestino` | L | Cosa ho eliminato? | tipo, periodo | ripristina |

Sostituisce: `contacts`, `crm/contacts`, `pipeline/contacts`, `partner-hub`, `partner-directory`, `prospects`, `crm/prospects`, `business-cards`, `biglietti`, `crm/biglietti`, `import`, `operations`, `pipeline/duplicati`, `cestinone`.

## Modulo 3 — Messaggi

| Pagina | Path | Tipo | Domanda | Filtri (sx) | Workflow (dx) |
|---|---|---|---|---|---|
| Inbox | `/v3/inbox` | O | Cosa è arrivato e cosa richiede risposta? | casella, gruppo, stato, periodo, non letti | rispondi, assegna, archivia, regole |
| Conversazione | `/v3/inbox/:id` | D | Cosa dice questo messaggio e cosa faccio? | — | rispondi, programma, classifica, escala |
| Rubrica canali | `/v3/canali` | L | Cosa arriva da WhatsApp e LinkedIn? | canale, contatto, periodo | apri conversazione |

Sostituisce: `inbox`, `email`, `comms`, `comms/:tab`, `funnemail-inbox`, `funnemail-inbox/sorting`, `sorting`, `inreach`, `communicate/inbox`, `rubrica/whatsapp`, `rubrica/linkedin`, `email-download`.

## Modulo 4 — Comprensione

| Pagina | Path | Tipo | Domanda | Filtri (sx) | Workflow (dx) |
|---|---|---|---|---|---|
| Regole e gruppi | `/v3/regole` | L | Come viene smistato ciò che arriva? | tipo regola, gruppo, stato | nuova regola, testa, correggi |
| Qualità classificazione | `/v3/classificazione` | L | Sta classificando bene? | periodo, esito, gruppo | correggi, promuovi a regola |

Sostituisce: `email-intelligence`, `email-intelligence/operations`, `ai-control`, parte di `settings/ai-routing`.

## Modulo 5 — Risposta

| Pagina | Path | Tipo | Domanda | Filtri (sx) | Workflow (dx) |
|---|---|---|---|---|---|
| Scrivi | `/v3/scrivi` | O | Cosa mando e a chi? | destinatari, canale, template | genera, revisiona, allega, invia |
| Approvazioni | `/v3/approvazioni` | L | Cosa devo approvare prima che parta? | canale, rischio, richiedente | approva, correggi, rifiuta |
| Modelli | `/v3/modelli` | L | Con che tono e struttura scriviamo? | canale, lingua, uso | nuovo, duplica, prova |

Sostituisce: `email-composer`, `outreach/composer`, `communicate/compose`, `email/forge`, `email-forge`, `approvazioni`, `approvals`, `communicate/approve`, `agents/email-strategies`.

## Modulo 6 — Programmazione

| Pagina | Path | Tipo | Domanda | Filtri (sx) | Workflow (dx) |
|---|---|---|---|---|---|
| Agenda | `/v3/agenda` | O | Cosa devo fare oggi? | tipo, operatore, priorità, giorno | completa, rimanda, crea |
| Campagne | `/v3/campagne` | L | Cosa sta partendo e quando? | stato, canale, periodo | avvia, sospendi, modifica cadenza |
| Coda di invio | `/v3/coda` | L | Cosa è in coda e cosa si è bloccato? | stato, canale, errore | riprova, sblocca, annulla |

Sostituisce: `agenda`, `pipeline/agenda`, `outreach/agenda`, `calendar`, `todo`, `campaigns`, `campaigns/jobs`, `campaign-jobs`, `outreach`, `communicate/outreach`, `missions`, `autopilot-missions`.

## Modulo 7 — Tracciamento

| Pagina | Path | Tipo | Domanda | Filtri (sx) | Workflow (dx) |
|---|---|---|---|---|---|
| Pipeline | `/v3/pipeline` | O | A che punto sono le trattative? | fase, operatore, valore, periodo | sposta fase, crea attività |
| Andamento | `/v3/andamento` | L | Sta funzionando? | periodo, canale, operatore | esporta |
| Registro AI | `/v3/registro` | L | Cosa ha deciso l'AI e perché? | funzione, esito, periodo | apri traccia, esporta |

Sostituisce: `pipeline`, `pipeline/kanban`, `crm/kanban`, `deals`, `dashboard`, `analytics`, `kpi`, `ai-interactions-log`, `pipeline-traces`, `token-cockpit`, `observability`, `telemetry`.

## Sopra i moduli

| Pagina | Path | Tipo | Domanda | Filtri (sx) | Workflow (dx) |
|---|---|---|---|---|---|
| Command | `/v3/command` | O | Chiedi qualsiasi cosa al sistema | conversazioni recenti | strumenti usati, fonti, azioni proposte |
| Impostazioni | `/v3/impostazioni` | D | Come è configurato il sistema? | — | sezioni: caselle, AI, alert, marchio |

Command è **l'unico** cervello conversazionale: gli strumenti che espone coprono le capacità dei sette moduli. La voce (Aurora) usa gli stessi strumenti, non un secondo cervello.

## Fuori dalla V3 — Laboratorio

Restano in V2, raggiungibili da una sola voce "Laboratorio": Galassia, Prompt Lab, AI Arena, AI Test Hub, KB Supervisor, Harmonizer, Sherlock, Agents/Autopilot, Deep Search, RA Explorer/Scraping, Globe, TMWE/Findair, Design System Preview, E2E Status, Diagnostics.

## Conteggio

| | V2 | V3 |
|---|---:|---:|
| Rotte registrate | ~150 | 22 |
| Header di pagina | 3 + 2 orfani | 1 |
| Indirizzi per pagina | fino a 3 | 1 |
| Cervelli conversazionali | 9 | 1 |
| Classificatori sul flusso in entrata | 3 | 1 |

## Ordine di innesto

1 Identità → 2 Contatti → 3 Messaggi (lettura) → 4 Comprensione → 5 Risposta → 6 Programmazione → 7 Tracciamento → Command.

Ogni modulo avrà il suo piano dedicato: cosa si copia, cosa si riscrive, cosa si abbandona, e quali righe del registro `inventario-funzioni.md` deve coprire per dirsi finito.
