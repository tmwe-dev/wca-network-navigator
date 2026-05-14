## Obiettivo
Eliminare il doppione di navigazione: tenere **un solo menu**, l'icon rail laterale (sempre visibile, già usata per navigare con 1 click). Rimuovere il popover hamburger che duplica le stesse voci comparendo davanti al contenuto.

## Cosa cambia (UI-only, zero logica)

### 1. `src/v2/ui/templates/LayoutIconRail.tsx`
- Rimuovere il blocco "Hamburger lilla" (righe 47–61) che renderizza `<NavMenuPopover>` con il pulsante a tre linee.
- Lasciare l'icon rail così com'è (icone + tooltip + sotto-popover contestuali per le sezioni con figli, già funzionanti via `EXPANDABLE_MAIN_NAV`).
- Rimuovere import `NavMenuPopover` (resta `EXPANDABLE_MAIN_NAV`, `sectionRoot`).

### 2. Altri call site di `NavMenuPopover` — verificare se vanno toccati
- `src/v2/ui/templates/LayoutHeader.tsx` → controllare se monta un secondo trigger (riga ~40 menziona "bottone ☰ ora apre il NavMenuPopover globale"); se sì, sostituire con un semplice pulsante che apra la `CommandPalette` (già montata, ⌘K). Mantenere comportamento mobile.
- `src/v2/ui/theme/ThemePicker.tsx`, `src/v2/ui/pages/command/components/CommandPageBackButton.tsx`, `src/v2/navigation/registry.ts` → solo se realmente renderizzano un trigger nav: lasciare il file `NavMenuPopover.tsx` in repo (non lo cancello, evita rotture import) ma rimuoverne l'uso visibile.

### 3. Mobile
- Sul mobile resta `LayoutSidebarNav` (drawer apribile dall'hamburger header mobile). Nessuna modifica.

## Risultato
- Un solo menu visibile: l'icon rail verticale a sinistra.
- Hover su un'icona → tooltip con il nome.
- Click su una sezione "espandibile" (es. Rubriche) → mini-popover contestuale con le sotto-voci di QUELLA sezione (non l'intero menu).
- Niente più lista lunga che esce davanti al contenuto.

## Out-of-scope
- Nessun cambio logico, nessun edge function, nessun cambio dati.
- Il file `NavMenuPopover.tsx` resta sul filesystem (export `EXPANDABLE_MAIN_NAV` e `sectionRoot` sono usati altrove); rimuovo solo il rendering del trigger.