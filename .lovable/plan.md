Ho individuato due cause principali coerenti con il blocco generale degli scroll:

1. È stato aggiunto un blocco globale dei gesti orizzontali del trackpad in `AuthenticatedLayout` tramite listener `wheel` in capture phase su `window` e `document`, con `preventDefault()` e `stopPropagation()`. Questo intercetta il trackpad prima dei componenti interni e può rompere scroll annidati, pannelli, tab, aree Radix ScrollArea e liste.
2. Sono stati aggiunti stili globali in `src/index.css` che applicano `overscroll-behavior: none` anche a `*`, `*::before`, `*::after`, più `touch-action: pan-y pinch-zoom` su `html`. È troppo aggressivo: impedisce o altera gesture, chain di scroll e interazioni orizzontali necessarie in molte pagine.

Piano di correzione profonda:

## 1. Rimuovere il blocco globale del wheel/trackpad
- Eliminare da `src/v2/ui/templates/AuthenticatedLayout.tsx` l’effetto `useEffect` che registra `blockHorizontalWheelNavigation` su `window` e `document`.
- Eliminare anche il vecchio equivalente in `src/components/layout/AppLayout.tsx`, anche se V1 è deprecato, per evitare regressioni se componenti legacy vengono montati o preservati.
- Non sostituirlo con un altro `preventDefault` globale.

## 2. Ammorbidire gli stili globali anti-gesture
- In `src/index.css`, rimuovere il blocco iniziale “Blocco totale dei gesti di navigazione del trackpad/touchscreen”.
- Rimuovere la regola globale dentro `@layer base` che applica `overscroll-behavior` a tutti gli elementi.
- Mantenere solo una protezione non invasiva su `html, body` se necessaria, preferibilmente limitata all’asse X:
  - `overscroll-behavior-x: none;`
  - evitare `overscroll-behavior-y: none` globale
  - evitare `touch-action` globale su `html`
- Obiettivo: prevenire quanto possibile swipe-back del browser senza bloccare lo scroll verticale e senza interferire con scroll interni.

## 3. Sistemare la catena dello scroll nei layout V2
- In `AuthenticatedLayout`, sostituire `overscroll-none` sul wrapper e su `<main>` con un comportamento meno invasivo (`overscroll-x-none` o nessun overscroll), lasciando a `<main>` lo scroll verticale naturale.
- Valutare `min-h-0` sul contenitore animato dentro `<main>`: oggi è `h-full`; per pagine più alte del viewport, può impedire il corretto overflow quando i figli hanno `h-[calc(...)]` o `h-full`.
- Standardizzare: shell fissa, header fisso, `<main>` scrollabile, sezioni interne scrollabili solo quando davvero split-panel.

## 4. Correggere i template introdotti nel redesign
- `SectionTabs`: il contenitore dei children ora è `overflow-hidden`; per pagine non split-panel questo taglia il contenuto se il figlio non ha un proprio scroll. Lo convertirò in un comportamento sicuro:
  - struttura `flex-1 min-h-0`
  - scroll verticale consentito quando il figlio non gestisce lo scroll
  - mantenere overflow nascosto solo dove ci sono split-panel reali.
- `GoldenLayout`: mantenere `overflow-hidden` solo per il layout split, ma garantire che i pannelli list/detail abbiano altezza corretta e possano scrollare internamente.
- Se necessario aggiungere una prop leggera a `SectionTabs`/sezioni per distinguere:
  - `contained` per pagine split/fullscreen
  - `scroll` per pagine document/dashboard.

## 5. Audit per sezione e fix mirati
Verificherò e correggerò le sezioni principali:

- Home/Dashboard: deve scrollare tramite `ScrollArea` o main senza doppio calc errato.
- Pipeline:
  - Contatti: `GoldenLayout` + lista/dettaglio devono scrollare.
  - Kanban/CRM: tab interne e pipeline devono restare scrollabili.
  - Deals: già ha `overflow-auto h-full`, va preservato.
  - Agenda: sidebar calendario e dettaglio giorno devono scrollare.
- Comunica:
  - Inbox/Inreach
  - Outreach con tab verticali interne
  - Composer
  - Approvazioni
- Intelligence:
  - Prompt Lab: pagina attuale ha `h-[calc(100vh-3.5rem)]` dentro nuova shell con header + GoldenHeader + SectionTabs; va convertita a `h-full min-h-0` per evitare altezza eccedente e scroll rotto.
  - Analytics: stesso problema con `h-[calc(100vh-3.5rem)]`; va adattata al contenitore V2.
  - KB Supervisor: stesso pattern `h-[calc(100vh-4rem)]`; va adattato.
  - AI Control Center: aggiungere contenitore `min-h-0 overflow-auto` sul contenuto se necessario.
- Explore:
  - Mappa/Globe
  - Cerca/Contacts
  - Deep Search
  - Campagne, che usa già layout fullscreen con calc e può avere doppio header: va normalizzata.
- Config:
  - Settings/Guide/Token/Calendar/Admin: assicurare scroll verticale sui contenuti lunghi.

## 6. Validazione tecnica
Dopo le modifiche eseguirò:
- type-check/build disponibile nel progetto;
- ricerca statica per assicurare che non restino listener `wheel` globali con `preventDefault()`;
- ricerca per `overscroll-behavior: none` globale e `touch-action` globale;
- verifica delle pagine chiave al viewport dell’utente circa 993x691:
  - `/v2/intelligence/prompt-lab`
  - `/v2/intelligence/analytics`
  - `/v2/pipeline/contacts`
  - `/v2/pipeline/deals`
  - `/v2/communicate/outreach`
  - `/v2/explore/campaigns`
  - `/v2/settings/general`

## Risultato atteso
- Trackpad e mouse wheel tornano a funzionare in tutte le aree scrollabili.
- Niente più blocchi globali che intercettano gli eventi prima dei componenti.
- Le sezioni del redesign restano ordinate con la navigazione nuova, ma senza tagliare il contenuto.
- La prevenzione dello swipe-back resta solo dove non rompe lo scroll, non più tramite `preventDefault` globale.