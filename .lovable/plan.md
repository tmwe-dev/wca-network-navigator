# Refactoring Grafico Globale + Menu

## Problema (verificato nel codice)

1. **Contrasti rotti**: `CockpitContactHeader.tsx` riga 67 usa `text-white` per il nome contatto (bianco su card chiara nel tema light → invisibile, esattamente la tua schermata), riga 80 `text-sky-200`, riga 81 `text-emerald-300/90`, riga 134 `text-[hsl(210,80%,55%)]`. Sono colori fissi che ignorano il tema.
2. **Sistema colore frammentato**: la logica tema vive in 3 punti scollegati — `main.tsx` (applica pre-render), `src/v2/ui/theme/ThemePicker.tsx` (4 temi × 2 modi + custom events), `src/index.css` (1014 righe di token + TextIntensity). Nessuna SSOT.
3. **Debito diffuso**: **623 occorrenze** di utility hardcoded (`text-white`, `bg-gray-*`, `text-sky-200`, `text-[#...]`, `text-emerald-500/80`...) in decine di file. Ogni nuovo tema/modo le rompe.
4. **Menu pesante**: `NavMenuPopover.tsx` (551 righe) + `navConfig.tsx` (148) + `LayoutSidebarNav`, `LayoutIconRail`, `OrphanPagesNav`, `registry.ts` con possibile codice morto e duplicazione.

## Principio guida (rispettando le tue regole)

- **Un solo metodo per tema**: tutti i colori passano per token semantici HSL definiti in `index.css`. I componenti usano SOLO classi semantiche (`text-foreground`, `bg-card`, `text-primary`, `text-success`...). Zero colori raw nei `.tsx`.
- **Modifiche minime, locali, reversibili**. Nessun refactor della logica di business. Solo presentazione + struttura menu.
- **Contrasto verificato** (WCAG AA) su ogni combinazione tema×modo prima di dire "fatto".

---

## Fase 1 — Consolidare il modulo colore (SSOT)

**Obiettivo**: un unico modulo che comanda colori e tema di tutte le pagine.

1. Centralizzare in `src/v2/ui/theme/`:
   - `themeRegistry.ts`: SSOT di temi (`amber/lilac/space/notte`), modi (`light/dark`), chiavi storage, eventi. `main.tsx` e `ThemePicker.tsx` importano da qui invece di duplicare le stringhe.
   - Mantenere `index.css` come unica sorgente dei valori HSL per ogni `(tema, modo)` — già strutturato così, lo si completa e si verifica.
2. **Audit token mancanti**: garantire che ogni tema×modo definisca l'intero set: `background, foreground, card, card-foreground, popover(+fg), primary(+fg), secondary(+fg), muted(+fg), accent(+fg), destructive, success, warning, border, input, ring, chart-1..5`. Aggiungere quelli assenti (es. `success`, `warning`, `chart-*` per i canali email/wa/linkedin) così da eliminare i `text-emerald-*`, `text-sky-*` hardcoded.
3. **Tabella contrasti**: documentare in `mem://design/color-token-system` le coppie fg/bg per ogni tema×modo con rapporto di contrasto target ≥ 4.5:1 (testo) / 3:1 (UI). Verifica con script di calcolo contrasto sui valori HSL.

## Fase 2 — Bonifica colori hardcoded (623 occorrenze)

Sostituzione meccanica e verificata, **un dominio alla volta** per non rompere:

| Hardcoded | → Token semantico |
|---|---|
| `text-white` / `text-black` | `text-foreground` o `text-primary-foreground` (in base allo sfondo) |
| `text-gray-*` / `text-slate-*` | `text-muted-foreground` / `text-foreground` |
| `text-sky-*`, `text-blue-*` (LinkedIn) | `text-chart-3` / token canale |
| `text-emerald-*`, `text-green-*` (WhatsApp/ok) | `text-success` |
| `text-amber-*`, `text-yellow-*` | `text-warning` |
| `text-red-*` | `text-destructive` |
| `text-[hsl(...)]`, `text-[#...]` | token dedicato |

Ordine di intervento (dal più visibile):
1. **Cockpit** (`src/components/cockpit/*` — la tua schermata): fix immediato `CockpitContactHeader`, `CockpitContactCard`, `CockpitContactListItem`, `ContactStream`.
2. Card/liste condivise (`CompanyCard`, `ContactSubCard`, `MailRowChrome`).
3. Pagine ad alto debito: calendar, ra, email-intelligence, guida, download, operations, analytics, prospect.
4. Resto del codebase fino a **0 utility colore raw** (escluse eccezioni legittime: globe/canvas WebGL che non sono UI tematizzata).

Dopo ogni dominio: typecheck + screenshot Playwright nei 4 temi × 2 modi della pagina toccata.

## Fase 3 — Guardrail anti-regressione

- Regola ESLint custom (estende le regole già presenti in `eslint-rules/`) che **vieta** `text-white|bg-white|text-black|text-gray-*|text-[#...]|text-[hsl(...)]` nei `.tsx` di UI, con whitelist per canvas/globe.
- Così il problema non può ripresentarsi.

## Fase 4 — Refactor menu (pulizia + alleggerimento)

1. **Mappa attuale**: `navConfig.tsx` (SSOT `MACRO_AREAS`/`macroAreaGroups`), `NavMenuPopover.tsx` (551 righe), `LayoutSidebarNav`, `LayoutIconRail`, `OrphanPagesNav`, `registry.ts`, `MobileBottomNav`, `CommandPalette`.
2. **Codice morto**: identificare voci/pagine orfane non più raggiungibili, import inutilizzati, branch duplicati tra popover desktop e mobile. Rimuoverli.
3. **Alleggerire `NavMenuPopover`**: estrarre i sotto-componenti ripetuti (header macro-area, riga gruppo collassabile, riga voce) in piccoli componenti riusabili; ridurre la complessità mantenendo identico il comportamento (7 macro-aree + Development con "Apri pagina", drawer overlay).
4. Mantenere la SSOT in `navConfig`: aggiungere una voce resta = 1 riga.

## Sezione tecnica

- **File nuovi**: `src/v2/ui/theme/themeRegistry.ts`, regola in `eslint-rules/`, memoria `mem://design/color-token-system`.
- **File modificati (struttura)**: `main.tsx`, `ThemePicker.tsx`, `index.css`, `NavMenuPopover.tsx`, `navConfig.tsx` + estrazioni.
- **File modificati (colori)**: ~decine di `.tsx`, solo `className`, nessuna logica.
- **Vincoli rispettati**: nessuna modifica a logica/dati/RLS/edge; nodi critici non toccati; modifiche reversibili per dominio.
- **Verifica**: typecheck dopo ogni fase; Playwright screenshot 4 temi × 2 modi sulle pagine chiave (cockpit, contacts, outreach, settings, command); `rg` per confermare 0 hardcoded residui; ESLint verde.

## Esecuzione

Lavoro profondo a fasi, ognuna verificata prima della successiva. Procedo autonomamente fase per fase una volta approvato, partendo dal fix Cockpit visibile nella tua schermata.