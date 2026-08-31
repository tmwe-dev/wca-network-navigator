# Manuale delle maschere V3

Regole vincolanti. Valgono per **ogni** pagina V3, presente e futura. Non si chiede
conferma: si applicano. Se una pagina non le rispetta, è la pagina a essere sbagliata.
Maschera di riferimento: `src/v3/modules/contatti/pages/ContattiPage.tsx`.

---

## 1. Struttura della pagina

Tre colonne fisse, sempre le stesse, montate da `PageFrame`:

```text
┌───────────┬─────────────────────────────────────┬───────────┐
│ SINISTRA  │  TOOLBAR (conteggio · paginazione)  │  DESTRA   │
│ Filtri    │  Barra FILTRI ATTIVI (badge + X)    │  Workflow │
│           │  TABELLA                            │  Stato    │
└───────────┴─────────────────────────────────────┴───────────┘
```

- **Sinistra = filtri.** Solo ciò che restringe i dati.
- **Destra = azioni e stato.** Solo ciò che agisce sui dati o li descrive.
- **Centro = dati.** Niente controlli sparsi nel centro, a parte i filtri attivi.
- Su mobile i due rail diventano pannelli collassabili; il centro resta intero.

## 2. Tabella

- Si usa **solo** `V3DataTable`. Nessun `<table>` scritto a mano, mai.
- Colonne dichiarate con `V3Colonna`: `id`, `intestazione`, `larghezza`, `cella`.
- Tutto allineato a sinistra. Bordi 1px. Altezza di riga identica ovunque.
- Colonne sempre visibili in ogni elenco che le possiede:
  **Stato circuito** (`StatoCircuitoBadge`) e **Interazioni** (`InterazioniBadge`).
  Non sono mai `secondaria`.
- `secondaria: true` solo per dettagli sacrificabili sotto md.

## 3. Ordinamento — click sull'intestazione

- Click sull'etichetta di colonna = ordina per quel campo.
- Secondo click = inverte il verso. La freccia (`↑`/`↓`) è visibile sulla colonna
  attiva; le altre mostrano il doppio chevron spento.
- L'ordinamento è **uno solo** ed è **server-side**: la colonna dichiara
  `ordinaPer: "<campo>"` e l'hook passa `ordine` + `discendente` alla RPC.
- Cambiare ordinamento riporta a pagina 1. Non azzera i filtri.
- Colonna senza `ordinaPer` = non ordinabile, e l'intestazione non è cliccabile.

## 4. Filtri — click sull'elemento

- Click su un valore dentro una cella (badge fonte, stato, paese, azienda) =
  **aggiunge** quel filtro. Click di nuovo sullo stesso valore = lo **toglie**.
- L'unico modo consentito di rendere filtrabile una cella è `V3CellaFiltro`
  (ferma la propagazione: la riga non si apre).
- Modello dati unico in `src/v3/ui/filtri.ts`: un filtro è `{ campo, valore, etichetta }`.
  - Più valori sullo **stesso campo** → OR.
  - Campi **diversi** → AND.
- Ogni cambio di filtro riporta a pagina 1 e mantiene l'ordinamento.
- I filtri sono server-side: l'hook trasforma la lista in array (`_fonti`, `_paesi`,
  `_stati`, `_aziende`) per la RPC. Mai filtrare in memoria una lista paginata.

## 5. Barra dei filtri attivi

- Componente unico `V3FiltriAttivi`.
- Compare in **due punti**, sempre entrambi:
  1. sopra la tabella, orizzontale;
  2. nella sidebar sinistra, in cima, sezione «Filtri attivi (n)», versione `compatto`.
- Ogni badge ha la **X** per rimuovere quel singolo filtro; l'ultimo elemento è
  «Azzera tutto».
- Zero filtri = barra assente (nessuno spazio vuoto).

## 6. Apertura riga e scheda azienda

- Click sulla riga (fuori dagli elementi filtrabili) = apre il **dettaglio**
  della riga, se esiste. Se la fonte non ha dettaglio, la riga non è cliccabile.
- Quando la riga appartiene a un'azienda con più persone, sotto il nome azienda
  compare il pulsante **«N persone»**. Apre la **scheda azienda in popup**
  (`SchedaAzienda`), non naviga e non espande la riga.
  Scelta fatta e definitiva: la popup non perde la posizione nell'elenco né i filtri.
- La popup contiene: logo, nome azienda, elenco delle persone (tutte le fonti) con
  ruolo, email, stato circuito e interazioni, e l'azione «Filtra l'elenco su questa
  azienda» che aggiunge il filtro `azienda` e chiude.

## 7. Sidebar e menu

- Solo quattro primitive, da `src/v3/ui/Rail.tsx`:
  - `RailSezione` — gruppo apribile (è il "toggle/dropdown" della sidebar);
  - `RailScelte` — tasti fisici per liste corte (fino a ~8 voci);
  - `RailSelect` — tendina per liste lunghe (paesi, operatori…);
  - `RailToggle` — interruttore booleano;
  - `RailAzione` — riga-azione (destra).
- Ordine fisso della sidebar sinistra: **Ricerca → Filtri attivi → filtri per tasti
  → filtri a tendina → opzioni booleane + Azzera filtri.**
- Ordine fisso della sidebar destra: **azioni di creazione → azioni di massa →
  Stato dati (conteggio + Aggiorna).**
- Ogni superficie è vetrata (`v3-glass`), bordo 1px, testo allineato a sinistra.

## 8. Colore e forma

- Palette: **blu** (primario, dati e selezione) e **marrone** (accento, attesa e
  azioni secondarie). Nessun altro colore, salvo il rosso di errore/blocco.
- Mai colori Tailwind grezzi (`text-white`, `bg-black`, `bg-[#...]`): solo token.
- Raggio: `rounded-md` per i controlli, `rounded-lg` per i contenitori.
- Testo: 13px nelle celle, 11px maiuscoletto nelle intestazioni e nelle etichette.

## 9. Dati e paginazione

- 50 righe per pagina. Conteggio totale sempre in toolbar e nella sidebar destra.
- Ricerca testuale con debounce di 350ms, server-side.
- Sotto la tabella: «Righe X–Y di N» e, dove ha senso, un link di servizio.
- Stati obbligatori: caricamento (spinner + testo), errore (riquadro rosso con il
  messaggio reale), vuoto (frase che spiega che i filtri non trovano nulla).

## 10. Cosa non si fa mai

- Menu contestuali col tasto destro, doppio click, drag per filtrare.
- Filtri nascosti dentro modali: i filtri vivono nella sidebar e nei badge.
- Due tabelle diverse nella stessa pagina.
- Espansione inline delle righe (accordion): per l'approfondimento c'è la popup.
- Controlli che cambiano posizione tra una pagina e l'altra.
