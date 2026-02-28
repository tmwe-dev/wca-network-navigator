

## Piano: Ridisegnare il sistema di rating partner basato su criteri di qualita reale

### Problema attuale
Il rating corrente (righe 605-638 di `deep-search-partner/index.ts`) si basa su criteri di completezza dati (ha email? ha telefono? ha descrizione?) che non hanno nulla a che fare con la qualita effettiva del partner. Il punteggio e un semplice contatore di "campi compilati".

### Nuovo sistema di rating: 7 criteri pesati

Il rating sara calcolato su 7 dimensioni, ciascuna con un peso specifico, e salvato sia come `rating` (1-5 stelle) che come `rating_details` (JSON con i singoli punteggi per il tooltip):

```text
Criterio                  Peso    Come si calcola
─────────────────────────────────────────────────────────
1. Qualita sito web       20%     Scrape del sito con Firecrawl (markdown), AI valuta
                                  modernita, completezza, professionalita (1-5)
2. Mix servizi            20%     air_freight + road_freight + warehousing = alto valore
                                  solo ocean = basso. Penalita mono-servizio mare.
                                  Bonus per: express, distribuzione propria, magazzini
3. Dimensione network     15%     Numero di network WCA a cui appartiene
                                  (1=1pt, 2=2pt, 3+=3pt, 5+=5pt)
4. Anzianita WCA          15%     Anni di membership: <3=1, 5+=2, 10+=3, 15+=4, 20+=5
5. Presenza internaz.     10%     Numero branch/filiali estere
                                  (0=1, 1-2=2, 3-5=3, 6+=4, 10+=5)
6. LinkedIn managers      10%     Contatti con profilo LinkedIn trovato + seniority
                                  senior con >10y experience = bonus
7. Profilo aziendale      10%     Employee count, founded year, awards, specialties
                                  dal company_profile AI-generated
─────────────────────────────────────────────────────────
```

### Modifiche tecniche

#### 1. `supabase/functions/deep-search-partner/index.ts`

**A) Aggiungere scraping qualita sito web** (nuovo blocco dopo il logo scraping):
- Se il partner ha un website, fare un secondo scrape Firecrawl con `formats: ['markdown']`
- Passare il markdown all'AI con prompt: "Valuta la qualita di questo sito aziendale di logistica su scala 1-5. Criteri: modernita del design, completezza informazioni, professionalita, contenuti strutturati. Rispondi solo con un numero 1-5."
- Salvare il punteggio nel `enrichment_data.website_quality_score`

**B) Aggiungere query partner_services** (gia abbiamo networks e certifications):
- SELECT `service_category` da `partner_services` per il partner
- SELECT `branch_cities` dal partner gia caricato

**C) Sostituire il blocco rating (righe 605-638)** con la nuova logica:

```
website_score: AI evaluation 1-5 (0 se no sito)
service_score: basato sul mix servizi
  - ocean_fcl/lcl only → 1
  - + air_freight → +1.5
  - + road_freight → +1
  - + warehousing → +1
  - + customs_broker → +0.5
  - cap a 5
network_score: count networks → scala 1-5
seniority_score: anni membership → scala 1-5
international_score: count branch countries → scala 1-5
linkedin_score: % contatti con LinkedIn + bonus seniority senior
company_score: employee_count + founded_year + awards + specialties

rating = weighted average → round to nearest 0.5
```

**D) Salvare `rating_details`** come JSON con i 7 sotto-punteggi per il tooltip:
```json
{
  "website_quality": 4,
  "service_mix": 3.5,
  "network_size": 4,
  "seniority": 5,
  "international": 2,
  "linkedin_presence": 3,
  "company_profile": 3
}
```

#### 2. `src/components/partners/PartnerRating.tsx`

Aggiornare `CRITERIA_LABELS` con i nuovi nomi dei 7 criteri:
```
website_quality → "Qualita Sito Web"
service_mix → "Mix Servizi"
network_size → "Dimensione Network"
seniority → "Anzianita WCA"
international → "Presenza Internazionale"
linkedin_presence → "LinkedIn Manager"
company_profile → "Profilo Aziendale"
```

### File da modificare
1. `supabase/functions/deep-search-partner/index.ts` — nuovo scraping sito, nuova logica rating, salvataggio rating_details
2. `src/components/partners/PartnerRating.tsx` — aggiornare labels e interfaccia RatingDetails

### Nota importante
Il ricalcolo retroattivo dei partner gia analizzati richiedera di rilanciare la Deep Search su di loro, poiche il nuovo rating necessita dello scraping del sito web (dato non disponibile nei dati esistenti). I partner gia processati manterranno il vecchio rating fino al prossimo Deep Search.

