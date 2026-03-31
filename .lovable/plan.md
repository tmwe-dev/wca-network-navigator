

# Arricchire le Card Partner dopo Deep Search

## Problema Attuale

La card nella lista partner (`PartnerVirtualList`) mostra:
- **Logo**: box 7x7 con iniziale se `logo_url` è null — ma anche dopo Deep Search il logo spesso non appare (troppo piccolo, onError lo nasconde)
- **Bandiera paese**: **NON ESISTE** — `getCountryFlag()` è disponibile in `src/lib/countries.ts` ma non viene mai usata nella lista
- **StatusDot**: 4 pallini verde/grigio generici (Profilo, Email, Telefono, Deep Search) — zero contesto visivo
- **LinkedIn**: nessuna icona, nessuno stato connessione
- **Enrichment data**: completamente nascosto — nessun dato dalla Deep Search visibile

## Cosa Cambia

### 1. Aggiungere bandiera paese alla card
- Importare `getCountryFlag` da `@/lib/countries`
- Mostrare emoji bandiera accanto alla città (es. "🇮🇹 Milano")
- Dimensione `text-sm` per visibilità

### 2. Migliorare visualizzazione logo
- Aumentare da `w-7 h-7` a `w-9 h-9`
- Se no logo ma c'è `enrichment_data?.logo_url` → usare quello come fallback
- Se nessun logo → mostrare bandiera grande nel placeholder invece della sola iniziale

### 3. Aggiungere icone social dalla Deep Search
- Leggere `partner_social_links` (già caricato via join?) o `enrichment_data.social_links`
- Mostrare micro-icone: LinkedIn (blu se trovato), WhatsApp (verde se telefono disponibile)
- Se `enrichment_data.linkedin_connection_status` esiste → mostrare badge stato (connected/pending)

### 4. Sostituire StatusDot generico con indicatori informativi
- Mantenere i 4 dot ma aggiungere **colori differenziati**:
  - Deep Search completato → icona `Telescope` mini invece di pallino
  - LinkedIn trovato → icona `Linkedin` mini
  - Email verificata → pallino verde con check
- Aggiungere **AI rating** se presente in `enrichment_data.ai_profile?.rating`

### 5. Mostrare snippet enrichment
- Se Deep Search fatto: mostrare una riga sotto con headline/settore da `enrichment_data.ai_profile`
- Troncato, colore muted, max 1 riga

## File da Modificare

1. **`src/components/operations/PartnerVirtualList.tsx`** — Tutte le modifiche UI sopra
2. **`src/components/operations/partner-list/SubComponents.tsx`** — Nuovo componente `EnrichedStatusIcons` per sostituire i 4 `StatusDot`
3. **`src/lib/partnerUtils.ts`** — Helper `getEffectiveLogoUrl(partner)` che controlla `logo_url` → `enrichment_data.logo_url` → null

## Impatto
- Altezza riga da `estimateSize: 52` a `estimateSize: 62` (una riga in più per snippet)
- Zero nuove query DB — tutti i dati sono già nel partner object caricato
- La card diventa visivamente ricca dopo Deep Search, mostrando l'effettivo valore dei dati raccolti

