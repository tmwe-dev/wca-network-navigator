
# Piano di verifica complessiva del sistema

Obiettivo: validare che la piattaforma funzioni end-to-end, che la logica di business sia coerente, e individuare sovrapposizioni (codice duplicato, flussi paralleli, componenti che fanno la stessa cosa in posti diversi).

Lavoro diviso in 5 fasi, ognuna produce un report concreto in `/mnt/documents/audit/`.

## Fase 1 — Mappa strutturale del sistema
Cosa: inventario di rotte V2, pagine, hook, edge functions, tabelle DB, scope AI.
Output: `01-map.md` con
- elenco rotte V2 con pagina/hook collegati
- elenco edge functions con scope AI e tabelle toccate
- matrice "feature → file → edge → tabella"
Serve come base oggettiva per le fasi successive.

## Fase 2 — Caccia alle sovrapposizioni
Cosa: trovare duplicazioni reali (non stilistiche).
- componenti che fanno lo stesso lavoro (es. card email: `EmailMessageList` vs `FunnemailMailCard`, sidebar gruppi duplicate, multipli "deep search button")
- hook con responsabilità sovrapposte (più hook che leggono gli stessi dati)
- edge functions con scope simile (es. più classificatori, più "improve email")
- query keys non centralizzate
- prompt operativi duplicati per stesso `context+tag`
- chiamate AI dirette che bypassano `invokeAi()` (violazione AI Charter)
Output: `02-overlaps.md` con tabella "duplicato → file canonico proposto → azione (unify / deprecate / leave)".

## Fase 3 — Verifica logica dei flussi critici
Per ogni nodo critico, ricostruisco il flusso reale leggendo il codice e poi lo provo nel preview con browser tool su un caso reale non distruttivo.

Flussi da verificare:
1. Acquisizione lead → CRM (import + dedup + soft-delete)
2. Outreach email: generate → editorial review → approve → send → log → side-effects
3. Outreach WhatsApp/LinkedIn via bridge
4. Inbound email: download → classify → lead status escalation → suggerimento AI
5. Holding pattern e Same-Location Guard
6. Agent loop: persona + capabilities + prompt operativi + hard guards + risk gate
7. Auth + whitelist + RBAC
8. Soft-delete trigger su tabelle business

Per ognuno: "atteso vs osservato", anomalie, log edge function correlati.
Output: `03-flows.md`.

## Fase 4 — Health check tecnico
- linter Supabase (RLS, indici, policy)
- query a `edge_metrics` e `ai_interaction_log` ultimi 7gg: errori, latenze anomale, scope mai usati
- `prompt_test_runs` recenti: regressioni prompt
- `prompt_injection_reviews` pendenti
- `ai_pending_actions` bloccate dal risk gate
- `cloud_status`
- `bunx tsc --noEmit` + dependency scan
Output: `04-health.md`.

## Fase 5 — Piano di rimedio prioritizzato
Output: `05-remediation.md` con backlog ordinato per impatto:
- P0 = rotture funzionali o rischi di sicurezza
- P1 = sovrapposizioni che causano bug o confusione operativa (es. due card email diverse nello stesso prodotto)
- P2 = pulizia/uniformità UI e debito tecnico
Ogni voce ha: file coinvolti, modifica minima proposta, rischio di regressione, test di verifica.

## Cosa NON faccio in questa fase
- nessuna modifica al codice
- nessuna scrittura su DB
- nessun invio reale (email/WA/LI)
- niente refactor opportunistici: la fase di fix arriva DOPO che approvi il report `05-remediation.md`

## Dettagli tecnici
- Uso `code--exec` con `rg` per mappature, `supabase--read_query` per metriche, `supabase--linter` per RLS, `browser--*` solo su flussi read-only o su account di test.
- Tutti i report in `/mnt/documents/audit/` come `.md` consultabili.
- Tempo stimato: Fase 1-2 rapide, Fase 3 è la più lunga (richiede letture estese).

## Domanda prima di partire
Vuoi che parta da tutte e 5 le fasi in sequenza, oppure preferisci che faccia prima solo Fase 1+2 (mappa + sovrapposizioni) così decidi tu su cosa concentrare la Fase 3?
