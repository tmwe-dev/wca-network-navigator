# Architecture Decision Records

Vol. II §16.5 — *"Ogni decisione architetturale non documentata diventa,
nel giro di mesi, una decisione misteriosa di cui nessuno ricorda il
motivo."*

Questa cartella contiene gli **ADR** (Architecture Decision Records)
del progetto. Ogni decisione strutturale che impatta più moduli o che
sarebbe costosa da revocare deve essere documentata qui prima
dell'implementazione.

## Convenzione

- File: `NNNN-titolo-kebab-case.md` (numerazione progressiva, zero-padded)
- Stato: `proposed` → `accepted` → `superseded` (mai cancellati)
- Struttura standard: Contesto → Decisione → Conseguenze → Alternative scartate

## Indice

| # | Titolo | Stato |
|---|---|---|
| 0001 | Strangler zod per i contratti API remoti | accepted |
| 0002 | ApiError standardizzato per gli errori API | accepted |
| 0003 | Logger strutturato createLogger come unico punto di logging | accepted |
