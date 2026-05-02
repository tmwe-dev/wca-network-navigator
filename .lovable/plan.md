# Sostituzione "← Dashboard" con dropdown "Menu" in Command

## Problema
Nella pagina `/v2/command` il pulsante in alto a sinistra è una freccia "← Dashboard" che porta a `/v2`, cioè a `DashboardPage`, una pagina che non è più nel menu principale (la nuova home reale è `/v2/explore/network`). Risultato: l'utente clicca per "tornare indietro" e finisce in una pagina orfana, senza modo rapido di raggiungere le altre sezioni.

## Obiettivo
Trasformare quel pulsante da "freccia indietro" a **launcher di navigazione**: un click apre un dropdown che elenca tutte le destinazioni principali dell'app, esattamente le stesse della sidebar standard. Se l'utente non sceglie nulla, resta in Command.

## Cosa cambia (UX)

- **Etichetta**: da "← Dashboard" a "Menu" con icona griglia/burger (`Menu` o `LayoutGrid` di lucide-react). Stessa posizione (alto-sinistra, fixed), stesso stile glass/blur già usato.
- **Comportamento**: click → si apre un popover/dropdown verso il basso con la lista delle 6 voci di `navItemsDef` (Command escluso perché siamo già lì):
  - Esplora → `/v2/explore/network`
  - Pipeline → `/v2/pipeline/kanban`
  - Comunica → `/v2/communicate`
  - Email Intelligence → `/v2/email-intelligence`
  - Intelligence → `/v2/intelligence`
  - Config → `/v2/settings`
- Ogni voce mostra **icona + label tradotta** (i18n key già esistente in `nav.*`).
- Click su una voce → naviga e chiude il popover. Click fuori / Esc → chiude senza navigare (resti in Command).
- Voce attiva ("Command") nascosta dalla lista, oppure mostrata in cima come riga inattiva con check, per dare contesto.

## Cosa NON cambia
- Niente sidebar persistente in Command (resta una pagina fullscreen "zen").
- Nessun cambio alle altre pagine (la sidebar standard di `AuthenticatedLayout` continua a usare lo stesso `navConfig`).
- Nessun cambio al routing: `DashboardPage` resta registrata su `/v2` per backward-compat, semplicemente non ci passiamo più da Command.

## Dettagli tecnici

**File da modificare:**
- `src/v2/ui/pages/command/components/CommandPageBackButton.tsx`
  - Rinomina concettuale (il file resta, cambia solo il contenuto). In alternativa creare `CommandPageMenuButton.tsx` e rimuovere il vecchio.
  - Sostituisce `ArrowLeft` con `Menu` (lucide-react).
  - Avvolge il bottone in `<Popover>` (shadcn `@/components/ui/popover`, già usato nel progetto).
  - Rimuove la prop `onBack`. Eventualmente accetta `currentPath` opzionale per evidenziare/nascondere la voce attiva.
  - Lista voci letta da `navItemsDef` di `src/v2/ui/templates/navConfig.tsx` (single source of truth — già rispetta la regola "no inline arrays").
  - Label tradotte via `useTranslation()` con le chiavi `nav.command`, `nav.explore`, ecc. (già definite).
- `src/v2/ui/pages/CommandPage.tsx`
  - Rimuove `onBack={() => nav("/v2")}` e passa eventualmente `currentPath="/v2/command"` al nuovo componente.

**Stile:**
- Mantiene lo stesso look del bottone attuale (glass blur, border `white/[0.06]`, text `muted-foreground`) per coerenza con il "Zen mode" della pagina.
- Popover content: `bg-background/95 backdrop-blur-xl border border-white/10`, larghezza ~240px, voci con hover `bg-white/5`.

**Accessibilità:**
- Bottone con `aria-label="Apri menu di navigazione"`.
- Popover con focus trap (default shadcn).
- Voci come `role="menuitem"` navigabili da tastiera (frecce + Enter).

## Layout ASCII

```text
Prima:                          Dopo:
┌─────────────────────┐        ┌─────────────────────┐
│ [← Dashboard]       │        │ [☰ Menu]            │
│                     │        │   └─▼──────────────┐│
│        ◉            │   →    │     ◯ Esplora      ││
│ Cosa vuoi ottenere? │        │     ◯ Pipeline     ││
│                     │        │     ◯ Comunica     ││
│   [   input   ]     │        │     ◯ Email Intel. ││
│                     │        │     ◯ Intelligence ││
│                     │        │     ◯ Config       ││
└─────────────────────┘        └─────────────────────┘
```

## Test manuale
1. Aprire `/v2/command` → verificare bottone "Menu" in alto-sinistra.
2. Click sul bottone → popover con 6 voci.
3. Click su "Pipeline" → naviga a `/v2/pipeline/kanban`.
4. Tornare in Command → riaprire menu → premere Esc → resta in Command.
5. Verificare che NON ci sia più alcun riferimento a `/v2` (vecchia Dashboard) dal pulsante.
