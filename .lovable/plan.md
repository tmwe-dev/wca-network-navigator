

## Diagnosi: 3 problemi distinti in Operations

### Problema 1: Alias genera "0 aziende, undefined contatti"

**Causa**: L'edge function `generate-aliases` filtra con `.is("company_alias", null)`. Se l'alias azienda e' gia' stato generato in precedenza, quei partner vengono esclusi anche se i contatti non hanno ancora alias. Inoltre il client chiama separatamente per "company" e "contact" ma la funzione li genera sempre insieme -- il parametro `type` viene ignorato.

**Fix**:
- Modificare la query dell'edge function per includere partner dove `company_alias IS NULL` OPPURE che hanno almeno un contatto senza `contact_alias`
- Cambiare il client (`Operations.tsx` linea 128-146 e `PartnerListPanel.tsx` linea 533 e 607-613) per chiamare la funzione una sola volta con entrambi i tipi (non separatamente)
- Aggiungere `undefined` safety nel toast: `data.contacts ?? 0`

### Problema 2: Contatori top bar non sincronizzati con selezione paese

**Causa**: Le `StatPill` in `Operations.tsx` (linee 173-186) mostrano sempre `globalStats` (somma di TUTTI i paesi), non i dati dei paesi selezionati. Quando selezioni Thailandia, i numeri in alto restano globali.

**Fix**:
- Quando `selectedCountries.length > 0`, calcolare i pill values aggregando solo i paesi selezionati da `countryStatsData.byCountry` anziche' usare `countryStatsData.global`

### Problema 3: "Sessione WCA non attiva" -- download non parte

**Causa**: `ensureSession()` in `useWcaSession.ts` chiama `verifySession()` dall'extension bridge. Se l'estensione non risponde in tempo o la sessione e' scaduta, tenta l'auto-login. Ma `fetchWcaCredentials()` potrebbe fallire silenziosamente (token scaduto, errore di rete). Il toast "Sessione WCA non attiva" appare senza dettagli su quale step e' fallito.

**Fix**:
- In `useWcaSession.ts`: aggiungere log dettagliati per ogni step del flusso (extension check, session verify, credential fetch, auto-login attempt)
- Mostrare toast piu' specifici: "Estensione non trovata", "Credenziali non configurate", "Auto-login fallito" anziche' generico "non attiva"
- In `handleStartDownload` (PartnerListPanel linea 272-276): mostrare `lastError` dalla sessione se disponibile

### File da modificare

1. `supabase/functions/generate-aliases/index.ts` -- query inclusiva (company OR contact alias mancante)
2. `src/pages/Operations.tsx` -- stat pills contestuali ai paesi selezionati
3. `src/components/operations/PartnerListPanel.tsx` -- unificare chiamata alias, migliorare errore download
4. `src/hooks/useWcaSession.ts` -- toast specifici per ogni step di fallimento

