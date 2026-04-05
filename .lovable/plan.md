

# Fix Formattazione Email nell'Email Composer

## Problema

L'Email Composer mostra il corpo della mail generata dall'AI come testo grezzo con tag HTML visibili (`<p>`, `<strong>`, `<br>`, etc.) perché usa un semplice `<Textarea>`. Il Cockpit invece renderizza correttamente l'HTML tramite `dangerouslySetInnerHTML`.

## Analisi: Cockpit vs Email Composer

| Aspetto | Cockpit | Email Composer |
|---------|---------|---------------|
| Edge Function | `generate-outreach` | `generate-email` |
| Rendering | `TypewriterText` con `isHtml` + `dangerouslySetInnerHTML` | `<Textarea>` (raw text) |
| Editing | Non editabile inline | Textarea editabile |

Le due edge function fanno cose molto simili (stessa KB, stessi alias, stessa logica lingua). La differenza critica è nel **rendering frontend**, non nel backend.

## Soluzione

### Principio: Riutilizzo del motore core

Non creiamo un nuovo editor — riutilizziamo il pattern del Cockpit adattandolo all'Email Composer con una modalità di editing.

### Implementazione: Doppia vista Edit/Preview

Sostituire il `<Textarea>` con un componente a due modalità:

1. **Modalità Visuale (default)** — il corpo HTML viene renderizzato come nel Cockpit usando `dangerouslySetInnerHTML` con DOMPurify, all'interno di un `div[contentEditable]`. L'utente vede il testo formattato e può modificarlo direttamente.

2. **Modalità Sorgente** — il `<Textarea>` attuale rimane disponibile tramite il pulsante `{ }` (già presente in toolbar) per chi vuole editare i tag HTML a mano.

### Dettaglio tecnico

**Nuovo componente `src/components/email/HtmlEmailEditor.tsx`:**
- `contentEditable` div con rendering HTML via DOMPurify
- Sincronizzazione bidirezionale: `onInput` cattura `innerHTML` e aggiorna lo stato `htmlBody`
- Toggle Visuale/Sorgente nella toolbar esistente
- Stili `prose` per una resa tipografica pulita

**Modifica `src/pages/EmailComposer.tsx`:**
- Sostituire il `<Textarea>` (riga 369-374) con il nuovo `HtmlEmailEditor`
- Il toggle Preview (occhio) esistente diventa ridondante — lo manteniamo per la preview con variabili sostituite

### Unificazione Edge Functions (fase 2, opzionale)

Le due edge function `generate-email` e `generate-outreach` condividono ~80% del codice. Si potrebbe unificarle in una sola (`generate-outreach`) con un parametro `channel: "email"` anche dall'Email Composer. Questo evita divergenze future. Tuttavia questo è un refactor separato — il fix immediato è sul rendering.

## File coinvolti

| File | Azione |
|------|--------|
| `src/components/email/HtmlEmailEditor.tsx` | **Nuovo** — Editor HTML con contentEditable + modalità sorgente |
| `src/pages/EmailComposer.tsx` | Sostituire Textarea con HtmlEmailEditor |

