

# Piano: Campagne + Biglietti da Visita + Contesto "Incontrato di Persona" nelle Comunicazioni AI

## Problemi Identificati

1. **Dropdown paesi in Campagne** usa `WCA_COUNTRIES_MAP` (dati statici) — non la tabella `partners` reale. I conteggi vengono dai partner ma la lista paesi e' statica.
2. **Nessun supporto biglietti da visita (BCA)** nella pagina Campagne — solo partner WCA.
3. **Nessun contesto "incontrato di persona"** nelle Edge Function `generate-email` e `generate-outreach` — quando un partner ha un biglietto da visita associato (`business_cards.matched_partner_id`), l'AI non lo sa e non adatta il tono.
4. **Partner con BCA associato** non sono evidenziati visivamente nella lista.

## Interventi

### 1. Doppia sorgente nella Campagne: Partner + Biglietti da Visita

**File: `src/pages/Campaigns.tsx`**

Aggiungere un tab/toggle nell'header (o nella dropdown paesi) per switchare tra:
- **Partner** (comportamento attuale — query `partners`)
- **Biglietti da Visita** (query `business_cards` con join su partner)

La dropdown paesi viene alimentata da entrambe le sorgenti a seconda del tab attivo:
- Tab Partner: paesi dai partner (come ora)
- Tab BCA: paesi estratti da `business_cards.location` o dal partner associato (`matched_partner_id → partners.country_code`)

**File: `src/hooks/usePartnersForGlobe.ts`**

Aggiungere un nuovo hook `useBusinessCardsForCampaign(countryCode)` che carica i biglietti da visita con il partner associato, raggruppati per paese.

### 2. Evidenziare partner con BCA nella CompanyList

**File: `src/components/campaigns/CompanyList.tsx`**

- Query parallela: caricare i `matched_partner_id` dalla tabella `business_cards` (gia' disponibile via `useBusinessCardPartnerMatches`)
- Se un partner ha un BCA associato: bordo sinistro viola/ambra + badge "🤝 Incontrato" con nome evento
- Tooltip con dettagli: evento, data, nome contatto dal biglietto

### 3. Flusso "Genera Jobs" → Cockpit con goal

**File: `src/pages/Campaigns.tsx`** — funzione `onGenerateJobs`

Attualmente inserisce in `activities` e naviga a `/reminders`. Modificare per:
- Inserire in `cockpit_queue` (source_type: 'campaign') come fanno le altre sezioni
- Aggiungere un campo goal selezionabile (Primo contatto, Follow-up, Partnership, ecc.) prima della conferma
- I partner con BCA associato ricevono automaticamente il goal "Follow-up fiera" o simile

### 4. Contesto "Incontrato di Persona" nelle Edge Function AI

**Questo e' il punto critico: attualmente `generate-email` e `generate-outreach` NON sanno se il destinatario e' stato incontrato di persona.**

**File: `supabase/functions/generate-email/index.ts`**

Quando viene fornito un `partner_id`, fare una query aggiuntiva:
```sql
SELECT contact_name, event_name, met_at, location 
FROM business_cards 
WHERE matched_partner_id = $partner_id 
LIMIT 3
```

Se ci sono risultati, iniettare nel system prompt:
- "Hai incontrato questa azienda di persona a [evento] il [data] a [luogo]. Il contatto era [nome]. Usa un tono piu' caldo e familiare, fai riferimento all'incontro."

**File: `supabase/functions/generate-outreach/index.ts`**

Stessa logica: query `business_cards` per `matched_partner_id`, iniezione nel contesto.

### 5. BCA nel Country Dropdown

**File: `src/pages/Campaigns.tsx` — `CampaignHeaderControls`**

Modificare la dropdown paesi con due sezioni:
- Segmento superiore con toggle "Partner | BCA"
- I conteggi si aggiornano in base alla selezione
- Quando BCA e' attivo, il `CompanyList` mostra i biglietti da visita raggruppati per azienda

## File Coinvolti

| File | Azione |
|------|--------|
| `src/pages/Campaigns.tsx` | Toggle Partner/BCA, goal picker, flusso cockpit, highlight BCA |
| `src/components/campaigns/CompanyList.tsx` | Badge "Incontrato", bordo colorato per BCA |
| `src/hooks/usePartnersForGlobe.ts` | Nuovo hook per BCA per campagne |
| `supabase/functions/generate-email/index.ts` | Query business_cards + iniezione contesto "met in person" |
| `supabase/functions/generate-outreach/index.ts` | Stessa iniezione contesto |

## Ordine di Esecuzione

1. Aggiungere toggle Partner/BCA e hook BCA in Campaigns
2. Evidenziare partner con BCA in CompanyList
3. Aggiornare flusso "Genera Jobs" → cockpit con goal
4. Iniettare contesto "incontrato di persona" in `generate-email`
5. Iniettare contesto "incontrato di persona" in `generate-outreach`

