
# Correzioni Enrichment, Deep Search e Visualizzazione Risultati

## Problemi identificati

### 1. Enrichment: risposta non letta correttamente
La edge function `enrich-partner-website` restituisce `{ success, enrichment }`, ma il codice frontend cerca `enrichResult.enrichment_data` (che non esiste). Inoltre i nomi dei campi non corrispondono:
- La funzione restituisce `employee_count` -- il canvas si aspetta `employees`
- La funzione restituisce `founding_year` -- il canvas si aspetta `year_founded`  
- La funzione restituisce `has_own_fleet` + `fleet_details` -- il canvas si aspetta `own_fleet`
- La funzione NON restituisce `key_routes` (rotte con bandiere) -- il campo non viene estratto

### 2. Deep Search: risposta non letta correttamente
La edge function `deep-search-partner` salva logo e social links direttamente nel database ma restituisce solo contatori (`socialLinksFound`, `logoFound`). Il frontend tenta di leggere `deepResult.logo_url` e `deepResult.social_links` che non esistono nella risposta. Quindi il canvas non mostra mai il logo trovato ne' i link LinkedIn.

### 3. Nessuna visualizzazione post-completamento
Dopo che un partner viene acquisito, il canvas si anima e scompare. Non e' possibile cliccare su un partner "completato" nella coda per rivedere i risultati.

### 4. Logo troppo piccolo
Il logo nel canvas e' confinato in un quadrato 56x56px. L'utente chiede una visualizzazione piu' ampia a banner.

---

## Piano di correzione

### File: `src/pages/AcquisizionePartner.tsx`

**A) Fix lettura risposta Enrichment (riga 409-413)**

Cambiare da:
```
enrichResult.enrichment_data
ed.key_markets, ed.key_routes, ed.warehouse_sqm, ed.employees, ed.year_founded, ed.own_fleet
```
A:
```
enrichResult.enrichment (campo corretto della risposta)
ed.key_markets, [], ed.warehouse_sqm, ed.employee_count, ed.founding_year, ed.fleet_details
```

**B) Fix lettura risposta Deep Search (righe 424-429)**

Dopo che la Deep Search completa, il logo e i social links sono gia' nel database. Invece di leggere dalla risposta (che contiene solo contatori), fare una query al DB per recuperare:
- `logo_url` dal partner aggiornato
- Social links dalla tabella `partner_social_links`

```
// Dopo deepResult, ricarica dati aggiornati dal DB
const { data: updatedPartner } = await supabase
  .from("partners").select("logo_url").eq("id", partnerId).single();
const { data: socialLinks } = await supabase
  .from("partner_social_links").select("*").eq("partner_id", partnerId);
// Aggiorna canvas con dati reali
```

**C) Aggiungere click su partner completati nella coda**

Quando un item nella queue con status "done" viene cliccato, ricaricare i dati del partner dal DB e mostrarli nel canvas (senza rifare l'acquisizione).

### File: `src/components/acquisition/PartnerQueue.tsx`

Aggiungere un `onPartnerClick` callback per gli item con status "done". Quando cliccato, emette l'evento con il `wca_id`.

### File: `src/components/acquisition/PartnerCanvas.tsx`

**D) Logo banner**

Sostituire il logo quadrato 56x56 con una sezione banner piu' ampia nella parte superiore della card:
- Se il logo e' presente, mostrarlo con altezza massima ~48px e larghezza automatica (max-w-[200px])
- Posizionato accanto al nome dell'azienda, con dimensioni proporzionali al logo originale
- Rimuovere il contenitore quadrato rigido

### File: `supabase/functions/enrich-partner-website/index.ts`

**E) Aggiungere estrazione key_routes**

Aggiornare il prompt AI per estrarre anche le rotte principali (`key_routes`) come array di oggetti `{from, to}` con nomi di paesi, che verranno poi mappati alle bandiere nel canvas.

---

## Riepilogo file modificati

1. `src/pages/AcquisizionePartner.tsx` -- fix mapping risposta enrichment/deep search + click review
2. `src/components/acquisition/PartnerQueue.tsx` -- aggiungere click handler su item completati
3. `src/components/acquisition/PartnerCanvas.tsx` -- logo banner + migliore layout
4. `supabase/functions/enrich-partner-website/index.ts` -- aggiungere key_routes al prompt AI
