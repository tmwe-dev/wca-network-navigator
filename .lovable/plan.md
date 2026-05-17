# Piano: menu unico in stile Command su tutte le pagine

## Obiettivo
Avere **un solo menu di navigazione** in tutto il sistema: il pulsante fluttuante ☰ Menu in alto a sinistra che apre il `NavMenuPopover` (lo stesso usato oggi in `/v2/command`). Eliminare la top bar e la barra laterale a icone che compaiono nelle altre pagine.

## Cosa viene rimosso (visivamente)
1. **Top bar orizzontale** (`LayoutHeader`) — la barra in alto con StatusPill, Automations, NotificationCenter, OperatorSelector, ⋯ Strumenti, toggle tema, ecc.
2. **Icon rail verticale a sinistra** (`LayoutIconRail`) — la striscia stretta di icone sulla sinistra desktop.
3. **Header mobile** ridotto a solo il pulsante ☰ fluttuante (stesso del Command).

## Cosa resta
- Pulsante ☰ Menu fluttuante in alto a sinistra (come oggi in Command) montato globalmente.
- Apre `NavMenuPopover` che già contiene: navigazione (Generali/Agenti/Update/Import & Export/Contatori/Report/Posta/Master/TEST/Team/Development), Tema, Modalità Chiaro/Scuro, dimensione Testo, Logout.
- Overlays globali (CommandPalette ⌘K, MissionDrawer, FiltersDrawer, ContactRecordDrawer, FloatingCoPilot, Toaster, OfflineBanner, BlacklistStaleBanner) restano attivi.
- `ContextFiltersRail` (linguetta filtri contestuale a destra) e `MobileBottomNav` restano.

## Funzionalità da preservare (spostate nel popover o nei drawer)
Le azioni che oggi vivono nella top bar vengono o (a) già coperte dal `NavMenuPopover`/scorciatoie esistenti, o (b) integrate come voci nel popover stesso:
- **NotificationCenter** → icona campanella nell'header del popover.
- **OperationalContextSelector** (operatore attivo) → riga dedicata nel popover sopra "Tema".
- **WhatsAppSyncButton / DownloadExtensionsButton** → sezione "Strumenti" del popover (o resta accessibile da `/v2/settings`).
- **HeaderToolsMenu** (Add contact, Agent dashboard, Test estensioni, toggle tema) → toggle tema è già nel popover; le altre voci diventano item del popover sotto "Development".
- **StatusPill / AutomationsPanel** → spostate come riga "Stato sistema" in cima al popover (read-only badge + click apre il pannello esistente).
- **CommandPalette ⌘K**: invariato (scorciatoia tastiera).

## File toccati
- `src/v2/ui/templates/AuthenticatedLayout.tsx` — rimuovere `<LayoutHeader>`, `<LayoutIconRail>`, mobile header custom e mobile sidebar drawer (`LayoutSidebarNav`); montare un singolo `<GlobalNavTrigger>` fisso.
- `src/v2/ui/templates/GlobalNavTrigger.tsx` *(nuovo)* — wrapper del pulsante ☰ Menu fluttuante (estratto/condiviso con `CommandPageBackButton`), montato globalmente.
- `src/v2/ui/templates/NavMenuPopover.tsx` — aggiungere le righe extra: NotificationCenter, OperationalContextSelector, scorciatoie strumenti (Add contact, Agent ops, Test estensioni, WA sync, Download estensioni), badge stato sistema.
- `src/v2/ui/pages/command/components/CommandPageBackButton.tsx` — diventa un re-export di `GlobalNavTrigger` (Command non ha più bisogno di un pulsante custom; usa quello globale).
- Padding `main` in `AuthenticatedLayout`: rimuovere `md:pl-14` (non c'è più icon rail) e `mt-12` mobile (non c'è più header mobile); aggiungere top padding minimale per non finire sotto il pulsante fluttuante.

## File NON eliminati (solo non più referenziati nel layout)
`LayoutHeader.tsx`, `LayoutIconRail.tsx`, `LayoutSidebarNav.tsx`, `header/*` rimangono nel repo (per policy "no delete unused"), ma non vengono più importati dal layout principale.

## Verifiche post-modifica
- `/v2/command`: aspetto invariato (pulsante ☰ in alto a sinistra, popover funzionante).
- `/v2/cockpit`, `/v2/inbox`, `/v2/email`, `/v2/agenda`, `/v2/network`: nessuna top bar, nessuna icon rail, solo ☰ fluttuante. Contenuto principale a tutta larghezza/altezza.
- Mobile: stesso pulsante ☰ fluttuante; nessun header WCA Partners in cima.
- Notifiche, switch operatore, tema, logout raggiungibili dal popover.
- `ContextFiltersRail` (linguetta destra) e drawer Mission ancora apribili.
- Build verde.

## Note
- Cambio puramente UI di layout (rispetta linee guida: non tocco logica, hook, dati, edge functions).
- Reversibile: ripristinare i 2 import in `AuthenticatedLayout` riporta header+rail.
