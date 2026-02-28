

## Piano: Salvare networks, services e certifications in `profileSaver.ts`

### Contesto
L'estensione Chrome estrae `result.profile.networks[]` (oggetti `{name, expires}`), `result.profile.services[]` (stringhe) e `result.profile.certifications[]` (stringhe) ma `profileSaver.ts` li ignora. Vanno salvati durante il download.

### Modifica: `src/lib/download/profileSaver.ts`

Dopo il blocco di salvataggio profilo (dopo `raw_profile_html`), aggiungere tre blocchi:

**A) Networks** — Per ogni elemento in `result.profile.networks[]`:
- SELECT esistenti da `partner_networks` per quel `partner_id`
- INSERT solo quelli con `network_name` non già presente
- Mappare `{name, expires}` a `{partner_id, network_name, expires}`

**B) Services** — Per ogni stringa in `result.profile.services[]`:
- Mappare il testo estratto dal DOM alla enum `service_category` valida: `air_freight`, `ocean_fcl`, `ocean_lcl`, `road_freight`, `rail_freight`, `project_cargo`, `dangerous_goods`, `perishables`, `pharma`, `ecommerce`, `relocations`, `customs_broker`, `warehousing`, `nvocc`
- Usare una lookup map (es. "air" → `air_freight`, "sea"/"ocean"/"fcl" → `ocean_fcl`, ecc.)
- SELECT esistenti, INSERT solo quelli mancanti

**C) Certifications** — Per ogni stringa in `result.profile.certifications[]`:
- Normalizzare il testo e filtrare per valori validi nella enum `certification_type`: `IATA`, `BASC`, `ISO`, `C-TPAT`, `AEO`
- Usare regex/includes per mappare (es. testo contenente "IATA" → `IATA`, "ISO" → `ISO`, ecc.)
- SELECT esistenti, INSERT solo quelli mancanti

### File da modificare
- `src/lib/download/profileSaver.ts` — aggiungere 3 blocchi di upsert dopo il salvataggio profilo/HTML

