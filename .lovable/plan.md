
# Funny Mail — sort, gruppi, azioni stabili, slot AI

Tutto resta in frontend (UI + hook). Riuso i componenti standard già presenti in altre maschere: `EmailMessageActions` (Azioni con `MoreHorizontal`) e `InlineGroupAssigner` (popover con icona `Tag`). Zero nuove edge function, zero modifiche DAL/DB.

## 1. Card mail (FunnemailMailCard)

- **Tolgo le hover-actions** (Reply / Forward / InlineGroupAssigner che apparivano al passaggio del mouse).
- **In basso a destra, sempre visibili**, due controlli affiancati identici alle altre maschere:
  - `EmailMessageActions` (dropdown "⋯ Azioni" con Segna come letto / Archivia / Sposta in… / Nascondi / Spam / Crea regola).
  - `InlineGroupAssigner` (pulsantino "Assegna gruppo" / "Modifica" con popover esistente).
- **Slot "Suggerimento AI"** dove ora compare il pill del gruppo: rimuovo il badge del gruppo già assegnato (l'utente vede comunque il gruppo dentro il popover di Assegna). Nello stesso slot mostro:
  - quando c'è una `funnemail_decisions.suggested_*` (folder o address) → chip "AI: <gruppo proposto>" cliccabile per accettare,
  - altrimenti chip neutro "—".
  Per ora il suggerimento è opzionale: se nei dati grouped non arriva, lo slot resta vuoto. La struttura è pronta per quando attiveremo la classificazione AI.
- Tolgo `Reply`/`Forward` dai prop della card (non servono più). Il dettaglio email a destra continua ad avere reply/forward/azioni come oggi.

## 2. Lista mail centrale (FunnemailMailList + nuova toolbar)

Nuova mini-toolbar sopra la lista (sotto la search):

- **Ordina per**: `Data ↓` (default) · `Azienda A→Z` · `Mittente A→Z` · `Oggetto A→Z`.
- **Raggruppa per**: `Nessuno` (default) · `Azienda` · `Mittente`.
- Selezione persistita in `localStorage` (`funnemail_list_view_v1`).

Quando "Raggruppa per" è attivo:
- la virtualizzazione esistente viene sostituita da una lista a sezioni collassabili (gruppi piccoli — non servono migliaia di righe per gruppo, già filtrate per cartella);
- ogni sezione ha header con: nome gruppo, conteggio, freccia collassa/espandi, e un menu "⋯ Azioni gruppo" con: **Segna tutte come lette**, **Assegna gruppo a…** (popover compatto con la lista gruppi), **Archivia tutte**, **Elimina tutte (cestino)**.
- Le azioni di gruppo riusano `useBulkEmailAction` (già supporta array) e `useMarkAsRead` in loop. "Elimina tutte" usa `action: "delete"` (è già soft-delete via trigger DB su `channel_messages`).
- Conferma modale solo per Archivia/Elimina quando il gruppo > 20 messaggi.

## 3. Sidebar cartelle (InboxGroupsSidebar nel drawer)

In cima al pannello cartelle, un piccolo segmento "Ordina":

- `Default` (come oggi: priorità + sort_order + drag&drop utente)
- `Nome A→Z`
- `Email ↓` (più piene in alto)

Selezione persistita in `localStorage` (`funnemail_sidebar_sort_v1`).
Il drag&drop manuale resta attivo solo nella modalità "Default" (negli altri due l'ordine è automatico, le maniglie restano nascoste). Le sezioni Prioritarie / Secondarie / Da classificare e la cartella "Tutte le inbox" non cambiano.

## 4. File toccati

Modificati:
- `src/v2/ui/pages/funnemail-inbox/FunnemailMailCard.tsx` — rimuovo hover-actions, aggiungo slot Azioni + Assegna gruppo in basso a destra, sostituisco badge gruppo con slot suggerimento AI.
- `src/v2/ui/pages/funnemail-inbox/FunnemailMailList.tsx` — nuova toolbar Ordina/Raggruppa, rendering condizionale virtual vs raggruppato, propagazione azioni di gruppo.
- `src/v2/ui/pages/funnemail-inbox/InboxGroupsSidebar.tsx` — aggiunta segmented "Ordina" in cima, applicazione sort in `sortBySection`.
- `src/v2/hooks/useFunnemailInbox.ts` — espongo handler bulk (markRead/archive/delete/assignGroup) per le azioni di gruppo, costruite sopra `useBulkEmailAction` + `upsertEmailAddressRule`.

Nuovi:
- `src/v2/ui/pages/funnemail-inbox/FunnemailListToolbar.tsx` — mini-toolbar Ordina/Raggruppa (logic-less).
- `src/v2/ui/pages/funnemail-inbox/FunnemailGroupHeader.tsx` — header sezione con menu Azioni di gruppo.
- `src/v2/ui/pages/funnemail-inbox/AiSuggestionChip.tsx` — chip slot per il suggerimento AI (placeholder pronto, mostra "—" se assente).

Non modificati:
- `src/data/funnemailInbox.ts` (DAL), DB, edge functions, `EmailMessageActions`, `InlineGroupAssigner`.
- Componenti V1 e altre pagine.

## 5. Note

- Tutto in TypeScript stretto, nessun `any`.
- Nessuna modifica al fetch/paginazione: il sort/raggruppamento è client-side sulla lista già filtrata per cartella (max 5000 messaggi, già supportato dalla virtualizzazione esistente; quando raggruppato uso un fallback non-virtualized solo dentro le sezioni espanse).
- Editorial review e altri vincoli non sono toccati: queste sono operazioni di lettura/sposta/elimina, non di invio.
- Verifico in preview dopo l'implementazione: card senza hover, toolbar funzionante, drawer con sort, raggruppamento + azioni di gruppo che invalidano correttamente la query.
