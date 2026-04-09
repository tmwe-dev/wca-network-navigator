

# Piano: Ordinamento + Contatti Raggruppati per Azienda in CompanyList

## Situazione Attuale

- `CompanyList` mostra un partner per riga, con solo nome azienda, città, email, tipo
- Non carica i contatti (`partner_contacts`) — non si vedono i contatti multipli
- Ordinamento solo implicito (alfabetico per nome, dal DB)
- SBA Albania ha 25 contatti, Pelikan 20, ecc. — dati reali nel DB

## Interventi

### 1. Caricare contatti per ogni partner visibile

**File: `src/components/campaigns/CompanyList.tsx`**

- Aggiungere un hook `usePartnerContacts(partnerIds)` che fa query su `partner_contacts` per tutti i partner nella vista corrente
- Ritorna una mappa `Record<string, PartnerContact[]>` raggruppata per `partner_id`
- Ogni contatto ha: `id, name, title, email, direct_phone, mobile, is_primary, contact_alias`

### 2. Aggiungere controlli di ordinamento

**File: `src/components/campaigns/CompanyList.tsx`**

- Aggiungere pulsanti di ordinamento nella header: **Nome** (A→Z) e **Città** (A→Z)
- Aggiungere ordinamento per **N° contatti** (decrescente) per trovare subito le aziende con più contatti
- Il sort si applica alla lista `filteredPartners` nel memo

### 3. Card azienda espandibile con contatti raggruppati

Per ogni partner che ha più contatti:
- Mostrare badge con conteggio contatti (es. `👥 25 contatti`)
- Click sulla card espande/collassa la lista contatti sotto
- Ogni contatto mostra: nome, titolo, email, telefono
- Il contatto primario (`is_primary`) è evidenziato in cima
- Checkbox individuale per ogni contatto → permette selezione specifica

### 4. Selezione multipla a livello contatto

- Stato di selezione attuale: `Set<string>` di partner IDs
- Aggiungere un secondo livello: `Set<string>` di contact IDs selezionati
- Checkbox sul partner = seleziona/deseleziona tutti i suoi contatti
- Checkbox sul singolo contatto = selezione granulare
- Il footer "Aggiungi alla campagna" mostra sia partner che contatti selezionati
- Quando si aggiunge alla campagna, il `selected_contact_id` viene passato per il cockpit

## File coinvolti

| File | Modifica |
|------|----------|
| `src/components/campaigns/CompanyList.tsx` | Sort controls, contatti espandibili, selezione contatti |
| `src/pages/Campaigns.tsx` | Passare stato selezione contatti, propagare al cockpit |

## Risultato atteso

- Posso ordinare per nome, città o numero contatti
- Ogni azienda mostra quanti contatti ha
- Espandendo una card vedo tutti i contatti con i loro dati
- Posso selezionare contatti specifici per la campagna
- Il contatto scelto viene associato all'attività nel cockpit

