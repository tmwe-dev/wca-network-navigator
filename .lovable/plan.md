## Obiettivo
Sistemare il client `/v2/funnemail-inbox` su tre fronti: **sidebar** (cartelle complete, riordinabili, prioritarie corrette), **lista mail** (card più ricche e con azioni), **lettore** (oggetto leggibile, niente prefissi rumorosi, niente sovrapposizioni).

---

## 1. Sidebar — `InboxGroupsSidebar.tsx`

**Problema attuale:** sembra che mancano cartelle perché molte finiscono sotto "Secondarie" e non sono visibili senza scroll. "Spam" è in Prioritarie (sbagliato). Nessun riordino.

**Cambiamenti:**
- **Zero cartelle hardcoded come "prioritarie"**. Default lato server: tutte vanno in Secondarie tranne 3 top operative (`Operativo`, `Commerciale`, `Amministrativo`). Spam **mai** in prioritarie.
- **Riordino libero via drag handle**: aggiungo icona puntini (`GripVertical`) a sinistra di ogni cartella. L'utente trascina per spostare sopra/sotto, anche fra sezioni (Prioritarie ↔ Secondarie). Lo Spam può finire ovunque tranne che sia "imposto" prioritario.
- **Persistenza ordine**: salvato per-utente in `localStorage` con chiave `funnemail_sidebar_order_v1` (mappa `slug → { section, position }`). Niente migrazione DB in questa fase: è preferenza UI personale, locale al device. (Se vuoi DB-side lo facciamo in un secondo step.)
- **Tutte le cartelle visibili**: rimuovo lo scroll "nascosto" assicurando che la sezione Prioritarie/Secondarie/Non classificate stiano in un unico `ScrollArea` continuo, con header sticky di sezione.
- Libreria drag: `@dnd-kit/core` + `@dnd-kit/sortable` (già presente in progetto se usato altrove; altrimenti la aggiungo — chiedo conferma sotto).

---

## 2. Card mail — `EmailMessageList.tsx` (versione locale per Funnemail)

**Problema attuale:** la card mostra "R: RFQ Request - DAP Shipment…" troncato, senza azioni inline, senza assegnazione gruppo se mancante.

**Cambiamenti:**
- **Riga 1 — Brand azienda**: nome azienda derivato (`extractSenderBrand`) in grassetto + bandiera + data. Già c'è, lo mantengo.
- **Riga 2 — Nome mittente**: solo il nome persona (parte prima di `<email>` o prima di `@`), **senza** indirizzo email completo. Es: "Elizabeth Feria" e basta.
- **Riga 3 — Oggetto pulito**: rimuovo prefissi `R:`, `Re:`, `RE:`, `Fwd:`, `FWD:`, `I:` con regex `/^\s*(re|r|fwd|fw|i)\s*:\s*/gi` ripetuta finché non sparisce. Mostro solo l'oggetto vero. Font invariato.
- **Righe 4-5 — Snippet corpo**: 2-3 righe del `body_text` (primi ~180 caratteri, strip whitespace, niente HTML). Stesso font del resto. `line-clamp-3`.
- **Card più alta**: `ROW_HEIGHT` da 88 → **132px** per contenere snippet senza tagliare.
- **Azioni inline (hover)**: barretta in basso/destra che appare on-hover con:
  - `Rispondi` (icon-only),
  - `Inoltra` (icon-only),
  - `Archivia` (icon-only),
  - **`Assegna gruppo`** se la mail è in `unclassified` o se voglio cambiare: riuso `InlineGroupAssigner` che già esiste.
- **Badge gruppo**: se classificata, mostro pillola colorata con nome gruppo (già presente). Se NON classificata, mostro un piccolo `+ Assegna` cliccabile.

Creo un file dedicato `FunnemailMailCard.tsx` dentro `src/v2/ui/pages/funnemail-inbox/` invece di modificare `EmailMessageList.tsx` globale (evito regressioni nella Inbox V1/V2 standard). La pagina Funnemail userà una nuova `FunnemailMailList.tsx` con virtualizer e questa nuova card.

---

## 3. Lettore — `EmailDetailView.tsx` (header)

**Problema attuale:** oggetto troncato a una riga, sovrapposto da bandiera/badge "Operativo"/"Modifica". "R: RFQ Reques…" tagliato.

