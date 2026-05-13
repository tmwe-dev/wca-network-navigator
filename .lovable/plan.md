## Spiegazione tasti header (destra)

Stato attuale del cluster destro della top bar (`src/v2/ui/templates/LayoutHeader.tsx`):

1. **🔔 Campanella** → `NotificationCenter`. Centro notifiche (sistema, alert, agenti). **Da mantenere**, ok.
2. **⬇ Estensioni Chrome** → `DownloadExtensionsButton`. Apre la pagina di download delle estensioni. **Da mantenere**, ok.
3. **🎨 Temi (icona palette)** → `ThemePicker variant="icon"`. Duplicato: i temi sono già dentro la sidebar/menu. **Da rimuovere**.
4. **🔄 Scarica ora** → `GlobalSyncButton` (file `WhatsAppSyncButton.tsx`). Un click lancia in parallelo il fetch immediato sui 3 canali:
   - **Email**: chiama `check-inbox` (single-flight via `callCheckInbox`) — scarica subito le nuove mail IMAP.
   - **WhatsApp**: emette evento `wa-sync-trigger` consumato dall'auto-sync WA dell'estensione, che esegue un giro di download immediato senza resettare la cadenza programmata.
   - **LinkedIn**: emette `li-sync-trigger`, idem per LinkedIn.
   Funziona anche con auto-sync in pausa. Mostra spinner mentre lavora, badge verde col numero di nuovi messaggi WA quando ce ne sono, toast finale "Sincronizzazione avviata". Accanto compare il badge "scudo" `SyncGuardIndicator` (controllo tempi umani — uno solo, icon-only, già fixato prima).
5. **👤 Operator selector** → `OperationalContextSelector`. Cambio operatore/casella attiva. Mantenuto.
6. **⋯ Strumenti** → `HeaderToolsMenu`. Mantenuto.
7. **✨ Sparkles** → apre `IntelliflowOpen` (IntelliFlow AI / "Secretary"). **Da rimuovere**: l'utente segnala che non funziona e Command Page copre già la stessa funzione.

---

## Modifiche richieste (UI-only)

### A. Rimuovere icona Tema dalla top bar
`src/v2/ui/templates/LayoutHeader.tsx`
- Eliminare `<ThemePicker variant="icon" />` (riga 112) e l'import relativo (mantenere `useInitTheme`).
- Risultato: tema gestito solo dalla sidebar (`ThemePicker` menu-row), come da richiesta.

### B. Rimuovere pulsante ✨ IntelliFlow AI
`src/v2/ui/templates/LayoutHeader.tsx`
- Eliminare il `<Button>` Sparkles finale (righe 122–131) e l'import `Sparkles` da lucide-react.
- Rendere `onAiClick` opzionale nelle Props (o rimuoverlo) e aggiornare il call site in `AuthenticatedLayout.tsx` (riga 369) lasciando lo state `intelliflowOpen` ma senza più trigger dall'header (la modale resta accessibile via shortcut/Command se serve in futuro; nessun altro entry point viene toccato).
- Nota: non rimuovo il componente IntelliFlow né lo state — solo l'entry point dalla top bar, così non rompo nulla a valle.

### C. Mantenuti senza modifiche
- 🔔 `NotificationCenter`
- ⬇ `DownloadExtensionsButton`
- 🔄 `GlobalSyncButton` + `SyncGuardIndicator` (icon-only)
- 👤 `OperationalContextSelector`
- ⋯ `HeaderToolsMenu`

---

## Controindicazioni / note

- Il pulsante ✨ è l'unico entry point dell'header per IntelliFlow. Se in futuro vorrai riattivarlo, basta ripristinare il `<Button>`. Il componente sottostante resta montato, quindi nessuna regressione su Command Page o altri flussi.
- `ThemePicker` resta usato dalla sidebar — l'import `useInitTheme()` deve rimanere in `LayoutHeader` per inizializzare il tema all'avvio.
- Nessuna logica AI / backend / DAL toccata: intervento puramente di presentazione, atomico (Metodo Enterprise Vol II rispettato).

## File toccati
- `src/v2/ui/templates/LayoutHeader.tsx` (rimozione 2 elementi + import)
- `src/v2/ui/templates/AuthenticatedLayout.tsx` (rimozione prop `onAiClick` passata a header)