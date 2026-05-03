## Obiettivo

Ristrutturare `/v2/cestinone` perché il venditore capisca a colpo d'occhio **cosa stiamo per inviare, a chi, perché, con quale agente** e possa **leggere, modificare, cancellare o tornare all'origine** senza saltare di pagina.

Oggi la pagina ha 3 colonne strette: la card della lista è alta ~80px e mostra solo canale + oggetto + nome. Tutto il contesto (origine, agente, deep search, storico) è schiacciato nella colonna 2 in 4 mini-blocchi verticali da scrollare. Il messaggio originale a cui rispondiamo c'è ma è una stringa minuscola. Niente tabs, niente gerarchia.

## Nuova struttura (2 colonne, non 3)

```text
┌─────────────────────────┬──────────────────────────────────────┐
│ COL 1 — LISTA (1/3)     │ COL 2 — DETTAGLIO (2/3)              │
│                         │ ┌──────────────────────────────────┐ │
│ ┌─────────────────────┐ │ │ HEADER ricco                     │ │
│ │ Card alta (~140px)  │ │ │ icona canale · oggetto · stato   │ │
│ │ riga 1: 🇮🇹 Mail   │ │ │ destinatario · agente · campagna │ │
│ │ Pending · 2h fa     │ │ ├──────────────────────────────────┤ │
│ │ riga 2: oggetto     │ │ │ TABS                             │ │
│ │ riga 3: → handle    │ │ │ [Anteprima][Origine][Storico]    │ │
│ │ riga 4: Partner WCA │ │ │ [Controlli][Destinatario]        │ │
│ │   · Luca · Camp X   │ │ ├──────────────────────────────────┤ │
│ └─────────────────────┘ │ │ Contenuto del tab                │ │
│                         │ ├──────────────────────────────────┤ │
│                         │ │ FOOTER azioni                    │ │
│                         │ │ Conferma · Modifica · Rinvia ·   │ │
│                         │ │ Apri origine · Annulla           │ │
│                         │ └──────────────────────────────────┘ │
└─────────────────────────┴──────────────────────────────────────┘
```

Con due sole colonne il dettaglio respira e si possono usare tabs senza compressione.

## Card lista (più alta, più informativa)

Da ~80px a ~140px, struttura fissa 4 righe:

1. **Riga canale**: pill colorata grande con icona canale + label ("Email" / "WhatsApp" / "LinkedIn") + badge stato + bandiera paese + età ("2h fa" / "tra 30min").
2. **Oggetto** (2 righe, font medio).
3. **Destinatario**: `→ handle` (email/numero/profilo).
4. **Riga meta**: tipo partner (Partner WCA / Cliente / Lead) · agente AI (`🤖 Luca`) · trigger (Campagna / Inbound / Manuale) — con icone piccole.

Bordo sinistro colorato per canale (verde WA, blu LinkedIn, viola email) per scan visivo immediato.

## Detail panel — Header ricco (sempre visibile)

Una riga grande in alto con tutto il "chi/cosa/perché" essenziale:

- Icona canale grande + label
- Oggetto (h2)
- Badge stato (pending/scheduled/blocked/...)
- Bandiera + nome destinatario + tipo partner (cliente / partner WCA / lead)
- `🤖 Agente: Luca` · `📣 Campagna: X` (o "Diretto" / "Auto follow-up" / "Da risposta inbound")
- Bottone "Apri scheda partner" (drawer) sempre disponibile

## Detail panel — Tabs

5 tab, default "Anteprima":

1. **Anteprima** — il messaggio che stiamo per inviare, render HTML sanificato. Se LinkedIn/WA: render plain text con limite caratteri visibile. Per email: from/to/subject/body in stile mail client.
2. **Origine — Perché** — perché stiamo scrivendo:
   - Tipo trigger (campagna / inbound reply / business card / missione / manuale / auto follow-up) con icona grande
   - Se inbound reply: **messaggio originale completo** (non snippet) con mittente, data, oggetto, body in box quotato
   - Se campagna: nome campagna + link "Apri campagna"
   - Se business card: evento, luogo, data incontro
   - Bottone "Apri origine" che porta a campagna / thread / BCA / missione
3. **Storico** — timeline di tutte le interazioni con questo partner (multi-canale), non solo le ultime 3. Ordinata per data, con icone canale e indicatore inbound/outbound.
4. **Controlli** — checklist delle certificazioni (Partner CRM, Deep Search Sherlock, Editorial Review, Tentativi, Routing). Se Deep Search non fatta: bottone "Esegui Sherlock". Mostra `lastError` ben visibile se presente.
5. **Destinatario** — scheda riassuntiva: nome, paese+bandiera, lead status, score, ultimi contatti, indirizzo, sito. Bottone "Apri scheda completa" → drawer partner.

## Footer azioni (sempre visibile sotto i tabs)

- **Conferma** (primary) — invia/sblocca, card sparisce
- **Modifica** — apre composer pre-popolato
- **Rinvia** (snooze) — dropdown con +1h / +4h / domani 9:00 / lunedì 9:00
- **Apri origine** — naviga al contesto sorgente (campagna, thread inbound, BCA, missione)
- **Annulla** (destructive, allineato a destra) — rimuove dalla coda

## Dettagli tecnici

- File da modificare: solo `src/v2/ui/pages/CestinonePage.tsx` (tutto il rendering è qui dentro come sub-componenti).
- Nessuna modifica a `useCestinone.ts` né a `src/data/cestinone.ts`: i campi necessari (`triggerKind`, `originContext`, `agentName`, `campaignName`, `previousMessage`, `recentInteractions`, `partnerType`, `partnerCountryCode`, `deepSearchDoneAt`, `lastError`, `retryCount`, ecc.) sono già esposti dal hook.
- Layout: passare da `grid-cols-[1fr_1.1fr_1.6fr]` a `grid-cols-[minmax(340px,1fr)_minmax(560px,2fr)]`.
- Tabs: `@/components/ui/tabs` (Radix shadcn) già nel design system.
- Bordo sinistro card per canale: usare classi semantiche già definite in `CHANNEL_META` aggiungendo una variante `border`.
- Sostituire l'unico chip ancora `bg-primary text-primary-foreground` (ChipGroup line 515) con lo stile glass del design system per coerenza con la regola "Stile sfondo: bordo primary, no fill lilla".
- Nessuna modifica alla logica di submit/dismiss/cancel/snooze: sono nodi critici, restano invariati.

## Cosa NON faccio

- Niente cambi al backend, alle edge function, al hook, al DAL.
- Niente modifiche alla logica di invio/snooze/annulla.
- Niente nuovi endpoint o query.
- Niente refactor opportunistici al di fuori di `CestinonePage.tsx`.