**Cambiamenti (solo nell'uso da Funnemail, non tocco il componente globale):**
- Faccio una variante leggera `FunnemailMailHeader.tsx` con:
  - **Riga 1**: Logo + nome azienda (grande) + bandiera **a destra** ma nella stessa riga, **non sopra** all'oggetto.
  - **Riga 2**: Oggetto **pulito** (stessa regex di rimozione `Re:/R:/Fwd:`), font semibold, `whitespace-normal break-words` (può andare a capo), nessun truncate. Niente badge sopra.
  - **Riga 3**: Nome persona mittente (no indirizzo completo), data, freccia `→` destinatario.
  - **Riga 4**: Badge gruppo + pulsante "Modifica gruppo" (InlineGroupAssigner) **sotto**, non incollati al titolo.
  - **Riga 5**: Azioni Rispondi / Inoltra (già esistenti).

In alternativa, modifica chirurgica all'`EmailDetailView` esistente:
- togliere `truncate` da `<h3>` oggetto e farlo `break-words`,
- spostare il blocco `<CountryFlag>` e i badge in una **riga sotto** (non `flex-shrink-0` accanto al titolo),
- aggiungere stripping prefissi alla `decodedSubject`.

Propongo la **modifica chirurgica** all'esistente per non duplicare codice (più semplice, meno superficie di rottura). Dimmi se preferisci la variante separata.

---

## 4. Tecnico

### File modificati
- `src/data/funnemailInbox.ts` — rimuovo la regola `PRIORITY_THRESHOLD = 6`. Default: solo `Operativo`, `Commerciale`, `Amministrativo` in `priority`; tutto il resto in `secondary`. Spam sempre `secondary`.
- `src/v2/ui/pages/funnemail-inbox/InboxGroupsSidebar.tsx` — aggiungo drag&drop, persistenza localStorage, applico ordine personalizzato.
- `src/v2/ui/pages/funnemail-inbox/FunnemailMailCard.tsx` — **nuovo**, card 132px con snippet + azioni hover.
- `src/v2/ui/pages/funnemail-inbox/FunnemailMailList.tsx` — **nuovo**, virtualizer wrapper della card sopra.
- `src/v2/ui/pages/FunnemailInboxPage.tsx` — sostituisce `EmailMessageList` con `FunnemailMailList`.
- `src/components/outreach/EmailDetailView.tsx` — **modifica chirurgica** all'header: oggetto su riga propria con `break-words`, bandiera/badge spostati sotto, stripping prefissi `Re:/R:/Fwd:`.
- `src/data/funnemailInbox.ts` — il `MESSAGE_LIST_SELECT` non include `body_text` per snippet: aggiungo se manca (lo include già, ok).

### Helper riutilizzabili (in `src/v2/ui/pages/funnemail-inbox/utils.ts`)
```ts
export function stripReplyPrefixes(s: string): string { /* regex /^\s*(re|r|fwd|fw|i)\s*:\s*/gi loop */ }
export function extractSenderName(raw: string|null): string { /* "Mario Rossi <a@b>" → "Mario Rossi"; "a@b" → "a" */ }
export function makeSnippet(text: string|null, max=180): string { /* strip ws, slice */ }
```

### Drag&drop
Verifico se `@dnd-kit/sortable` è già installato (probabile). Se manca, lo aggiungo.

---

## Cosa NON tocco
- DAL `listFunnemailGroupedInbox` resta uguale, cambio solo l'assegnazione `priority/secondary` di default.
- Hook `useFunnemailInbox` invariato.
- `EmailMessageList.tsx` globale e Inbox V1/V2 standard: **invariati**, niente regressioni.
- Nessuna migrazione DB.

---

## Domande prima di partire
1. Persistenza ordine sidebar: **localStorage** (per-device, semplice) o **DB tabella `funnemail_user_folder_order`** (cross-device, richiede migrazione)? Default proposto: localStorage.
2. Header lettore: modifica chirurgica `EmailDetailView` (rischio basso ma impatta anche altre Inbox) **oppure** componente Funnemail-only? Default proposto: modifica chirurgica minimale (solo `break-words` + spostamento bandiera + stripping prefissi).
