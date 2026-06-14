# Piano: Template di struttura unico + zero sovrapposizioni

## Diagnosi (perché si accavallano)

Oggi convivono **più sistemi di intestazione in parallelo**, ognuno con regole, altezze e z-index diversi:

| Sistema | Dove vive | Pagine | Altezza |
|---|---|---|---|
| `LayoutHeader` (top bar globale) | sempre montata | tutte | 44px (`h-11`) |
| `PageTitleHeader` (portal in `#page-title-slot`) | dentro LayoutHeader | **22 pagine** | inline |
| `StandardPageFrame` (header in-mask + ✦AI) | nella maschera | **2 pagine** | 36px (`h-9`) |
| `GoldenHeaderBar` | — | 0 (orfano) | 32px |
| `ExploreContextHeader` / `CommandPageHeader` | speciali | 2+ | varie |
| `LayoutIconRail` (☰ fluttuante) | `fixed left-3 top-3` | globale | 40px |

**Causa diretta dell'overlap in alto** (screenshot): il pulsante ☰ è `fixed` a `left-3 top-3` e **galleggia sopra** la top bar, che però inizia a `px-4` senza riservare spazio a sinistra → ☰ copre lo StatusPill / inizio del cluster sinistro.

**Cause sistemiche delle altre sovrapposizioni:**
- Due paradigmi opposti (header globale con portal **vs** header in-maschera) → titoli che compaiono in due punti o si accavallano.
- Ogni pagina impila toolbar proprie (barra sincronizzazione, riga ricerca, chip filtri) con spaziature e z-index arbitrari.
- Nessun token condiviso per altezze, gap, z-index, padding di sicurezza.

## Obiettivo

Un **unico template strutturale** (zone fisse, altezze fisse, z-index a livelli) applicato a tutte le pagine "normali". Le maschere speciali restano fuori e si analizzano una per una. La priorità è l'**uniformità** del resto.

---

## Fase 0 — Fix immediato dell'overlap ☰ / top bar

Senza rifattorizzare nulla:
- Riservare lo spazio del ☰ nella top bar: aggiungere padding-left sul cluster sinistro di `LayoutHeader` (desktop) pari alla larghezza del pulsante + gap, così ☰ e StatusPill non si toccano mai.
- Allineare ☰ verticalmente all'altezza esatta della top bar (stessa `h`, stesso asse) invece di `top-3` arbitrario.
- Definire una scala z-index unica (vedi Fase 2) e applicarla a ☰, top bar, popover, drawer, toast/notifiche per evitare che la notifica email in alto copra i controlli.

Risultato: la barra in alto torna leggibile e cliccabile su tutte le pagine.

## Fase 1 — Audit categorizzato di tutti gli elementi

Censimento sistematico, **una categoria alla volta**, con inventario file→componente e regole target:

1. **Top bar globale** — cluster sinistro/destro, slot portal, comportamento mobile.
2. **Header di pagina / titoli** — `PageTitleHeader` (22), `StandardPageFrame` (2), `ExploreContextHeader`, `GoldenHeaderBar` (orfano da rimuovere).
3. **Toolbar contestuali** — barre azioni di pagina (es. SINCRONIZZAZIONE / AZIONI in Inbox), riga ricerca, chip filtri attivi.
4. **Badge** — NEW, contatori, stato (online/offline), "Condivisa".
5. **Icone & pulsanti icona** — dimensioni, hit-area minima, allineamento.
6. **Campi di ricerca** — globale (⌘K) vs di pagina vs nel popover.
7. **Rail laterali** — filtri (sx) e workflow (dx) già governati da `pageContract`.

Output: tabella unica "elemento → dove sta oggi → regola standard".

## Fase 2 — Definizione del template standard (design tokens)

Sorgente unica di verità per la struttura, senza colori custom (solo token semantici):

- **Zone fisse** (dall'alto): `[Top bar globale]` → `[Header di pagina]` → `[Toolbar pagina opz.]` → `[Contenuto]`, con rail sx/dx ai lati.
- **Altezze fisse** standard: top bar, header pagina, toolbar (un token ciascuna, riusato ovunque).
- **Scala z-index a livelli** documentata: contenuto < rail < header < ☰/top bar < popover/drawer < toast.
- **Padding di sicurezza**: offset costante per gli elementi `fixed` (☰, linguette) così non coprono mai contenuto.
- **Un solo componente header**: consolidare su **`StandardPageFrame`** come unico header di pagina (titolo/breadcrumb + ✦AI + slot azioni + tabs pill), ritirando `PageTitleHeader`, `GoldenHeaderBar` e lo slot portal.
- Documentare in `mem/architecture/` (estende il contratto shell esistente).

## Fase 3 — Migrazione pagine "normali" all'header unico

Migrazione incrementale, pagina per pagina, **senza toccare la logica** (solo presentazione), riusando il pattern già applicato a Cockpit/Comms:
- Sostituire `PageTitleHeader` con `StandardPageFrame` (titolo + eventuali azioni nello slot).
- Spostare le toolbar di pagina nella zona dedicata sotto l'header, con altezza/gap standard.
- Verifica visiva desktop + mobile (drawer) per ogni pagina migrata.
- A migrazione completa: rimozione di `PageTitleHeader`, `GoldenHeaderBar`, slot `#page-title-slot`.

## Fase 4 — Maschere speciali (analisi individuale, dopo l'uniformità)

Non toccate nella standardizzazione di massa; ognuna avrà una mini-analisi dedicata, preservandone il comportamento. Candidate: **Command**, **Cockpit**, **Comms**, **Campagne**, **Network/Explore**, **Lab**, **Settings**. Per ciascuna: cosa conservare (funzioni custom) e come agganciare l'header standard senza regressioni.

---

## Note tecniche

- File chiave: `LayoutHeader.tsx`, `LayoutIconRail.tsx`, `AuthenticatedLayout.tsx`, `StandardPageFrame.tsx`, `PageTitleHeader.tsx`, `GoldenHeaderBar.tsx`, `SectionTabs.tsx`.
- Solo modifiche frontend/presentazione; nessun cambiamento a hook, dati, RLS o edge.
- Modifiche minime, locali e reversibili; ogni pagina verificata prima di passare alla successiva.
- I rail filtri (sx) / workflow (dx) restano governati da `pageContract.ts`.

## Ordine di esecuzione proposto

1. Fase 0 (fix overlap ☰) — sblocca subito la leggibilità.
2. Fase 2 (token + scelta header unico) — fondamenta.
3. Fase 1 (audit) in parallelo come riferimento.
4. Fase 3 (migrazione pagine normali).
5. Fase 4 (speciali, una ad una).
