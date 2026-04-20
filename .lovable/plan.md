
## Diagnosi precisa di cosa è successo

Dai log DB e dal codice:

### Detective ha 7 step, ma di questi 5 sono saltati
Lo screenshot mostra "—" su step 2-6 con stato pending senza spinner. **Significa "skipped per variabili mancanti"**, non "in attesa".

**Causa radice 1: `websiteUrl` non viene popolato**
In `SherlockCanvas.tsx` (riga 41): `websiteUrl: ""` è hardcoded vuoto. Il `ForgeRecipient` non porta il sito web del partner (vedi interfaccia: ha `email`, `countryCode`, `companyName`, ma **non** `website`).
→ Step 2,3,4,5 (Sito Home/About/Team/Contact) tutti richiedono `websiteUrl` → tutti **skippati silenziosamente**.

**Causa radice 2: `linkedinCompanySlug` non viene popolato**  
Stessa cosa: hardcoded a stringa vuota.
→ Step 6 (LinkedIn azienda) skippato.

**Risultato**: di 7 step Detective ne girano realmente solo 2 (Google Maps + Reputation). Lo screenshot lo conferma: cerchio verde solo su step 1 e 7, gli altri pending icon (cerchietto vuoto) → in `StatusIcon` lo status `"skipped"` mostra `SkipForward`, ma se manca un emit di progress per quegli step **rimangono visualmente come pending**.

### Causa radice 3 — Bug grave: gli step skipped finiscono in fondo
In `useSherlock.ts` riga 113-119, l'array `stepResults` viene popolato per ordine di emit del progress, **non** per `step.order`. Combinato con il fatto che lo skip viene emesso **subito**, ma lo step 7 invece arriva 10s dopo, l'ordine UI può sembrare "fuori sequenza". Il timeline mostra però "TIMELINE · 7 STEP" → quindi l'emit avviene per tutti, ma il problema vero è che **5 di quei 7 sono skipped** e l'utente non capisce.

### Causa radice 4 — Step 2 dello Scout: stesso problema
Scout ha 2 step (Google Maps + sito ufficiale home). Anche lì step 2 richiede `websiteUrl` → skippato. Per questo "sul sito ufficiale non vedo niente".

### Causa radice 5 — Sherlock partito da step 7 invece dello step 1
Falso positivo di percezione. Detective **è partito** dallo step 1 (Google Maps, già in cache da Scout: 0.3s come si legge nello screenshot) e poi è andato avanti, ma siccome 2-6 sono skippati istantaneamente, l'unico step "lento" visibile è lo step 7 Reputation che impiega 10s. Sembra "saltato a 7" ma in realtà ha eseguito 1 → skip 2,3,4,5,6 → 7.

## Piano di fix

### Fix 1 — Popolare automaticamente `websiteUrl` e `linkedinCompanySlug`
Quando il `ForgeRecipient` è di tipo partner/bca, andare in DB a leggere `partners.website` (o `business_cards.website`) e passarlo come var. Estendere `ForgeRecipient` con `website` e `linkedinUrl` opzionali, popolarli nel picker, propagarli a `SherlockCanvas`.

### Fix 2 — Fallback intelligente quando `websiteUrl` manca
Se l'utente non ha mai inserito il sito, prima di skippare lo step **fare uno step preliminare automatico**: ricerca Google `"{companyName} {city} sito ufficiale"`, prendere il primo dominio non-aggregator (escludere linkedin/facebook/maps), e usarlo come `websiteUrl` per gli step successivi. Questo va nell'engine come "discovery step" implicito, attivabile da un flag `discover_website_if_missing: true` sul playbook.

### Fix 3 — UI trasparente: distinguere skipped da running
Lo step skipped deve mostrare l'icona `SkipForward` grigia + reason chiara nel sub-text ("Manca: websiteUrl"), non un cerchietto vuoto. Verificare che `StatusIcon` riceva davvero `"skipped"` e non `"pending"`. Aggiungere anche un banner azzurro in cima alla timeline se ci sono step skipped: "5 step saltati per dati mancanti — clicca per scoprire automaticamente".

### Fix 4 — Pulsante "Scopri sito" manuale
Nell'header del canvas, accanto al nome azienda, mostrare un piccolo input "Sito web del partner" pre-compilato se disponibile, editabile al volo. Cambia → re-run automatico degli step skipped.

### Fix 5 — Ordine corretto della timeline
In `useSherlock.ts`, riordinare `stepResults` per `step.order` ad ogni update così la UI è sempre in sequenza naturale 1→7.

### Fix 6 — Persistere il sito scoperto sul partner
Quando l'AI estrae l'URL del sito ufficiale dallo step Google Maps, scriverlo in `partners.website` via DAL. Così alla seconda indagine Detective gira tutti i 7 step.

## File toccati

**Edit**:
- `src/v2/ui/pages/email-forge/ForgeRecipientPicker.tsx` — aggiungere `website` e `linkedinUrl` al tipo + select
- `src/v2/ui/pages/email-forge/SherlockCanvas.tsx` — popolare le vars correttamente + UI input sito + banner skipped
- `src/v2/services/sherlock/sherlockEngine.ts` — discovery step automatico per websiteUrl + persistenza partner
- `src/v2/hooks/useSherlock.ts` — sort stepResults per order
- DAL `src/data/sherlockPlaybooks.ts` — funzione `updatePartnerWebsite` (oppure usare `src/data/partners.ts` se esiste)

**Memoria**: aggiornare `mem://features/sherlock-investigator` con la regola di discovery automatico.

## Risultato atteso

- Lanciando Scout su Transport Management Srl: 2/2 step eseguiti (Google Maps + Sito Home auto-scoperto via Google).
- Lanciando Detective: 7/7 step eseguiti, perché il sito viene scoperto al primo run e cachato.
- Timeline visivamente ordinata 1→7 con stati chiari (verde done / blu cache / grigio skipped con reason / rosso error).
- Al secondo run Detective sullo stesso partner: tutti gli step usano cache, indagine in <5s.
