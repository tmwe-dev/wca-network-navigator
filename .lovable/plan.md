

# Tab orizzontali per raggruppamento + Card arricchite + Matching contatti-WCA

## Panoramica

Tre interventi sulla pagina Contatti del CRM:
1. Barra di tab orizzontali scrollabili sopra la lista, che riflettono il raggruppamento attivo (paese, origine, stato)
2. Card dei contatti arricchite con bandiera, origine, città visibili direttamente nella riga
3. Sistema di matching contatti → partner WCA (come fatto per i biglietti da visita) con opzione di esclusione

---

## 1. Tab orizzontali sopra la lista contatti

Aggiungere in `ContactListPanel.tsx`, tra l'header e la lista, una barra scrollabile orizzontale che mostra i gruppi basati sul `groupBy` attivo nel contesto globale.

- Se `groupBy === "country"` → tab per ogni paese con bandiera e conteggio (es. "🇮🇹 Italy (4932)")
- Se `groupBy === "origin"` → tab per ogni origine con conteggio
- Se `groupBy === "lead_status"` → tab per ogni stato

Cliccando un tab si filtra la lista per quel valore. Un tab "Tutti" a sinistra mostra tutto.

I dati dei gruppi vengono calcolati lato client dai contatti già caricati oppure tramite una query leggera (conteggio per colonna), riutilizzando la stessa logica del `CRMContactNavigator` nella sidebar.

```text
[Tutti (11404)] [🇮🇹 Italy (4932)] [🇮🇳 India (2337)] [🇺🇸 US (1477)] [🇦🇪 UAE (111)] →
─────────────────────────────────────────────────────────────────────────
#1 □ 🇮🇹 Logigate Srl  |  Mario Rossi · CEO  |  Milano  |  WCA OLD  |  ...
```

## 2. Card contatti arricchite

La `ContactCard.tsx` attuale non mostra bandiera paese. Modifiche:

- Aggiungere la bandiera del paese (da `resolveCountryCode(c.country)`) subito dopo il checkbox, prima del nome azienda
- La bandiera sostituisce l'icona `Building2` come primo elemento visivo
- Mantenere gli altri elementi già presenti (città, origine, indicatori)

## 3. Matching contatti → partner WCA

Concetto: molti dei ~11.400 contatti importati potrebbero corrispondere a partner WCA già nel database. Identificarli evita duplicazioni.

**Approccio tecnico:**
- Creare una migration che aggiunge a `imported_contacts` due colonne: `wca_partner_id UUID REFERENCES partners(id)` e `wca_match_confidence SMALLINT`
- Creare un trigger o funzione SQL simile a `match_business_card` che confronta `company_name`/`company_alias` con `partners.company_name`, dominio email con `partner_contacts.email`, e boost per paese
- Aggiungere un filtro nella UI: "Nascondi matchati WCA" / "Solo matchati WCA" / "Tutti" — come chip nella barra tab o nel filtro sidebar
- Nel `ContactCard`, se `wca_partner_id` è valorizzato, mostrare un badge "WCA" verde per indicare il match

**Flusso utente:**
1. L'utente clicca "Match con WCA" (bottone nella toolbar)
2. Un edge function (o RPC) esegue il matching batch
3. I risultati appaiono come badge nelle card
4. L'utente può filtrare per vedere solo i non-matchati (contatti "puri") o solo i matchati

---

## File coinvolti

| File | Modifica |
|------|----------|
| `src/components/contacts/ContactListPanel.tsx` | Aggiungere barra tab orizzontali sopra la lista con gruppi dinamici |
| `src/components/contacts/ContactCard.tsx` | Aggiungere bandiera paese, badge WCA match |
| `src/hooks/useContacts.ts` | Aggiungere filtro `wcaMatch` (matched/unmatched/all) e colonna `wca_partner_id` |
| `src/contexts/GlobalFiltersContext.tsx` | Aggiungere `crmGroupTab` per il tab attivo selezionato |
| Migration SQL | Aggiungere `wca_partner_id` e `wca_match_confidence` a `imported_contacts`; creare funzione `match_contacts_to_wca()` |

