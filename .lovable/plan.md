
# Fix associazione paese-ID nei download job

## Problema confermato

I dati nel database lo dimostrano chiaramente: **tutti i job hanno 311 ID identici**, indipendentemente dal paese. "American Samoa" sta processando "Andes Logistics Argentina" perche' ogni job ha ricevuto la stessa lista globale.

Il raggruppamento per paese introdotto nell'ultimo fix non funziona perche' il campo `country` nei members contiene il **nome** restituito dal server WCA (che puo' differire dal nome usato nell'app), e non esiste un campo `country_code` affidabile sui membri.

## Causa radice

Durante la scansione directory (Fase 1), il sistema sa esattamente quale paese sta scansionando (`country.code`), ma questa informazione viene persa: il member riceve solo `country: m.country || country.name` (un nome testuale). Quando poi in Fase 2 si tenta di raggruppare per paese, il match per nome fallisce per differenze di formato.

## Soluzione

Salvare il `country_code` direttamente su ogni member durante la scansione, poi usarlo nel raggruppamento.

### Modifiche

**1. Interfaccia `DirectoryMember`** (`src/lib/api/wcaScraper.ts`)
- Aggiungere campo opzionale `country_code?: string`

**2. Scansione directory** (`src/pages/DownloadManagement.tsx`, ~riga 940)
- Quando si creano i newMembers, aggiungere `country_code: country.code`
- Salvare `country_code` anche nella cache

**3. Cache members** (~riga 879)
- Includere `country_code: m.country_code` nell'oggetto salvato in cache
- Includere `country_code` anche nel recupero dalla cache (~riga 780)

**4. Raggruppamento Phase2** (~riga 1387)
- Usare `m.country_code` invece di cercare di matchare per nome:

```text
const idsByCountry = new Map<string, number[]>();
for (const m of members) {
  if (!m.wca_id || !m.country_code) continue;
  if (!idsByCountry.has(m.country_code)) idsByCountry.set(m.country_code, []);
  idsByCountry.get(m.country_code)!.push(m.wca_id);
}
```

**5. Cancellare i job errati**
- I job attualmente in corso con 311 ID ciascuno sono tutti sbagliati e vanno cancellati o fermati prima di rilanciare
