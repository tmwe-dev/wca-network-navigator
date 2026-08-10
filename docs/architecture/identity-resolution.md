# Identity Resolution (Batch 3 — additivo, non collegato al runtime)

Modulo puro in `src/modules/_contracts/identity/`. Nessun accesso a DB, rete o stato:
solo normalizzazione e scoring. Nessun file esistente lo importa, quindi non può
alterare il comportamento dell'app.

## Normalizzazione
| Campo | Regola |
|---|---|
| email | lowercase, trim, rimozione plus-tag (`a+news@x` → `a@x`) |
| telefono | solo cifre, `00` → prefisso internazionale, scarto < 6 cifre |
| ragione sociale | rimozione forme societarie e stopword logistiche (`Rossi Logistics S.r.l.` → `rossi`) |
| nome persona | token ordinati (`Mario Rossi` == `Rossi, Mario`) |
| LinkedIn | solo slug del profilo |

## Scoring
Somma pesata dei segnali coincidenti, cap a 1:
email 0.60 · linkedin 0.50 · telefono 0.35 · nome 0.25 · azienda 0.15 · dominio email 0.05.

Soglie di default: **match ≥ 0.90**, **revisione umana ≥ 0.60**.

## Regole di governance
- Nessun merge automatico sotto la soglia di match.
- Se due o più candidati superano la soglia, il caso va sempre in revisione (`needsReview`), mai merge.
- Ogni futura scrittura derivata da un merge deve portare `provenance` (source, sourceId, fetchedAt, confidence).

## Prossimi passi (fuori scope Batch 3)
Collegare il modulo a un servizio di dedup con outbox eventi, partendo dalla baseline
in `docs/audit/identity-duplicates-2026-08-09.md`. Nessuna migrazione DB prima di quel batch.
