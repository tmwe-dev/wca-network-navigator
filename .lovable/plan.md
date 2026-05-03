## Cestinone — semplificazione filtri e canale

### Cosa significa la linguetta colorata a sinistra della card
È **l'indicatore del canale** del messaggio in uscita:
- **Viola** = Email
- **Verde smeraldo** = WhatsApp
- **Azzurro** = LinkedIn
- **Arancio** = Voce
- **Grigio** = Altro

L'icona dentro la card (in alto a sinistra) ripete lo stesso canale (busta per email, fumetto per WA, "in" per LinkedIn). Questo resta com'è — è già il riconoscimento immediato che chiedi.

---

### Modifiche alla barra filtri

**Prima (oggi):**
```
[Tutti (15)] [Email (11)] [WA (0)] [LinkedIn (0)]  ·  [Tutti] [Da approvare (11)] [Schedulato (0)] [In coda (4)] [Bloccato (0)]
```

**Dopo:**
```
[Da approvare (11)] [In coda (4)]        [▼ Tutti i canali]   [🔍 cerca...]
```

1. **Canali → dropdown** a destra, pulito, con freccia. Voci: `Tutti i canali`, `Email`, `WhatsApp`, `LinkedIn`. Ogni voce mostra l'icona del canale + il count. L'icona dentro la card e la linguetta colorata restano per il riconoscimento visivo.
2. **Stato → solo 2 chip:** `Da approvare` e `In coda`. Default = `Da approvare`.
   - Rimossi: `Tutti`, `Schedulato`, `Bloccato`.
   - `In coda` ingloba sia `queued` che `scheduled` (concettualmente: "già deciso, in attesa di partire").
3. **Highlight "prossime in partenza"** nel filtro `In coda`: ordinamento per `scheduledAt` ascendente e badge "in partenza tra X min" in evidenza (colore primary) sulle prime 3 card della lista.

### Modifiche tecniche (un solo file: `src/v2/ui/pages/CestinonePage.tsx`)

- Rimuovere il primo `ChipGroup` (canali) e sostituirlo con `DropdownMenu` + trigger piccolo (icona canale corrente + label + chevron).
- Ridurre il secondo `ChipGroup` a 2 opzioni (`pending`, `queued`). Default state `useState<CestinoStatus>("pending")` (non più `"all"`).
- Nel hook `useCestinone`, quando lo status filtro è `queued`, far passare anche gli items con `status === "scheduled"` (piccolo aggiustamento del filtro lato page, senza toccare il DAL).
- In `ListRow`, quando lo status corrente filtrato è `queued`, calcolare se l'item è tra le prime in partenza (sorted by `scheduledAt`) e mostrare un badge primary "in partenza tra X".
- Rimuovere dalle `STATUS_META` le voci che non servono più nei chip (lasciarle nei meta perché possono comparire nelle card come stato individuale, ma non come filtro).

Nessuna modifica al DAL, ai dati o alla logica di invio. Solo presentazione.