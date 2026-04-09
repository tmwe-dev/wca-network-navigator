

# Piano: Rispondi e Inoltra aprono Email Composer

## Problema
I pulsanti "Rispondi" e "Inoltra" nella vista dettaglio email navigano a `/outreach` — una pagina che non è il compositore email. L'utente vuole che aprano `/email-composer` con i dati pre-compilati (destinatario, oggetto, corpo quotato).

## Modifiche

### 1. EmailDetailView.tsx — Cambiare navigazione da `/outreach` a `/email-composer`
Tutti e 3 i pulsanti (Rispondi, Rispondi a Tutti, Inoltra) navigano a `/email-composer` con lo stesso `state`.

### 2. EmailComposer.tsx — Leggere `prefilledSubject` e `prefilledBody` dallo state
Attualmente il composer legge solo `prefilledRecipient`. Aggiungere il supporto per:
- `prefilledSubject` → popola il campo oggetto
- `prefilledBody` → popola il corpo HTML (come testo quotato in `<pre>`)
- `prefilledRecipients` (array) → per "Rispondi a tutti" con CC

Così la risposta pre-compila destinatario + oggetto "Re:..." + corpo quotato, e l'inoltro pre-compila solo oggetto "Fwd:..." + corpo senza destinatario (l'utente lo sceglie).

## File coinvolti

| File | Azione |
|------|--------|
| `src/components/outreach/EmailDetailView.tsx` | Cambiare `navigate("/outreach"...)` → `navigate("/email-composer"...)` per i 3 pulsanti |
| `src/pages/EmailComposer.tsx` | Aggiungere lettura di `prefilledSubject` e `prefilledBody` dal location state, settando `subject` e `htmlBody` |

