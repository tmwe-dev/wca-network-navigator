# Calligrafia + Anteprima email

## 1. Conferma: Calligrafia È utilizzata

KB entry presente in DB:
- `kb_entries` → categoria `calligrafia`, titolo "Calligrafia — Standard di formattazione email (plain text)".

Iniettata via `_shared/calligrafiaInjector.ts` (`buildCalligrafiaSection`) nei tre orchestratori che producono email:
- `generate-email/index.ts` (riga 232) — pipeline ufficiale del compose-email.
- `generate-outreach/index.ts` (riga 280) — solo canale email.
- `improve-email/index.ts` (riga 404) — riscrittura/miglioria.

Inoltre il **Giornalista** (`journalistReview`) ricarica le regole di Calligrafia come parte del system prompt prima di approvare ogni messaggio.

→ Quindi sì: ogni email batch che hai visto è passata da Calligrafia. Quello che manca è solo la **visibilità**: nello strip della pipeline (Oracolo → Architetto → Prompt Lab → Giornalista → Bozza) Calligrafia non compare come tappa, e questo dà l'impressione che non ci sia.

Se la formattazione non ti convince, la causa non è "Calligrafia spenta" ma il **contenuto della voce KB**: si modifica da `/v2/prompt-lab` (tab Knowledge Base, categoria `calligrafia`) ed è effettiva al prossimo invio senza redeploy.

## 2. Cosa aggiungo (UI-only, nessuna logica AI toccata)

### A. Stage "Calligrafia" visibile nella pipeline
In `composeEmail.ts → buildEmailPipeline()` aggiungo una tappa `calligrafia` (label "Calligrafia", detail `KB·1` se la voce esiste, `—` altrimenti) tra "Prompt Lab" e "Giornalista". Lo stato è derivato dalla presenza della KB entry in DB (già nota al tool tramite l'audit).

Risultato visibile: **Oracolo → Architetto → Prompt Lab → Calligrafia → Giornalista → Bozza**.

### B. Pulsante "Anteprima email completa"
In `ComposerCanvas.tsx`, accanto a "Genera con AI" / "Invia questa", aggiungo un'icona **Eye** "Anteprima":

- Apre un modal full-width (`Dialog` shadcn) che mostra l'email **come arriverà al destinatario**:
  - Header: `A: <recipients>` · `Oggetto: <subject>`
  - Body renderizzato come HTML (lo stesso che `send-email` invia, sanitizzato con DOMPurify lato client per sicurezza).
  - Sezione "Firma" simulata: caricata via query a `agents` (campo `signature_html` + immagine) dell'agente attivo, con disclaimer "Aggiunte automaticamente all'invio".
  - Toggle "Visualizza HTML grezzo" per ispezione.
- In modalità batch il pulsante mostra l'anteprima della bozza correntemente selezionata (indice N/M già gestito).
- Nessuna chiamata di invio, nessuna mutazione di stato — pure read.

## 3. Cosa NON tocco
- Pipeline AI (generate-email, journalistReview, calligrafiaInjector): già funzionanti, nessuna modifica.
- `send-email` edge: la firma reale resta server-side; l'anteprima la replica leggendo gli stessi campi `agents.signature_html`.
- Logica batch / governance / approval panel.

## File interessati
- `src/v2/ui/pages/command/tools/composeEmail.ts` — aggiunta stage `calligrafia` in `buildEmailPipeline`.
- `src/v2/ui/pages/command/canvas/EmailPipelineBadge.tsx` — eventuale colore/icona per la nuova tappa.
- `src/v2/ui/pages/command/canvas/ComposerCanvas.tsx` — pulsante Eye + modal anteprima.
- (nuovo) `src/v2/ui/pages/command/canvas/EmailPreviewDialog.tsx` — modal isolato.
- DAL: piccola query `agents.signature_html` via funzione esistente in `src/data/agents.ts` (se manca, lettura `.maybeSingle()`).
