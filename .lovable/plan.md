## Cosa è successo (diagnosi)

Tre problemi distinti, tutti nello strato UI (nessuna logica business toccata).

1. **Sidebar di navigazione "scomparsa"**
   In `AuthenticatedLayout.tsx` la sidebar desktop è renderizzata con `-translate-x-full` finché non si clicca sul burger / hover. È un'autohide laterale introdotta nello sprint scorso. Il rail filtri contestuali (`ContextFiltersRail`) appare invece sempre incollato al contenuto, dando la sensazione che "i filtri siano dentro la maschera" e che la sidebar sia sparita.

2. **Microfono Co-Pilot in mezzo allo schermo**
   `FloatingCoPilot` è una bolla draggable con posizione persistita in `localStorage` (`copilot.position`). Se il valore salvato è "centrale" o se la finestra è stata ridimensionata, la bolla resta lì e copre tabelle/dettaglio (visibile negli screenshot).

3. **Lista CRM e Network poco leggibili**
   - In `ContactCard.tsx` la nazione è ridotta a un emoji + 3 lettere uppercase a 8px sotto la bandierina.
   - La città è in `text-[10px] text-muted-foreground` e va in truncate aggressivo.
   - Non esiste colonna **CAP** (`zip_code` esiste in `imported_contacts` ma non viene mostrato né ordinabile).
   - I filtri "click su un valore per filtrare" esistono (`Filterable`) ma non c'è un input filtro **dentro l'header di colonna** (alla Excel) né l'indicazione visiva che il valore sia cliccabile finché non ci passi sopra.
   - Stesso pattern, in chiave più estrema, nella lista Network (Partner): card a due righe, città piccola, nessun CAP né indirizzo.

---

## Piano di intervento (solo UI / presentation)

### Step 1 — Sidebar di navigazione fissa di nuovo

`src/v2/ui/templates/AuthenticatedLayout.tsx`

- Rimuovere il pattern `fixed -translate-x-full` + autohide su `onMouseLeave`.
- Ripristinare la sidebar desktop come **colonna statica `w-56`** dentro il flex root (`md:flex`), affiancata al rail filtri e al main.
- Mantenere il toggle del burger come "collassa a icone" (`w-14`) per i monitor stretti, con preferenza salvata in `localStorage`.
- Su `md` (tablet) restare con drawer come oggi.

Effetto: l'utente rivede subito a sinistra Home / Esplora / Pipeline / ecc., e accanto il rail "FILTRI WCA PARTNER" / "FILTRI CONTATTI CRM" come pannello secondario, non più confondibile.

### Step 2 — Microfono Co-Pilot in posizione neutra

`src/v2/ui/copilot/FloatingCoPilot.tsx`

- Cambiare la posizione di default e i bound: ancorato in **basso a destra**, sopra la `MobileBottomNav`, con offset di sicurezza dal bordo (16px).
- Aggiungere clamp al mount per riportare automaticamente la bolla nell'angolo basso-destra se il valore in `localStorage` la lascia in zone "centrali" (definite come x tra 25% e 75% della viewport).
- Aggiungere una piccola **maniglia di "snap to corner"** nel menu della bolla (4 angoli) per dare controllo all'utente senza dover trascinare.
- Reset esplicito in caso di posizione fuori viewport (resize finestra → snap al corner attivo).

### Step 3 — Lista Contatti CRM più leggibile + CAP + filtro per colonna

A. **Nuova griglia colonne** in `src/components/contacts/contactGridLayout.ts`

```text
[#  ☐] [🏳 Paese · Città · CAP] [Azienda · Ruolo] [Contatto · Email] [Stato · Score] [⋮]
  60    180                       1fr               1fr                 140            48
```

- Una sola riga visiva per contatto (oggi sono due, costringono a scrollare).
- Colonna "Località" combinata: **bandiera grande + nome paese leggibile (text-xs)** + città (text-xs) + CAP (text-[10px] mono).
- Email spostata accanto al nome contatto (al posto di stare in seconda riga).

B. **Header colonna ordinabile + filtro inline**
`src/components/contacts/ContactListPanel.tsx`

- Ogni intestazione colonna diventa un componente `ColumnHeader` con:
  - click sul titolo → ordina (asc/desc) — già c'è, va esteso a Paese, Città, CAP.
  - icona piccola "▾" → apre un popover con campo testo: filtra **dentro la colonna** (es. "Mil" → solo città che contengono Mil).
  - badge attivo se il filtro è in uso.
- Aggiungere "CAP" come `sortField` valido in `useContactListPanel` (lato client per ora; ordinamento server-side via parametro nuovo `orderBy=zip_code` come follow-up).

C. **Filterable più scopribile**
- Sottolineatura tratteggiata su valori cliccabili (`border-b border-dotted border-muted-foreground/40`), non solo on-hover.
- Tooltip "Filtra per …" in tutte le celle filtrabili (oggi solo alcune).

### Step 4 — Stessi miglioramenti nella vista Network (Partner)

`src/components/partners/...` (lista partner di `/v2/explore/network`)

- Card partner: bandierina più grande, **paese + città + indirizzo** su una riga sola con gerarchia tipografica chiara (paese in `text-foreground`, città in `text-muted-foreground`, indirizzo in `text-[10px]`).
- Header colonna ordinabile/filtrabile come nel CRM (Paese / Città / Anni WCA).
- Mostrare il CAP se presente in `partners.address` (estratto via regex semplice, fallback "—").

### Step 5 — Coerenza tipografica

- Aggiungere/usare i token semantici esistenti (`text-foreground` / `text-muted-foreground` / `text-xs` / `text-[11px]`) per uniformare le due liste.
- Mai colori hardcoded (regola di sistema).

---

## Cosa resta fuori (da chiedere prima di toccare)

- L'utente ha citato "presenta il CAP in modo da ordinare per CAP". Il CAP non esiste oggi su `partners`; va estratto dal campo `address` con un parser euristico. **Va bene farlo solo lato UI** (parsing al render) come quick win, oppure preferisci che pianifichi una colonna `zip_code` reale e una migrazione + back-fill?
- "Filtro dentro l'elenco per elemento" l'ho interpretato come **filtro inline di colonna stile Excel** (popover su ▾ dell'header). Se invece intendevi **una riga di campi sotto l'header** (sempre visibile), posso fare quella variante: occupa più spazio verticale ma è più immediata.

## File toccati (stima)

- `src/v2/ui/templates/AuthenticatedLayout.tsx` (sidebar fissa)
- `src/v2/ui/copilot/FloatingCoPilot.tsx` (snap to corner)
- `src/components/contacts/contactGridLayout.ts` (nuova griglia)
- `src/components/contacts/ContactCard.tsx` (riga unica, paese/città/CAP)
- `src/components/contacts/ContactListPanel.tsx` (header colonna + filtri inline)
- `src/hooks/useContactListPanel.ts` (sortField=`zip_code`)
- `src/components/partners/CountryWorkbench*.tsx` + card partner (stessi miglioramenti)

Tutto cosmetico/presentation: nessun cambio a query, RLS, edge functions, DAL.
