
# Riordino UI — Email Intelligence / Gestione Manuale

Obiettivo: recuperare verticale perso nell'header, rendere i tabs leggibili come tabs, spostare i filtri nella sidebar sinistra, e ridisegnare le card (sender + gruppo) con gerarchia chiara.

---

## 1. Header della pagina (`EmailIntelligencePage.tsx`)

**Stato attuale:** titolo + sottotitolo + tabs + (dentro la tab) toolbar lunga + alfabeto. Quattro righe che mangiano metà schermo.

**Cosa cambio:**
- **Riga 1 unica** — icona + titolo "Email Intelligence" a sinistra, tabs **a destra sulla stessa riga**. Niente sottotitolo descrittivo (lo elimino, è rumore).
- **Tabs visibili come tabs**: bordo inferiore evidenziato, sfondo card su quella attiva, separatori verticali tra una e l'altra, hover esplicito. Devono leggersi come 4 segmenti di un controllo, non come 4 bottoni sparsi.
- Padding pagina ridotto da `p-4 md:p-6` a `p-3 md:p-4`, gap da `gap-4` a `gap-3`.

Risultato: ~80px recuperati in altezza.

---

## 2. Toolbar di Gestione Manuale → spostata nella sidebar sinistra

**Stato attuale (`ManualGroupingTab.tsx` righe 132–181):** una riga orizzontale con 2 badge + search + 2 select + 2 bottoni. Mangia un'altra riga intera.

**Cosa cambio:**
- **Sopra il pannello "Non classificati"** (la colonna sinistra) creo un blocco verticale compatto contenente:
  - I 2 badge contatori (impilati, font ridotto)
  - Search mittente (full width)
  - Select "Volume" (full width)
  - Select "Ordina" (full width)
  - I 2 bottoni "Popola Address" e "Nuovo gruppo" (impilati o affiancati 50/50)
- La riga toolbar in alto sparisce completamente.

Risultato: header pulito, filtri raggruppati dove servono (vicino alla lista che filtrano).

---

## 3. Card mittente (sinistra) — `SenderCard.tsx`

**Problemi attuali:**
- Il bottone "Più opzioni" è una riga full-width dentro la card → fa "scalare" tutto in basso e sembra parte del contenuto principale.
- La pulsantiera di assegnazione gruppo + conferma occupa una riga intera anche quando non serve.

**Cosa cambio:**
- "Più opzioni" diventa una **piccola icona** (`Settings2` o `MoreHorizontal`) in alto a destra nella card, accanto al bottone email. **Niente più riga full-width.**
- Cliccando l'icona si apre un **Dialog/Popover modale** (non più espansione inline) che contiene Prompt personalizzato + Regole IMAP + Azioni bulk. Stesse 3 sezioni di oggi, ma in modale → la card resta compatta.
- Ridisegno layout interno della card: 
  - Riga 1: checkbox · grip · favicon · nome+email · count+flag · icone azioni (mail, opzioni)
  - Riga 2: select "Assegna gruppo…" full-width compatta (h-7) **senza** il bottone separato di conferma — l'assegnazione parte direttamente alla selezione (toast di feedback).
- Card più alta in alto: rimuovo il padding extra che oggi la spinge giù.

---

## 4. Card gruppo (destra) — `GroupDropZone.tsx`

**Problemi attuali (visibili nello screenshot):**
- Icona, nome e numero "impastati" — tutto sullo stesso piano.
- Descrizione fluttua, count "0" sembra un destructive badge sganciato.
- Sotto si vede "Trascina sender qui" anche quando ci sono regole, senza struttura.
- Manca un'evidenza chiara dell'**ultima azienda caricata**.

**Nuovo layout (top-down):**

```
┌──────────────────────────────────────────────┐
│ [icona grande] Nome Gruppo    │  N    [📋][🗑]│  ← header
│              descrizione      │                │
├──────────────────────────────────────────────┤
│ Ultima associata:                            │
│ [favicon] Acme S.r.l.            [🗑]        │  ← una sola riga (l'ultima)
│          ufficio@acme.com                    │
└──────────────────────────────────────────────┘
```

Dettagli:
- **Header card**: icona (text-3xl) a sinistra **affiancata** a un blocco verticale `nome (testo grande, semibold) + descrizione (xs muted)` in colonna. A destra: numero **grande** (text-2xl, font-bold, colore del gruppo) + icona "lista" (apre dialog con tutte le aziende — già esiste) + cestino.
- **Body card**: mostra **una sola** azienda — l'ultima associata (la più recente per `created_at`/`updated_at` delle rules). Layout identico alla card mittente sinistra: favicon · nome+email · cestino di rimozione a destra.
- Le altre N-1 aziende si vedono cliccando l'icona lista (Dialog già esistente, lo lascio).
- Il pill "Rilascia qui" durante hover resta come oggi (compatto, top).
- Allineamento verticale e tipografia coerenti con la card mittente sinistra → "tutto sempre uguale" come richiesto.

Per l'**ordinamento "ultima associata"**: in `useGroupingData.ts` aggiungo `order('created_at', { ascending: false })` alla query rules così `rules[0]` è già l'ultima.

---

## 5. Allineamenti verticali e spazio recuperato

- I pannelli sinistro e destro partono **alla stessa altezza** (oggi a destra c'è la barra alfabeto extra che disallinea). Sposto la barra alfabeto **dentro** l'header del pannello destro su una sola riga (stessa h dell'header sinistro), oppure la riduco a una select compatta `A → Z` se non c'è spazio.
- Le card iniziano subito dopo l'header dei pannelli, niente padding extra.

---

## File toccati

1. `src/v2/ui/pages/EmailIntelligencePage.tsx` — header su una riga, tabs ridisegnati, padding ridotto.
2. `src/components/email-intelligence/ManualGroupingTab.tsx` — rimuove toolbar in alto, sposta tutto nella colonna sinistra sopra "Non classificati"; allinea le altezze degli header dei due pannelli.
3. `src/components/email-intelligence/management/SenderCard.tsx` — "Più opzioni" diventa icona + Dialog; layout interno compattato; assegnazione gruppo immediata su select.
4. `src/components/email-intelligence/management/GroupDropZone.tsx` — header ridisegnato (icona+nome/descrizione a sinistra, numero grande + azioni a destra); body mostra solo l'ultima azienda associata in stile "card mittente".
5. `src/components/email-intelligence/manual-grouping/useGroupingData.ts` — query `email_address_rules` ordinata per `created_at desc` per garantire `rules[0] = ultima`.

Nessuna modifica DB, nessuna nuova dipendenza.

---

## Cosa NON tocco

- Logica drag&drop (già sistemata, funziona).
- Logica deduplica gruppi/regole (già sistemata).
- Tab AI Suggestions / Auto-Classify / Regole — fuori scope di questa richiesta.
- Edge functions `check-inbox` e affini (vincolo memoria).
