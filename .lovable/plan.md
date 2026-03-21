

# Piano: Deep Search CRM al livello del Network + UI Enrichment per Contatti

## Problema reale

Ci sono **due gap fondamentali** tra Network e CRM:

### Gap 1: `deep-search-contact` e' una versione ridotta di `deep-search-partner`

| Capacita' | deep-search-partner (783 righe) | deep-search-contact (218 righe) |
|-----------|--------------------------------|-------------------------------|
| LinkedIn personale | Si, con 3 tentativi di retry | Si, ma 1 solo tentativo generico |
| Facebook/Instagram | Ricerca dedicata per contatto | Ricerca generica unica |
| WhatsApp auto-link | Si, da mobile/phone | No |
| Company LinkedIn | Si | No |
| Company profile (awards, specialties, news) | Si | No |
| Website discovery da email domain | Si | No |
| Logo discovery + scraping sito | Si | No |
| Website quality score AI | Si | No |
| Rating calcolato (7 criteri pesati) | Si | No |
| Profilo professionale per contatto | Si (background, seniority, interests, languages) | Solo summary generico |
| Validazione AI per URL trovati | Si (AI pick URL) | No, tutto in un unico prompt |

In pratica `deep-search-contact` fa 4 ricerche generiche e un unico prompt AI che restituisce tutto. `deep-search-partner` fa 10-15 ricerche mirate con AI validation ad ogni step.

### Gap 2: La UI del CRM ignora completamente `enrichment_data`

Il `ContactDetailPanel.tsx` non legge MAI `enrichment_data`. Anche se la Deep Search trovasse dati, non li mostrerebbe. Il pannello Network ha `EnrichmentCard`, `SocialLinks`, `ActivityList`, `PartnerRating`, `TrophyRow` — il CRM non ha nessuno di questi.

## Soluzione

### Fase 1 — Potenziare `deep-search-contact` (edge function)

Riscrivere la funzione per avere le stesse capacita' del partner:

1. **LinkedIn con retry intelligente** — 3 tentativi (nome+azienda, cognome+azienda, nome+citta')
2. **Facebook e Instagram separati** — ricerche dedicate, non generiche
3. **Company LinkedIn** — ricerca pagina aziendale
4. **Website discovery** — da dominio email o ricerca web
5. **Logo discovery** — scraping del sito + favicon fallback
6. **Company profile AI** — awards, specialties, news, founded year, employees
7. **Contact profile AI** — background, seniority, interests, languages
8. **WhatsApp auto-link** — da numero mobile se presente
9. **Salvataggio strutturato** — stessa struttura enrichment_data del partner (company_profile, contact_profiles, website_quality_score)

### Fase 2 — Creare `ContactEnrichmentCard.tsx`

Componente che legge `enrichment_data` dal contatto e mostra:
- Company profile (awards, specialties, news, founded year, employees)
- Professional background della persona
- Social links trovati (LinkedIn, Facebook, Instagram, WhatsApp)
- Logo aziendale scoperto
- Website quality score
- Confidence level della ricerca
- Crediti consumati

Basato sullo stesso design di `EnrichmentCard.tsx` del Network.

### Fase 3 — Aggiornare `ContactDetailPanel.tsx`

Integrare:
- `ContactEnrichmentCard` dopo la sezione header
- Social links come bottoni azione (LinkedIn, Facebook, Instagram)
- Logo aziendale nel header se disponibile
- Website link se scoperto
- Badge confidence (high/medium/low)

### Fase 4 — Salvare social links nel DB per i contatti

Oggi i link social dei contatti vengono salvati solo dentro `enrichment_data` come JSON. Per coerenza con il Network (che usa `partner_social_links`), i link trovati andrebbero salvati in modo strutturato — ma per non complicare lo schema, useremo `enrichment_data` come source of truth e li mostriamo dalla UI.

## File da creare/modificare

| File | Azione |
|------|--------|
| `supabase/functions/deep-search-contact/index.ts` | Riscrivere — stesse capacita' del partner |
| `src/components/contacts/ContactEnrichmentCard.tsx` | Creare — mostra enrichment data |
| `src/components/contacts/ContactDetailPanel.tsx` | Modificare — integrare enrichment card + social links |

## Risultato

- Deep Search su un contatto CRM produce gli stessi dati ricchi del Network
- La UI mostra tutto: LinkedIn, company profile, logo, website, background professionale
- L'utente puo' fare attivita' commerciale seria con dati completi anche dal CRM

