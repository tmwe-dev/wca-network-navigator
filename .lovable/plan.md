
# Filtri Avanzati per il Partner Hub

## Cosa cambia

Il pannello filtri (Sheet laterale destra) viene completamente potenziato con nuove sezioni per filtrare i partner in modo combinato e preciso.

## Nuove sezioni filtro

### 1. Paesi (multi-selezione)
- Attualmente si puo' selezionare UN solo paese. Verra' trasformato in multi-selezione con chip rimovibili, come gia' fatto nella toolbar Acquisizione.

### 2. Servizi (gia' presente, invariato)
- 14 servizi disponibili: Air Freight, Ocean FCL/LCL, Road, Rail, Project Cargo, Dangerous Goods, Perishables, Pharma, eCommerce, Relocations, Customs Broker, Warehousing, NVOCC.

### 3. Network WCA (nuovo)
- Selezione multipla tra i network presenti nel database: WCA Inter Global, WCA First, WCA Advanced Professionals, WCA China Global, WCA Projects, WCA Dangerous Goods, WCA Perishables, WCA Time Critical, WCA Pharma, WCA eCommerce, GAA, Lognet, ecc.

### 4. Certificazioni (nuovo)
- Checkbox per: IATA, ISO, AEO, C-TPAT, BASC

### 5. Rating minimo (nuovo)
- Slider da 0 a 5 stelle per filtrare solo partner con rating uguale o superiore

### 6. Anni di permanenza WCA (nuovo)
- Slider per impostare il numero minimo di anni di membership

### 7. Scadenza copertura WCA (nuovo)
- Filtro per la data di scadenza della membership: opzioni tipo "Scade entro 3 mesi", "Scade entro 6 mesi", "Scade entro 1 anno", "Attiva" per trovare partner con copertura in scadenza

### 8. Ha filiali (nuovo)
- Toggle per mostrare solo partner con branch office

### 9. Preferiti (gia' presente, invariato)

## Modifiche tecniche

| File | Modifica |
|------|----------|
| `src/hooks/usePartners.ts` | Estendere `PartnerFilters` con nuovi campi: `networks`, `certifications`, `minRating`, `minYearsMember`, `hasBranches`, `expiresWithinMonths`. Aggiungere logica di filtraggio lato client per i campi che richiedono join (network, certificazioni, rating, expiration). |
| `src/components/partners/PartnerFiltersSheet.tsx` | Ricostruire il pannello con tutte le nuove sezioni: multi-select paesi, network, certificazioni, slider rating, slider anni WCA, filtro scadenza, toggle filiali. Organizzare in sezioni collassabili. |
| `src/pages/PartnerHub.tsx` | Aggiornare il conteggio filtri attivi (`activeFilterCount`) per includere i nuovi filtri. Aggiungere il filtraggio lato client nel `filteredPartners` per network, certificazioni, rating, anni, scadenza e filiali. |

## Come funziona il filtraggio

Alcuni filtri (paese, tipo, preferiti) vengono applicati nella query Supabase. Gli altri (network, certificazioni, rating, anni, scadenza, filiali) vengono applicati lato client dopo il fetch, perche' richiedono accesso ai dati delle tabelle collegate gia' incluse nel select (partner_networks, partner_certifications, ecc.).

## Aspetto visivo

Il pannello mantiene lo stile glassmorphism esistente con sezioni collassabili. Ogni sezione ha un'icona e un titolo chiaro. I filtri attivi vengono mostrati come badge numerici sul pulsante filtro e come chip nel pannello. Il pulsante "Pulisci" resetta tutti i filtri in un click.
