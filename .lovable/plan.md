

## Problema

Con migliaia di email in database, la pagina si blocca perché:
1. La lista carica troppe righe in un colpo solo
2. La preview crea un iframe pesante per ogni email selezionata
3. Il realtime invalida tutta la query a ogni INSERT, forzando un re-fetch completo

## Tre alternative per visualizzazione immediata

### Opzione A — Paginazione classica con bottoni (consigliata)
- La lista mostra **50 email per pagina** con bottoni "Precedente / Successiva"
- Nessun infinite scroll, nessun accumulo di DOM
- La pagina si apre istantaneamente perché carica solo 50 record leggeri (metadati)
- La preview si carica on-demand solo al click

**Pro:** semplicissima, zero lag, funziona con 500k email
**Contro:** l'utente deve cliccare per cambiare pagina

### Opzione B — Infinite scroll con virtualizzazione (attuale, ottimizzata)
- Mantiene il pattern attuale ma con fix critici:
  - Il realtime smette di invalidare tutta la query; aggiunge solo la nuova riga in cache
  - La lista virtuale resta a 50 record iniziali, carica i successivi solo su scroll
  - L'iframe della preview viene creato **solo per l'email selezionata**, non pre-renderizzato

**Pro:** esperienza fluida senza click
**Contro:** accumula DOM se l'utente scrolla molto

### Opzione C — Vista "Ultimi 50" + ricerca server-side
- All'apertura mostra solo le ultime 50 email (query istantanea)
- Per trovare email vecchie: l'utente usa la barra di ricerca (full-text search già implementato con GIN index)
- Nessuna paginazione, nessuno scroll infinito
- Il contatore mostra "50 di 12.345 — usa la ricerca per trovare le altre"

**Pro:** la più veloce in assoluto, zero complessità
**Contro:** non puoi "sfogliare" tutte le email manualmente

---

## Piano di implementazione (per l'opzione scelta)

Indipendentemente dalla scelta, questi fix vanno applicati subito:

1. **Realtime intelligente** — Invece di `invalidateQueries` a ogni INSERT, aggiungere la nuova riga direttamente nella cache di React Query (evita re-fetch di tutta la lista)
2. **Iframe singolo** — Assicurarsi che `EmailHtmlFrame` esista solo per il messaggio selezionato, mai pre-renderizzato per tutti
3. **Contatore ottimizzato** — Usare `count: "planned"` già implementato
4. **Feed download** — `useDownloadedEmailsFeed` già limita a 50 record, nessuna modifica necessaria

### File coinvolti
- `src/hooks/useChannelMessages.ts` — paginazione / cache realtime
- `src/hooks/useDownloadedEmailsFeed.ts` — realtime intelligente
- `src/components/outreach/EmailInboxView.tsx` — UI paginazione
- `src/components/outreach/EmailMessageList.tsx` — virtualizzazione
- `src/components/outreach/download/DownloadedEmailList.tsx` — lista download

