# Collaudo fisico WCA Network Navigator — checklist di prontezza

Data: 2026-09-02 · Esito atteso: ogni riga chiusa con PASS / FAIL / N.A. + data + note

## 0. Fotografia attuale (misurata, non stimata)

| Indicatore | Valore | Lettura |
| --- | --- | --- |
| Partner in DB | 12.286 | dato reale, massa critica presente |
| Contatti partner | 137.342 | anagrafica ricca |
| Messaggi canale (email/WA/LI) | 20.843 | ingestion provata sul campo |
| Log AI (`ai_prompt_log`) | 46.558 | strato AI ampiamente esercitato |
| **Email realmente inviate** (`email_send_log`) | **3** | pipeline in uscita **non collaudata** |
| **Coda outreach** (`outreach_queue`) | **0** | mai eseguita end-to-end |
| Cron | **fermi dal 2026-08-01** (`cron_paused=true`) | 32 giorni senza automazioni |
| Spec E2E scritte | 72 file | copertura di intento buona |
| Esiti E2E registrati (`e2e_run_results`) | **0 righe** | **nessuna prova di esecuzione** |
| Test unitari/integrazione | 396 file | buona base |

**Voto complessivo: 6.5/10.**
Sotto-voti: architettura e dati 8 · sicurezza/RLS 7.5 · UI/UX 7 · osservabilità 7 ·
**collaudo end-to-end 3** · automazioni in produzione 2.

Sintesi: il sistema è **costruito**, non è **collaudato**. Tutto ciò che *legge* è
provato dai numeri; tutto ciò che *agisce verso l'esterno* (invio, cadenze, cron)
non ha ancora una prova di funzionamento reale.

---

## 1. Blocco A — Accesso e sicurezza

- [ ] A1 Login con utente in whitelist → entra
- [ ] A2 Login con email NON in `authorized_users` → respinto con messaggio chiaro
- [ ] A3 Logout → rotta protetta reindirizza a `/login`
- [ ] A4 Utente non-admin su pagina admin (`/v2/admin/users`) → accesso negato
- [ ] A5 Chiamata diretta a un'edge function AI senza JWT → 401
- [ ] A6 Sessione scaduta durante l'uso → refresh o redirect pulito, niente pagina bianca

## 2. Blocco B — Anagrafica e navigazione

- [ ] B1 `/v2/explore/network`: lista carica, contatore coerente, scroll fluido
- [ ] B2 Ricerca partner per nome parziale → risultati pertinenti
- [ ] B3 Filtri (paese, servizio, stato) → conteggi coerenti con la lista
- [ ] B4 Ordinamento A-Z / Z-A → ordine corretto
- [ ] B5 Apertura dettaglio partner → 3 tab popolate, logo e bandiera visibili
- [ ] B6 Contatti CRM: creazione, modifica, soft-delete e ricomparsa in Cestinone
- [ ] B7 Verifica che DELETE fisico non avvenga mai (riga marcata, non sparita)
- [ ] B8 Menu unico: tutte le 66 voci aprono una pagina senza errore in console

## 3. Blocco C — Import e acquisizione

- [ ] C1 Import CSV contatti → conteggio righe importate == righe file - scarti
- [ ] C2 Import con duplicati → dedup attiva, log in `import_errors`
- [ ] C3 Biglietto da visita OCR → campi estratti corretti su 5 biglietti reali
- [ ] C4 Estensione Chrome WCA → salvataggio contatti nel DB
- [ ] C5 Deep search su 1 azienda → risultati e fonti tracciate

## 4. Blocco D — Email in ingresso (Funnemail)

- [ ] D1 Sync IMAP manuale → nuovi messaggi compaiono
- [ ] D2 Verifica PEEK: messaggi NON risultano letti sul client di posta originale
- [ ] D3 Email molto grande → corpo troncato ma leggibile, nessun errore
- [ ] D4 Classificazione risposta → categoria sensata + escalation stato lead
- [ ] D5 Claim messaggio da due operatori → il secondo riceve conflitto
- [ ] D6 Bounce reale → contatto sospeso automaticamente

