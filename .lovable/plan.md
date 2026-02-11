
# Fix Verifica Sessione WCA + Qualita' Contatti

## Problema 1: Check sessione WCA non funziona

Il codice attuale (riga 162-168 di `AcquisizionePartner.tsx`):
```text
await triggerCheck();          // <-- aggiorna il DB in modo asincrono
if (wcaStatus !== "ok") {      // <-- usa il valore VECCHIO di React, non quello appena verificato
  setShowSessionAlert(true);
  return;
}
```

`wcaStatus` viene da `useWcaSessionStatus()` che legge dal DB tramite React Query. Ma dopo `triggerCheck()`, il refetch non ha ancora aggiornato lo state React. Risultato: il controllo usa sempre il valore precedente.

### Fix

Modificare `triggerCheck()` in `useWcaSessionStatus.ts` per **restituire direttamente lo status** dalla risposta dell'edge function, invece di aspettare il refetch React Query. Poi in `AcquisizionePartner.tsx` usare il valore di ritorno:

```text
const result = await triggerCheck();
if (result?.status !== "ok") {
  setShowSessionAlert(true);
  return;
}
```

## Problema 2: Contatti mostrati come "non trovati"

Se lo scraper restituisce contatti con email ma senza telefono diretto/mobile, il semaforo arancione e' corretto. Ma il messaggio "Nessun contatto trovato" appare quando `data.contacts.length === 0`, il che suggerisce che lo scraper potrebbe non estrarre correttamente la lista contatti dall'HTML.

Verificare la logica di parsing in `scrape-wca-partners` per assicurarsi che i contatti "Office Contacts" vengano estratti come array separati con nome, titolo, email.

## Modifiche Pianificate

| File | Modifica |
|------|----------|
| `src/hooks/useWcaSessionStatus.ts` | `triggerCheck()` restituisce `{ status, authenticated }` dalla risposta dell'edge function, poi fa refetch in background |
| `src/pages/AcquisizionePartner.tsx` | Usa il valore di ritorno di `triggerCheck()` per il check sessione invece dello state React stale |
| `supabase/functions/scrape-wca-partners/index.ts` | Verificare e fixare il parsing dei contatti Office (nome, titolo, email) dall'HTML WCA |

## Dettaglio Tecnico

### useWcaSessionStatus.ts - triggerCheck migliorato

```text
const triggerCheck = async (): Promise<{ status: WcaSessionStatus; authenticated: boolean }> => {
  const res = await fetch(url, { method: "POST", ... });
  const data = await res.json();
  // Refetch in background per aggiornare la cache
  statusQuery.refetch();
  return { status: data.status, authenticated: data.authenticated };
};
```

### AcquisizionePartner.tsx - check corretto

```text
const result = await triggerCheck();
if (!result || result.status !== "ok") {
  setShowSessionAlert(true);
  return;
}
```

### scrape-wca-partners - parsing contatti

Verificare che il regex/parser per "Office Contacts" estragga correttamente:
- Nome (es. "Mr. Makis Mavroeidis")
- Titolo (es. "Executive Director")
- Email (es. "makis.mavroeidis@sba-group.net")
- Telefono (dal campo "Phone" dell'azienda, se non c'e' telefono personale)
