## Obiettivo

Trasformare `/v2/prompt-reader` in un layout a 2 pannelli (Prompt Reader ↔ Co-pilot) **invertibili via drag & drop**, con il **menu agenti spostato dentro la sidebar a scomparsa** e il Co-pilot espandibile a tutta larghezza per leggere comodamente in verticale.

## Layout target

```text
┌─────────────────────────────────────────────────────────────┐
│ Header: Home / Prompt Reader   [Proposte][Ricarica][Export] │
├──┬──────────────────────────────────────────────────────────┤
│≡ │ ┌─ Pannello A ─────────┐  ┌─ Pannello B ──────────────┐ │
│M │ │ ⠿ Prompt Reader      │  │ ⠿ Co-pilot                │ │
│E │ │   (chiaro, blocchi)  │  │ (chat, proposte, KB)     │ │
│N │ │                      │  │                           │ │
│U │ │                      │  │            [⛶ espandi]   │ │
└──┴────────────────────────┘  └──────────────────────────┘ │
```

- **Sidebar a scomparsa (sinistra)**: contiene la lista agenti raggruppata per categoria (oggi è inline). Tab/linguetta come quella già presente per aprire/chiudere.
- **Pannello A / Pannello B**: due colonne 50/50. Hanno una **handle in alto** (icona `⠿ GripVertical`). Trascinando una handle sopra l'altra, i due pannelli si **scambiano di posto** (animazione 200ms). Lo stato dell'ordine è persistito in `localStorage` (`prompt-reader.panel-order`).
- **Espansione Co-pilot**: bottone `⛶` in alto a destra del Co-pilot. Quando attivo, il Co-pilot occupa **entrambe le colonne** (full-width sull'area centrale, sidebar agenti resta a scomparsa). Stesso bottone per tornare a 50/50. Stato persistito (`prompt-reader.copilot-expanded`).
- Quando Co-pilot è espanso, la chat e l'area "Modifica proposta" guadagnano spazio verticale: il pannello chat usa l'altezza disponibile (`flex-1`), e il box "Modifica proposta dall'AI" passa da `max-h-[45%]` a `max-h-[60%]` con `ScrollArea` interno per leggere proposte lunghe senza tagli.

## Comportamenti chiave

1. **Drag & drop swap**: implementato con `@dnd-kit/core` (già nel progetto se presente) o, se non disponibile, con HTML5 nativo (`draggable`, `onDragStart`, `onDrop`). Solo 2 zone di drop, nessuna libreria pesante. Animazione fade/translate via `transition-all`.
2. **Sidebar agenti**:
   - Linguetta verticale stile attuale, di default **chiusa** quando l'utente apre il Co-pilot espanso.
   - Width 240px quando aperta, 0 quando chiusa.
   - Manteniamo i 7 gruppi (`core/email/outreach/...`) e la search non c'è oggi: non la aggiungiamo.
3. **Co-pilot espanso**:
   - Pulsante `Maximize2 / Minimize2` (lucide) in header del pannello.
   - In modalità espansa, il Pannello A (Prompt Reader) si nasconde con `hidden`, non viene smontato (state preservato in cache `cache[id]`).
   - Quando l'utente clicca un blocco "Modifica con Co-pilot" nel Reader (futuro hook), il Co-pilot torna automaticamente a 50/50.
4. **Ordine pannelli**: l'inversione cambia solo la posizione visiva. Le props passate a `PromptCopilotPanel` restano invariate (`agentSlug`, `blockName`, `currentContent`).

## File toccati (solo presentation)

- `src/v2/ui/pages/prompt-lab/PromptReaderPage.tsx`
  - Estrarre la lista agenti in `<aside>` di sinistra (sidebar a scomparsa, già esiste: spostare DENTRO il menu navigazione che oggi sta inline) — oggi è già così, va solo confermato che il menu è UNICAMENTE in quella sidebar collassabile.
  - Sostituire `<main> + <aside>` (Reader + Co-pilot) con un contenitore `SwapPanels` che gestisce ordine + espansione.
  - Aggiungere stato: `panelOrder: ["reader","copilot"] | ["copilot","reader"]`, `copilotExpanded: boolean`. Persistenza `localStorage`.
- Nuovo: `src/v2/ui/pages/prompt-lab/components/SwapPanels.tsx`
  - Componente presentational con 2 slot (`left`, `right`), handle drag, swap on drop, supporto modalità "fullscreen right".
- `src/v2/ui/pages/prompt-lab/PromptCopilotPanel.tsx`
  - Aggiungere prop opzionale `expanded?: boolean` + `onToggleExpand?: () => void`. Bottone `Maximize2/Minimize2` in header. Quando `expanded`, alzare `max-h` del box "Modifica proposta" e dare più altezza alla chat.

## Cosa NON cambia
- Logica Co-pilot (`prompt-copilot-chat`, intake KB, proposte) invariata.
- Sidebar agenti contenuto/ordine/categorie invariati.
- ProposalsReviewPage invariato.
- Nessuna modifica a edge functions, DAL, hook AI.

## Risultato

L'utente entra su `/v2/prompt-reader`, vede 2 pannelli affiancati. Se vuole più spazio per scrivere/leggere col Co-pilot, clicca `⛶` e occupa tutta l'area; se preferisce avere il Co-pilot a sinistra, trascina la handle e i due pannelli si scambiano. Il menu agenti è sempre raggiungibile dalla linguetta a sinistra ma non occupa spazio quando non serve.
