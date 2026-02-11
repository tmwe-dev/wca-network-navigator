

# Fix: Nomi aziendali nella coda sempre visibili

## Problema radice

Quando il job viene ripreso (resume), la coda viene ricostruita partendo da placeholder "WCA + ID". Il sistema prova a recuperare i nomi reali da due fonti:
1. Tabella `partners` -- funziona solo per i partner gia' scaricati
2. Tabella `directory_cache` -- ma la cache per la Bulgaria contiene solo 1 membro su 29

Per i partner non ancora scaricati e non presenti in cache, il nome resta "WCA 121870".

Inoltre, quando il server processa un partner e non lo trova (`found: false`), il campo `last_processed_company` nel job resta vuoto, e la UI non ha modo di recuperare il nome reale.

## Correzioni

### File: `src/pages/AcquisizionePartner.tsx`

**1. Resume: se la cache e' incompleta, riscansionare la directory**

Dopo aver provato `partners` e `directory_cache`, se ci sono ancora nomi "WCA {id}", lanciare una scansione fresca della directory per quel paese. Questo riempie sia la cache che i nomi nella coda.

```typescript
// Dopo il blocco di enrichment dalla cache (riga ~135):
const stillMissing2 = queueItems.filter(q => q.company_name.startsWith("WCA "));
if (stillMissing2.length > 0) {
  // Riscansiona la directory per ottenere i nomi reali
  const { data: scanResult } = await supabase.functions.invoke("scrape-wca-directory", {
    body: { countryCode: job.country_code, network: "" }
  });
  if (scanResult?.members) {
    // Salva in cache per il futuro
    await supabase.from("directory_cache").upsert({ ... });
    // Aggiorna i nomi nella coda
    for (const m of scanResult.members) {
      const qi = stillMissing2.find(q => q.wca_id === m.wca_id);
      if (qi) { qi.company_name = m.company_name; qi.city = m.city; }
    }
  }
}
```

**2. Polling: aggiornare il nome nella coda quando il partner viene scaricato**

Gia' fatto alla riga 633, ma solo se `canvas.company_name` e' diverso dal placeholder. Aggiungere un controllo esplicito: se il nome nel canvas e' ancora "WCA {id}", provare a leggerlo dalla `directory_cache`:

```typescript
// Riga ~415: quando si costruisce il canvas per un partner appena processato
let resolvedName = partnerData?.company_name || item.company_name;
if (resolvedName.startsWith("WCA ")) {
  // Ultimo tentativo: cerca nella cache
  const { data: cacheRows } = await supabase
    .from("directory_cache").select("members").eq("country_code", item.country_code);
  for (const row of cacheRows || []) {
    const found = (row.members as any[])?.find(m => m.wca_id === item.wca_id);
    if (found?.company_name) { resolvedName = found.company_name; break; }
  }
}
```

**3. Edge function: salvare il nome reale anche quando found=false**

Nel file `supabase/functions/process-download-job/index.ts`, quando lo scraper ritorna `found: false`, il `lastCompany` resta vuoto. Dovremmo cercare il nome dalla `directory_cache` come fallback:

```typescript
// Riga ~136 di process-download-job/index.ts:
if (result.success && result.found) {
  lastCompany = result.partner?.company_name || '';
}
// AGGIUNTA: fallback dalla cache se non trovato
if (!lastCompany) {
  const { data: cacheRows } = await supabase
    .from('directory_cache').select('members').eq('country_code', job.country_code);
  for (const row of (cacheRows || [])) {
    const found = (row.members as any[])?.find(m => m.wca_id === wcaId);
    if (found?.company_name) { lastCompany = found.company_name; break; }
  }
}
```

## File modificati

| File | Modifica |
|------|----------|
| `src/pages/AcquisizionePartner.tsx` | Resume: riscansione directory se nomi mancanti + fallback cache nel polling |
| `supabase/functions/process-download-job/index.ts` | Fallback nome dalla cache quando scraper non trova il partner |

## Risultato atteso

- La coda mostra SEMPRE i nomi reali delle aziende, sia alla prima scansione che al resume
- Il job nel DB registra sempre il nome reale del partner processato
- Se un partner non viene trovato dallo scraper, il nome viene recuperato dalla cache della directory

