

# Deep Search, Bandiere sulle BCA e Sincronizzazione

## 1. Bandiera sul Biglietto da Visita

Attualmente le card BCA non mostrano alcuna bandiera del Paese. Il campo `country` non esiste nella tabella `business_cards`, ma possiamo ricavarlo dal partner matchato (`partners.country_code`) o dedurlo dal prefisso telefonico / indirizzo.

**Soluzione**: nella vista Business Cards di Operations, mostrare la bandiera emoji accanto al nome del contatto. Fonte dati:
- Se la BCA e' matchata a un partner → usa `partner.country_code` (gia' disponibile dal join)
- Se non matchata → estrarre il country code dal campo `location` o dal prefisso telefonico (mapping prefisso → paese)

**File**: `src/pages/Operations.tsx` — aggiungere bandiera nel template card BCA

---

## 2. Dove cerca la Deep Search oggi

La Deep Search per i partner (`deep-search-partner`) esegue queste ricerche via **Firecrawl** (web scraping + search API):

| Cosa cerca | Dove | Note |
|---|---|---|
| LinkedIn personale | `site:linkedin.com/in` | 3 tentativi: nome+azienda, cognome+azienda, nome+citta'. AI seleziona il profilo corretto |
| Facebook personale | `site:facebook.com` | Per ogni contatto |
| Instagram personale | `site:instagram.com` | Per ogni contatto |
| WhatsApp | Genera link `wa.me/` | Dal numero mobile o telefono diretto |
| LinkedIn aziendale | `site:linkedin.com/company` | Una sola ricerca per azienda |
| Profilo professionale | Web generico | 2-3 query per contatto, AI genera un JSON con background, interessi, lingue, seniority |
| Profilo aziendale | Web generico | Cerca awards, certificazioni extra, news recenti, specialita', anno fondazione, dipendenti stimati |
| Sito web | Dominio email / ricerca web | Se manca il website, lo deduce dall'email o lo cerca |
| Logo | Scraping del sito web | Branding Firecrawl → OG image → Google favicon |
| Qualita' sito web | AI valuta il markdown del sito | Score 1-5 su design, completezza, professionalita' |
| Rating finale | Calcolo ponderato | 7 criteri: website(20%), servizi(20%), network(15%), anzianita'(15%), sedi(10%), LinkedIn(10%), profilo azienda(10%) |

Tutto viene salvato in `partners.enrichment_data` e `partner_social_links`.

---

## 3. Sincronizzazione con il server

Attualmente **non esiste** una Edge Function `sync-wca-partners` o simile per sincronizzare dati dal database esterno. La memoria di sistema menziona un sistema SSE per la sincronizzazione cloud-to-cloud, ma la funzione non e' presente nel codice.

Per sincronizzare le business cards con l'origine (la tabella `wca_business_cards` nel DB esterno `dlldkrzoxvjxpgkkttxu`), bisogna:
- Creare una Edge Function `sync-business-cards` che legga dal DB esterno e faccia upsert nella tabella locale `business_cards`
- Oppure aggiungere un pulsante "Sincronizza" nella UI che invochi la funzione

**Per i partner**, la sincronizzazione avviene gia' tramite `scrape-wca-partners` che scarica e salva i profili.

---

## Piano di implementazione

### Step 1 — Bandiere nelle BCA card
- In `src/pages/Operations.tsx`, nel template delle card BCA, aggiungere la bandiera emoji
- Creare un piccolo helper `countryCodeToFlag(code)` che converte "IT" → 🇮🇹
- Usare `card.partner?.country_code` se matchato, altrimenti tentare di dedurre dal `location`

### Step 2 — Funzione sync business cards (opzionale, se richiesto)
- Creare `supabase/functions/sync-business-cards/index.ts` che legge da `dlldkrzoxvjxpgkkttxu` e upsert nella tabella locale
- Aggiungere pulsante "Sincronizza" nella toolbar BCA di Operations

### File coinvolti

| File | Azione |
|------|--------|
| `src/pages/Operations.tsx` | Aggiungere bandiera nelle card BCA |
| `supabase/functions/sync-business-cards/index.ts` | **Nuovo** — sincronizzazione BCA dal DB esterno (se confermato) |

