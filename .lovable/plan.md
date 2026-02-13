

# Fix: Ricerca Aziende non funziona + Rimozione filtro "Probabilita Pagamento"

## Problemi identificati

### 1. Filtro "Probabilita Pagamento" causa errori
Il filtro `rank_paga` nel pannello Filtri Avanzati crea problemi quando viene selezionato/deselezionato. L'utente vuole che venga rimosso completamente.

### 2. La ricerca aziende fallisce con 404
Ho trovato il vero problema: nel file `background.js` dell'estensione, la funzione `scrapeSearchResults` (riga 428) naviga ancora verso `https://www.reportaziende.it/searchPersonalizzata.php`. Quando l'utente non ha una sessione attiva su quel dominio, la pagina redirige al login su `ecommerce2.reportaziende.it/login3/`, e il controllo sessione lo interpreta come "session_expired", bloccando tutto.

Inoltre, la funzione `fetchWithCookies` (riga 127-130) non include i cookie di `ecommerce2.reportaziende.it`, che e' il dominio dove avviene il login.

## Soluzione

### File: `src/components/prospects/ProspectAdvancedFilters.tsx`

**Rimuovere il filtro "Prob. Pagamento":**
- Eliminare `rank_paga` dall'interfaccia `ProspectFilters` e da `EMPTY_FILTERS`
- Rimuovere la costante `PAGA_OPTIONS`
- Rimuovere il componente `ChipMultiSelect` per "Prob. Pagamento" dal Dialog

**Rimuovere `rank_paga` dal conteggio filtri attivi** (riga 184)

### File: `src/components/prospects/AtecoGrid.tsx`

**Aggiornare `passesRankingFilter`:**
- Rimuovere il controllo `rank_paga` dalla funzione di filtro (riga 146)
- Rimuovere `rank_paga` dal check `hasRankFilter` (riga 140)

### File: `public/ra-extension/background.js`

**1. `fetchWithCookies` (riga 127-130):** aggiungere i cookie di `ecommerce2.reportaziende.it` nella raccolta, allineandola a `syncRACookies` che gia' li include.

**2. `scrapeSearchResults` (riga 428):** La URL della pagina di ricerca `https://www.reportaziende.it/searchPersonalizzata.php` e' corretta (la pagina esiste), ma il problema e' che senza sessione attiva redirige al login. Aggiungere un retry: se viene rilevato un redirect al login, tentare prima un auto-login e riprovare.

**3. Controllo sessione piu' robusto (righe 400, 442, 472):** aggiungere anche il check per `ecommerce2.reportaziende.it/login3` come pattern di redirect, mantenendo compatibilita' con entrambi i domini.

### Riepilogo modifiche
- `src/components/prospects/ProspectAdvancedFilters.tsx` -- rimozione filtro rank_paga
- `src/components/prospects/AtecoGrid.tsx` -- rimozione rank_paga da passesRankingFilter
- `public/ra-extension/background.js` -- fix fetchWithCookies + gestione sessione piu' robusta

