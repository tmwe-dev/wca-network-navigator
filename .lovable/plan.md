

# Fix BCA: Bandiera mancante, scroll pannello dettaglio, sidebar contatti vuota

## Problemi identificati

### 1. Bandiera mancante per card "No match"
La bandiera viene presa SOLO da `card.partner?.country_code`. Se il biglietto è "unmatched" (nessun partner associato), `card.partner` è `null` e la bandiera non appare. Tuttavia il biglietto ha spesso dati nel campo `raw_data` o `location` che contengono il paese.

**Fix**: Nella funzione `countryFlag` usata in `CompactRow`, `CardGridItem`, `ExpandedCardItem`, cercare il paese anche da:
1. `card.raw_data?.country` o `card.raw_data?.country_code`
2. Parsare `card.location` per estrarre un codice paese (se contiene un nome paese noto)
3. Se `card.notes` contiene un paese riconoscibile

Creare una funzione `getCardCountryCode(card)` che cerca in ordine: `card.partner?.country_code` → `card.raw_data?.country_code` → `card.raw_data?.country` (mappato a codice) → fallback da `card.location`.

### 2. Scroll pannello dettaglio bloccato
Il contenitore del pannello destro ha `overflow-hidden` (riga 903):
```
<div className="w-[320px] shrink-0 bg-card/50 backdrop-blur-sm overflow-hidden">
```
Il panel interno `BusinessCardDetailPanel` ha `overflow-y-auto` ma il contenitore padre con `overflow-hidden` e senza altezza esplicita impedisce lo scroll.

**Fix**: Cambiare il contenitore esterno del pannello destro in una struttura flex con il header fisso e il contenuto scrollabile:
- Contenitore: `flex flex-col h-full overflow-hidden`
- Header: `shrink-0`
- Panel content: `flex-1 min-h-0 overflow-y-auto`

### 3. Sidebar contatti: manca elenco contatti/gruppi
La `CRMFiltersSection` mostra solo Paesi e Origini (chip WCA/Import/RA/BCA). Manca un elenco navigabile dei contatti raggruppati (come nel Network che mostra i partner per paese). La sidebar mostra United States (999) e Italy (1) perché quelli sono i paesi presenti in `imported_contacts`.

Il problema è che il tab "Biglietti" (BCA) non ha la sua sezione dedicata nella sidebar. La `CRMFiltersSection` filtra solo i contatti (`imported_contacts`), non i biglietti (`business_cards`).

**Fix**: Rendere la sidebar CRM context-aware rispetto al tab attivo:
- Quando tab = "contatti": mostrare i filtri contatti attuali (paesi, origini, ecc.) — i dati sono corretti, la sidebar funziona per i contatti
- Quando tab = "biglietti": mostrare filtri BCA (evento, match status, paese dei biglietti) nella sidebar, e spostare i filtri inline dal `BusinessCardsHub` alla sidebar

Per il tab biglietti aggiungere nella sidebar:
- **Evento**: lista eventi con conteggi
- **Stato match**: Tutti/Match/No match/Attesa
- **Paesi**: estratti da `business_cards.raw_data` o `partner.country_code`

## File coinvolti

| File | Modifica |
|------|----------|
| `src/components/contacts/BusinessCardsHub.tsx` | Fix flag: creare `getCardCountryCode()`. Fix scroll: ristrutturare contenitore pannello destro con flex layout |
| `src/components/global/FiltersDrawer.tsx` | Aggiungere `BCAFiltersSection` per tab biglietti con filtri evento/status/paese |
| `src/pages/CRM.tsx` | Passare il tab attivo al context globale per permettere alla sidebar di mostrare i filtri corretti |
| `src/contexts/GlobalFiltersContext.tsx` | Aggiungere `crmActiveTab` per comunicare alla sidebar quale sezione è attiva |

