
## Obiettivo

La pagina **CRM › Biglietti** (`/v2/pipeline/biglietti`) viene sostituita da una versione **ibrida** che unisce:

- **Layout principale** = come la pagina Network › BCA (gruppi per azienda, sidebar paesi, 3 viewMode, Quality Dashboard, Timeline Evento, sincronizzazione WCA).
- **Detail panel a destra** = come quello attuale CRM (foto, OCR confidence, dati contatto), **ma con le 4 azioni intelligenti molto più grandi** e che funzionano anche da **drop target** del drag&drop.
- **Drag & drop**: dalle card della view "media" (grid) si trascina il contatto e lo si rilascia su una delle 4 azioni intelligenti del pannello laterale; **il bersaglio è la punta del mouse**, non la card sorgente.

Niente cambia nelle altre pagine. La pagina BCA dentro Network resta com'è (è la stessa identica esperienza, solo letta da un altro tab).

---

## Conferma di comprensione (per evitare un altro disastro)

1. Il tab **CRM › Biglietti** oggi mostra `BusinessCardsHub` (lista piatta + dettaglio piccolo). Va **sostituito** con il formato di `BusinessCardsView` (quello già visibile in Network).
2. Le due pagine **hanno funzioni differenti**: Network apre menù inline e raggruppa per azienda; CRM/Biglietti apre il dettaglio a destra. La nuova pagina **deve avere entrambe**: layout Network + detail panel CRM.
3. Le 3 modalità di vista (compact / media / expanded) restano, ma **solo dalla "media" si può trascinare** un contatto sulle azioni intelligenti del pannello.
4. Il drag handle è un'icona a **6 puntini** (drag handle) sulla card — non si trascina prendendo tutta la card ovunque.
5. Le 4 azioni intelligenti (**Cockpit, Deep Search, LinkedIn, Campagna**) diventano grandi card-target nel detail panel, e si **illuminano singolarmente** in base alla posizione del puntatore al momento del drop.

---

## Cosa cambia (passo per passo)

### 1. Routing
- `src/v2/ui/pages/sections/PipelineSection.tsx`: la route `biglietti` smette di importare `BusinessCardsHub` e importa il nuovo componente unificato.

### 2. Nuovo componente unificato
- Crea `src/components/contacts/bca/BCAUnifiedHub.tsx` basato su `BusinessCardsView` (versione Network), con in più:
  - `selectedDetailCard` state per aprire il pannello laterale al click su una card.
  - Drop zone overlay del pannello laterale, sensibile al puntatore.
  - Riutilizzo di `BCAUpload` (drop foto/file) e del dialog "Dettagli incontro" già esistenti in `BusinessCardsHub`.

### 3. Detail panel "potenziato"
- Crea `src/components/contacts/bca/BCAUnifiedDetailPanel.tsx` derivato da `BCADetailPanel`, con una sezione **Azioni Intelligenti** ridisegnata: 4 grandi card grid 2×2, ognuna è anche **drop target** indipendente. Ogni target:
  - si illumina solo quando il puntatore è dentro i suoi bounds (`onDragEnter`/`onDragLeave` per singolo target — niente "card madre" che cattura tutto);
  - mostra il tipo di azione che eseguirà sul contatto droppato;
  - all'`onDrop` esegue l'azione del file `BCASmartActions` esistente (Cockpit, Deep Search, LinkedIn, Campagna) usando l'id del contatto trascinato.

### 4. Drag handle a 6 puntini
- Nei renderer della view "media" (`BcaGridCard` in `src/components/operations/bca/BcaCardRenderers.tsx`) aggiungi un'icona `GripVertical` doppia (visualmente "dots six") in alto a sinistra della card, marcata `draggable=true` con `dataTransfer` che porta `cardId`. Solo quell'icona avvia il drag (la card resta cliccabile per aprire il dettaglio).
- Le altre due viewMode (compact, expanded) **non** abilitano il drag, come richiesto.

### 5. Pulizia
- `BusinessCardsHub.tsx` resta in repo come legacy ma non viene più importato (zero rimozione di codice esterno, riduce il rischio di regressioni).

---

## Layout finale della nuova pagina CRM › Biglietti

```text
+------------------------------------------------------------------+
|  Toolbar (cerca · sel. tutti · sync · contatori)                 |
+--------+----------------------------------------+----------------+
| Sidebar| Quality Dashboard                       | DETAIL PANEL  |
| Paesi  +-----------------------------------------+ (al click)    |
|        | [ Gruppo Azienda 1 ] WCA  ✈ ...         |               |
|        |   - Card contatto (compact/media/exp.)  |  Foto + OCR   |
|        |   - Card contatto                       |               |
|        | [ Gruppo Azienda 2 ] ...                |  AZIONI       |
|        |                                         |  INTELLIGENTI |
|        |                                         |  +----+ +---+ |
|        |                                         |  |Cock| |D.S| |
|        |                                         |  +----+ +---+ |
|        |                                         |  +----+ +---+ |
|        |                                         |  | LI | |Cmp| |
|        |                                         |  +----+ +---+ |
+--------+-----------------------------------------+---------------+
```

Drop dei contatti dalle card "media" → atterra **esattamente** sulla card-azione sotto il mouse.

---

## Dettagli tecnici

- **File nuovi**: `BCAUnifiedHub.tsx`, `BCAUnifiedDetailPanel.tsx`.
- **File modificati**: `PipelineSection.tsx` (routing), `BcaCardRenderers.tsx` (drag handle solo su `BcaGridCard`).
- **Drag&Drop**: HTML5 nativo (`draggable`, `dataTransfer.setData("text/bca-card-id", id)`); ogni drop target ha i propri handler — niente delega su parent — così "il bersaglio è il puntatore". Per evitare il flicker di `dragleave` su figli si usa un counter pattern.
- **Tokens design**: tutti i colori vengono dai semantic tokens di `index.css` (primary, accent, border, muted, …). Niente colori hardcoded.
- **Nessuna modifica a edge functions, schema DB, hook dati, RLS, code path di Network/BCA.** Il lavoro è puramente UI/presentational, secondo le istruzioni di base.

---

## Cosa NON faccio (per essere chiari)

- Non tocco la pagina Network › BCA (`BusinessCardsView`) — resta identica.
- Non modifico `BCASmartActions` né le edge function chiamate dalle azioni intelligenti.
- Non cambio i renderer compact/expanded (drag solo su grid/media).
- Non rimuovo `BusinessCardsHub` (resta come fallback finché non confermi).
