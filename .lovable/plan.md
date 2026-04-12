

## Fix 4 anomalie funzionali — OraclePanel crash, confidenza %, note grezze, fetch template

### Problema 1 — Tooltip + SelectTrigger crash Radix
In `OraclePanel.tsx` righe 233-240, un `Tooltip` wrappa un `SelectTrigger`. Radix non supporta due popper annidati → crash silenzioso → pagina vuota.

**Fix**: Rimuovere `Tooltip`/`TooltipTrigger`/`TooltipContent` dal blocco tono. Wrappare il `Select` in un `<div title={...}>` con attributo `title` nativo.

### Problema 2 — Confidenza match "7000%"
Il DB salva `match_confidence` già come 0-100, ma il codice moltiplica ×100.

**Fix in 2 file**:
- `BCADetailPanel.tsx` riga 177: `Math.round(card.match_confidence * 100)` → `Math.round(card.match_confidence)`
- `BusinessCardsViewV2.tsx` riga 70: stessa correzione

### Problema 3 — Note grezze illeggibili
In `BCADetailPanel.tsx` riga 184, `card.notes` può contenere MIME/dati grezzi.

**Fix**: Aggiungere check `isGarbled` con regex `/[;|]{3,}|[\x00-\x1f]/`. Se true, mostrare solo i primi 120 caratteri + "..." + "(dati grezzi)" in grigio.

### Problema 4 — Template fetch senza check HTTP
In `useEmailComposerState.ts` riga 416, un 404 non lancia eccezione → HTML errore finisce nell'editor.

**Fix**: Dopo `const res = await fetch(url);` aggiungere `if (!res.ok) throw new Error("HTTP " + res.status);`

### File modificati
1. `src/components/email/OraclePanel.tsx` — rimozione Tooltip da SelectTrigger
2. `src/components/contacts/bca/BCADetailPanel.tsx` — fix confidenza + note grezze
3. `src/v2/ui/organisms/network/BusinessCardsViewV2.tsx` — fix confidenza
4. `src/hooks/useEmailComposerState.ts` — check res.ok

Zero `any`. Nessuna modifica a logica AI/IMAP/routing.

