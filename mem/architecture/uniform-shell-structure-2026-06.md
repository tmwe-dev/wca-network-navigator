# Struttura Shell Uniforme — Audit + Template Standard (2026-06)

## Problema risolto

Le sovrapposizioni in alto nascevano dal pulsante ☰ reso `fixed left-3 top-3`
che galleggiava SOPRA la top bar. Soluzione: il ☰ vive ora DENTRO `LayoutHeader`
(primo elemento del cluster sinistro). `LayoutIconRail` non è più montato su desktop.

## SSOT struttura

`src/v2/ui/templates/layoutTokens.ts` — altezze fisse, padding, gap, scala z-index.
Nessun elemento `fixed` deve coprire contenuto: o sta dentro una zona in flusso
o rispetta Z + offset di sicurezza.

## Zone strutturali (dall'alto)

1. Top bar globale (`LayoutHeader`, h-11): ☰ + StatusPill + slot titolo (`#page-title-slot`) | cluster destro.
2. Header di pagina in-mask (`StandardPageFrame`, h-9): breadcrumb/titolo + ✦AI + azioni.
3. Toolbar contestuale opzionale (h-9).
4. Contenuto. Rail filtri (sx) e workflow (dx) governati da `pageContract.ts`.

## Inventario header (audit Fase 1)

- `PageTitleHeader` (portal in top bar): 22 pagine — pill titolo+sottotitolo.
- `StandardPageFrame` (header in-mask): Cockpit, Comms.
- `ExploreContextHeader`: sezione Esplora (barra unica breadcrumb+tab).
- `GoldenHeaderBar`: ORFANO (0 usi) → da rimuovere.
- `AutoPageTitle`: 0 usi.

## Categorie elementi e regola target

- Top bar: ☰ a sinistra, titolo via slot, cluster azioni a destra (gap-0.5).
- Titoli: un solo header per pagina (no doppioni top bar + in-mask).
- Toolbar: zona dedicata sotto header, altezza h-9, gap-2.
- Badge: `px-2 py-1 rounded-md` + border, token semantici, no colori custom.
- Icon button: hit-area min 40px mobile, h-8 w-8 desktop.
- Ricerca: globale ⌘K; di pagina nel proprio toolbar; mai duplicata in top bar.

## Da fare (incrementale, pagina per pagina, solo presentazione)

- Decidere canonico header unico e migrare i 22 `PageTitleHeader`.
- Rimuovere `GoldenHeaderBar` / `AutoPageTitle` orfani.
- Maschere speciali (Command, Cockpit, Comms, Campagne, Network, Lab, Settings): analisi singola.