## 5. Blocco E — Email in uscita (**il blocco più scoperto**)

- [ ] E1 Invio singolo a indirizzo di test → arriva, formato HTML corretto
- [ ] E2 Verifica firma, footer e link cliccabili nel client destinatario
- [ ] E3 Allegato → arriva integro
- [ ] E4 Editorial review: messaggio scadente → **bloccato** prima dell'invio
- [ ] E5 Invio a indirizzo in blacklist → **bloccato**
- [ ] E6 Doppio click su "Invia" → **una sola** email inviata (no duplicati)
- [ ] E7 `email_send_log` registra ogni invio con esito
- [ ] E8 Coda campagna con 5 destinatari → 5 invii, 0 duplicati, ordine rispettato
- [ ] E9 Errore SMTP simulato → retry corretto, nessun invio fantasma

## 6. Blocco F — Outreach multicanale e cadenze

- [ ] F1 Creazione missione outreach → coda popolata (`outreach_queue` > 0)
- [ ] F2 Cadenza a 3 step → follow-up parte solo se non c'è risposta
- [ ] F3 Risposta ricevuta → cadenza si ferma automaticamente
- [ ] F4 Holding pattern su azienda sorella → nessun doppio contatto
- [ ] F5 A/B test → distribuzione varianti coerente
- [ ] F6 WhatsApp / LinkedIn: invio di prova su un contatto reale

## 7. Blocco G — Command e agenti AI

- [ ] G1 Domanda vaga ("quanti partner in Malta") → risposta corretta e verificabile a mano
- [ ] G2 Ricerca senza nome campo esatto → `ai_find_anything` trova comunque
- [ ] G3 Conteggio parziale → l'agente **dichiara** che è parziale
- [ ] G4 Richiesta di azione a rischio (invio massivo) → chiede approvazione
- [ ] G5 Approvazione da `/v2/approvazioni` → azione eseguita davvero
- [ ] G6 Rifiuto approvazione → nessun side-effect
- [ ] G7 Prompt injection in un'email → guard blocca
- [ ] G8 Agente vocale Aurora → risponde con dati reali dal DB

## 8. Blocco H — Automazioni e cron (**bloccato oggi**)

- [ ] H1 Riattivare `cron_paused=false` in finestra controllata
- [ ] H2 Osservare 24h: ogni job scrive in `cron_runs` senza errori
- [ ] H3 Nessun invio non voluto nelle prime 2 ore (sorveglianza attiva)
- [ ] H4 7 giorni consecutivi di esecuzioni pulite
- [ ] H5 Kill-switch riattivabile in < 1 minuto e realmente efficace

## 9. Blocco I — Resilienza e limiti

- [ ] I1 Offline / rete assente → messaggio chiaro, niente crash
- [ ] I2 Credito AI esaurito (402) → messaggio all'utente, job in pausa, nessun loop
- [ ] I3 Rate limit (429) → backoff, non retry immediato
- [ ] I4 Refresh pagina a metà operazione → stato coerente
- [ ] I5 Mobile 375px: le 10 pagine principali restano usabili

## 10. Blocco L — Prova di regressione automatica

- [ ] L1 `bunx vitest run` → verde, zero test skippati non giustificati
- [ ] L2 Suite E2E Playwright eseguita **davvero** e risultati scritti in `e2e_run_results`
- [ ] L3 `all-routes-deep-invariants.spec.ts` → tutte le rotte senza errori console
- [ ] L4 Typecheck e lint puliti (incluse regole di layering)

---

## Criterio di "pronto"

Il sistema è dichiarabile pronto quando:

1. Blocchi A, B, D, E chiusi al 100% (accesso, dati, email in ingresso e in uscita).
2. Blocco H con **7 giorni** di cron puliti.
3. Blocco L eseguito con esiti persistiti, non solo scritti.

Finché E e H restano aperti, il voto non può salire sopra il 7: manca la prova
che il commerciale digitale sappia davvero *agire*, non solo *sapere*.
