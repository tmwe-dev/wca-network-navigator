

# Piano: Correzione Nomi Placeholder e Fallback dalla Directory Cache

## Problema

Due partner in Angola mostrano "WCA 112955" e "WCA 117521" invece dei nomi reali perche':
- Il codice crea un placeholder `company_name: "WCA {id}"` quando un partner non esiste ancora nel DB
- Se l'estensione Chrome fallisce l'estrazione, il nome reale non viene mai aggiornato
- I nomi reali esistono gia' nella `directory_cache` ma non vengono usati come fallback

Inoltre, Rangel (65706) e TIBA (24995) hanno `country_code` sbagliato (BR e AR invece di AO).

## Soluzione

### 1. Correzione immediata nel DB (SQL)

Aggiornare i 4 record di Angola con i dati corretti dalla directory_cache:
- WCA 112955 -> "SUPERMARITIME TRANSITARIOS LDA", city "Luanda", country_code "AO"
- WCA 117521 -> "Ranatrans Angola, S.A.", city "Luanda", country_code "AO"
- WCA 65706 -> country_code "AO" (nome gia' corretto)
- WCA 24995 -> country_code "AO" (nome gia' corretto)

### 2. Fallback nome dalla directory_cache nel codice

Modificare `src/hooks/useDownloadProcessor.ts` (riga 106-118) per:
- **Prima di creare un placeholder**, cercare il nome reale nella `directory_cache` per quel `wca_id`
- Se trovato, usare il nome reale dalla cache come `company_name` e la citta'
- Solo se non trovato in cache, usare il placeholder "WCA {id}"

Codice attuale (riga 110-118):
```
} else {
  const { data: newP } = await supabase.from("partners").insert({
    wca_id: wcaId,
    company_name: `WCA ${wcaId}`,
    ...
  })
```

Nuovo codice:
```
} else {
  // Cerca nome reale nella directory_cache
  let realName = `WCA ${wcaId}`;
  let realCity = "";
  const { data: cacheEntries } = await supabase
    .from("directory_cache")
    .select("members")
    .eq("country_code", job.country_code);
  for (const entry of (cacheEntries || [])) {
    const members = entry.members as any[];
    const match = members?.find((m: any) => m.wca_id === wcaId);
    if (match) {
      realName = match.company_name || realName;
      realCity = match.city || "";
      break;
    }
  }
  const { data: newP } = await supabase.from("partners").insert({
    wca_id: wcaId,
    company_name: realName,
    country_code: job.country_code,
    country_name: job.country_name,
    city: realCity,
  }).select("id").single();
  if (newP) partnerId = newP.id;
}
```

### 3. Fallback anche dopo estrazione fallita

Aggiungere un controllo dopo l'estrazione (riga 234-237): se il `company_name` e' ancora un placeholder "WCA {id}" anche dopo l'estrazione, tentare il fallback dalla cache.

### File da modificare

1. **`src/hooks/useDownloadProcessor.ts`**: 
   - Riga 106-118: aggiungere lookup dalla directory_cache prima dell'insert
   - Riga 234-237: aggiungere fallback se il nome resta un placeholder

2. **SQL migration**: correggere i 4 record di Angola esistenti

