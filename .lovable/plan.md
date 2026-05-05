## Obiettivo

Tre interventi di solo design/UI (no business logic) su:

1. **Cockpit** — card contatti più leggibili
2. **Inbox** (`/v2/inbox`) — pulsante "Letto · Nascondi" + filtro non-lette
3. **Inbox toolbar superiore** — riordino, niente duplicati
4. **Funnemail** — sotto-menu pulito + ordinamenti più descrittivi

---

### 1. Cockpit · Card contatti leggibili

File: `src/components/cockpit/CockpitContactCard.tsx`

Oggi ogni card mostra in titolo "Risposta email: <oggetto>" e quasi nessun dato del contatto. Da rifare la gerarchia:

- Riga 1 (grande, bold): **Nome contatto** + azienda · paese (con bandierina)
- Riga 2 (icona azione + chip): icona ✉️/💬/in/📞 a sinistra come "tipo azione" (sostituisce la parola "Risposta email"); a destra l'oggetto/anteprima troncato
- Riga 3 (meta line piccola, muted): canale · lingua · età ("Oggi", "2g") · stato (Riprogrammato, In circuito nascosti, ecc.)
- Riferimenti a colpo d'occhio: email, telefono o LinkedIn quando presenti, come piccoli chip cliccabili (icona + valore troncato)

Le icone canale già presenti (✉️ in 💬 📞) restano in basso ma diventano _badge di disponibilità_ (attivi se il contatto ha quel canale, spenti altrimenti) — non più decorative.

### 2. Inbox · Tasto "Letto · Nascondi" + nasconde in tempo reale

File: `src/components/outreach/EmailDetailView.tsx` + `src/components/outreach/EmailInboxView.tsx` (lista)

- A destra header email aggiungere bottone primario grande **"✓ Letto, nascondi"** (accanto a Rispondi/Inoltra/Deep Search). Al click: marca read + rimuove la mail dalla lista visibile (filtro client-side "solo non lette" attivo di default).
- In cima alla lista mail, toggle compatto: `Non lette (default) · Tutte · Lette`. Filtro persistito in `GlobalFilters`.
- In tempo reale: dopo "Letto, nascondi" la mail sparisce dalla lista e viene auto-selezionata la successiva non letta.

### 3. Inbox · Toolbar superiore ordinata

File: `src/components/outreach/InArrivoTab.tsx` + `src/components/outreach/EmailToolbar.tsx`

Problema attuale: tre tab canale + bottoni "Nuova / Nuove / Scarica / 🔄 / ⚡" + microfono + AI + Deep Search tutti accatastati senza titoli, due spinner duplicati.

Riorganizzo in **una sola riga orizzontale** con 3 sezioni separate da divider verticale e micro-label sopra (uppercase 9px text-muted):

```
[ CANALI ]            [ SINCRONIZZAZIONE ]              [ AZIONI ]
✉️ Email 99+          🔄 Scarica nuove   ⚙️ Auto-sync    ✨ AI    🔍 Deep Search
💬 WhatsApp 40        (un solo bottone "Sync" con stato inline:
in LinkedIn 1          spinner + contatore "12 scaricate")
```

Cosa elimino / unifico:
- "Nuova" + "Nuove" + "Scarica" → un solo bottone **"Scarica nuove"** con spinner inline e badge contatore
- Le due rotelline duplicate → una sola, dentro il bottone Sync
- "Auto-sync ⚡" diventa un toggle Switch piccolo accanto, etichettato
- AI/Deep Search vanno in una colonna "Azioni" a destra con label esplicite (non solo icone)
- Microfono fluttuante (Aurora) NON è in questa toolbar — resta dov'è (già floating)

### 4. Funnemail · Sotto-menu pulito + ordinamento descrittivo

File: `src/v2/ui/pages/funnemail-inbox/FunnemailListToolbar.tsx` + `InboxGroupsSidebar.tsx`

Problemi: sopra la lista al centro si vedono "1303 Più email · da 17 classificati · ✨ Accetta tutti (1)" sovrapposti; A→Z troppo criptico.

- **Centro**: una riga sola con titolo sezione + contatore + azione primaria a destra (no overlap):
  - Sinistra: "📥 Più email · 1.303 da 17 classificati"
  - Destra: pulsante `✨ Accetta tutti (1)`
- **Sidebar gruppi (destra)**: sostituisco il toggle `A → Z` con 4 icone piccole con tooltip+label:
  - `🔤 Nome` · `📊 Quantità` · `🕐 Recenti` · `⭐ Importanti`
  Ogni icona ha la sua label sotto (xs muted, sempre visibile, non solo tooltip), così l'utente sa sempre cosa fa.
- Tutti i bottoni dell'app Funnemail diventano **descrittivi**: niente sole icone, sempre `icona + label` (anche se piccola). Coerenza univoca.

---

### Note tecniche

- Tutto solo presentation: nessuna modifica a hook, query, RLS, edge function.
- Uso esclusivo dei design tokens (semantic, HSL) già presenti — niente colori hardcoded.
- I temi nuovi continuano a funzionare: tutto passa via `bg-primary`, `text-foreground`, `text-muted-foreground`, ecc.
- Filtro "non lette" persistito in `GlobalFiltersContext` (esiste già il pattern).
- Compatibilità con stato attuale: nessun rename di prop, nessun breaking sui componenti consumatori.
