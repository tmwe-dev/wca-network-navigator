

# Business Cards nel Network: Deep Search, Card Migliorate e Raggruppamento per Azienda

## Cosa serve

1. **Deep Search sulle Business Cards** — possibilita' di selezionare BCA e lanciare Deep Search (usa il partner matchato come target, o cerca per company_name se non matchato)
2. **Card piu' grandi e informative** — mostrare logo del partner matchato, telefono, posizione, data evento, e risultato Deep Search (icona Brain dorata)
3. **Raggruppamento per azienda** — le BCA con lo stesso `company_name` o `matched_partner_id` devono essere raggruppate visivamente (card azienda espandibile con sotto i contatti)
4. **Select All** — checkbox "Seleziona tutti" nella toolbar
5. **Verifica associazioni** — controllare i dati attuali nel DB per capire quante BCA ci sono e come sono matchate

## Dettagli tecnici

### 1. `src/pages/Operations.tsx` — `BusinessCardsView` riscritta

- **Raggruppamento**: creare un `Map<string, BusinessCard[]>` raggruppato per `matched_partner_id` (se presente) oppure per `company_name` normalizzato. Ogni gruppo mostra una card-container con il nome azienda, logo (dal partner matchato via join), e sotto la lista dei contatti
- **Card piu' grandi**: layout a 2-3 colonne invece di 4. Ogni card contatto mostra: nome, posizione, email, telefono, mobile, evento, data, badge matchato, icona Deep Search
- **Select All**: checkbox nella toolbar che seleziona/deseleziona tutti i filtrati
- **Deep Search button**: nella toolbar, attivo quando `selectedBca.size > 0`. Per ogni BCA selezionata:
  - Se ha `matched_partner_id`: lancia Deep Search sul partner
  - Se non matchata: usa `company_name` per cercare il partner o lancia deep search generica
- **Logo**: fetch del `logo_url` dal partner matchato. Aggiungere una query che fa join `business_cards.matched_partner_id → partners.id` per ottenere `logo_url` e `company_alias`

### 2. `src/hooks/useBusinessCards.ts` — Arricchire query

- Modificare `useBusinessCards` per fare un select che includa i dati del partner matchato:
  ```
  .select("*, partner:matched_partner_id(id, company_name, logo_url, company_alias, enrichment_data)")
  ```
- Questo permette di mostrare logo e stato deep search direttamente nella card

### 3. Deep Search integration

- Riutilizzare `useDeepSearch` gia' presente in Operations. Aggiungere un handler `handleBcaDeepSearch` che:
  - Per ogni BCA selezionata con `matched_partner_id`, chiama `deepSearch.run(partnerId)`
  - Mostra toast con progresso

## File coinvolti

| File | Azione |
|------|--------|
| `src/pages/Operations.tsx` | Riscrivere `BusinessCardsView`: raggruppamento per azienda, card grandi, Select All, Deep Search button |
| `src/hooks/useBusinessCards.ts` | Arricchire query con join su partners per logo/alias/enrichment |

