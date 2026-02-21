

# Potenziamento Deep Search: Da Surface a Deep

## Problemi Identificati

Ho analizzato i dati di Sumitomo Warehouse Group nel database. Ecco cosa succede:

- **Website**: campo vuoto nel database -- quindi il logo non viene cercato
- **Contatti**: Mr. Hayashi e Ms. Fagathong hanno solo `direct_phone`, nessun `mobile` -- quindi WhatsApp non viene generato
- **Social links**: 0 risultati -- la ricerca Firecrawl non ha trovato profili LinkedIn per nomi giapponesi/thailandesi in azienda thailandese
- **Rating**: la Deep Search non calcola mai il rating (lo fa solo `analyze-partner`, un'altra funzione separata)
- **Logo**: nessun tentativo perche il campo website e vuoto
- **Profili contatti**: SONO stati trovati (background, lingue) ma l'interfaccia potrebbe non mostrarli abbastanza bene

## Piano di Miglioramento

### 1. WhatsApp anche da telefono fisso

Attualmente il link WhatsApp viene creato solo se il contatto ha il campo `mobile`. Molti contatti hanno solo `direct_phone`. Aggiungere fallback:
- Se `mobile` presente, usa quello per WhatsApp
- Se solo `direct_phone` presente, usa quello come fallback (molti numeri "fissi" in Asia sono in realta mobili)

**File**: `supabase/functions/deep-search-partner/index.ts` (linee 329-344)

### 2. Logo sempre, anche senza website

Quando il campo `website` e vuoto:
- Cercare il sito web tramite Firecrawl: `"nome azienda" sito ufficiale`
- Se trovato, salvare il website nel database E scaricare il logo
- Come ultimo fallback, usare il logo Google favicon dal dominio dell'email aziendale (es. `rdc.co.th` dall'email dei contatti)

**File**: `supabase/functions/deep-search-partner/index.ts` (linee 480-508)

### 3. Rating automatico nella Deep Search

Integrare il calcolo del rating direttamente nella Deep Search, cosi ogni partner analizzato riceve subito le stelle. Il rating (1-5) si basa su:
- Completezza del profilo (website, email, telefono, descrizione)
- Numero di network
- Anni di membership
- Numero di contatti con email
- Presenza di certificazioni

Non serve AI, e un calcolo deterministico basato sui dati disponibili.

**File**: `supabase/functions/deep-search-partner/index.ts` (aggiungere dopo il salvataggio enrichment)

### 4. Ricerca LinkedIn piu intelligente

Migliorare la strategia di ricerca per nomi non occidentali:
- Se la prima ricerca `"Nome" "Azienda" site:linkedin.com/in` non trova risultati, provare con varianti:
  - Solo cognome + azienda
  - Nome + citta + "logistics"
- Aggiungere ricerca LinkedIn con il titolo del ruolo

**File**: `supabase/functions/deep-search-partner/index.ts` (linee 220-262)

### 5. Website discovery dal dominio email

Se `website` e null ma i contatti hanno email, estrarre il dominio dall'email (es. `rdc.co.th` da `hayashi@rdc.co.th`) e usarlo come website.

**File**: `supabase/functions/deep-search-partner/index.ts` (aggiungere prima della sezione logo)

### 6. UI: WhatsApp visibile per ogni contatto con telefono

Nel `PartnerDetailFull.tsx`, il pulsante WhatsApp appare solo se `c.mobile` e presente. Aggiungere fallback su `direct_phone` per mostrare sempre il pulsante WhatsApp quando c'e un numero di telefono.

**File**: `src/components/partners/PartnerDetailFull.tsx` (linee 362-379)

## Dettagli Tecnici

### Edge Function `deep-search-partner/index.ts`

**Modifica 1 - WhatsApp fallback** (riga ~329):
```
// Attuale: solo mobile
if (contact.mobile && !existingSet.has(...))

// Nuovo: mobile O direct_phone
const whatsappNumber = contact.mobile || contact.direct_phone
if (whatsappNumber && !existingSet.has(...))
```

**Modifica 2 - Website discovery** (aggiungere prima della sezione logo ~480):
```
// Se website e null, cercare dal dominio email dei contatti
if (!partner.website) {
  // Estrarre dominio dall'email contatti
  const emailDomain = contacts?.find(c => c.email)?.email?.split('@')[1]
  if (emailDomain) {
    const websiteUrl = `https://${emailDomain}`
    await supabase.from('partners').update({ website: websiteUrl }).eq('id', partnerId)
    partner.website = websiteUrl
  }
}
```

**Modifica 3 - Logo fallback Google favicon**:
Se lo scraping del sito fallisce, usare sempre `https://www.google.com/s2/favicons?domain=DOMINIO&sz=128`

**Modifica 4 - Rating deterministico** (aggiungere dopo salvataggio enrichment ~524):
```
// Calcolo rating basato su completezza dati
let score = 0
if (partner.website) score += 1
if (contacts?.some(c => c.email)) score += 1  
if (contacts?.some(c => c.mobile || c.direct_phone)) score += 0.5
if (partner.profile_description) score += 0.5
if (socialLinksFound > 0) score += 0.5
if (companyProfile?.specialties?.length > 0) score += 0.5
// Scala 1-5
const rating = Math.min(5, Math.max(1, Math.round(score * 1.5 + 1)))
await supabase.from('partners').update({ rating }).eq('id', partnerId)
```

**Modifica 5 - LinkedIn retry per nomi non-occidentali** (riga ~223):
Se la prima ricerca non trova risultati, fare un secondo tentativo con query piu generica (solo cognome + azienda + "logistics linkedin").

### Frontend `PartnerDetailFull.tsx`

**Modifica 6 - WhatsApp button fallback** (riga ~362):
Mostrare il pulsante WhatsApp per qualsiasi numero di telefono, non solo mobile.

## File da Modificare

1. `supabase/functions/deep-search-partner/index.ts` - Tutte le modifiche backend (WhatsApp fallback, website discovery, logo fallback, rating, LinkedIn retry)
2. `src/components/partners/PartnerDetailFull.tsx` - WhatsApp button per direct_phone

## Risultato Atteso

Dopo queste modifiche, rieseguendo la Deep Search su Sumitomo:
- Logo trovato dal dominio email `rdc.co.th`
- Website `https://rdc.co.th` salvato automaticamente
- WhatsApp link generato per entrambi i contatti (dal direct_phone)
- Rating calcolato automaticamente
- Ricerca LinkedIn piu aggressiva con retry

