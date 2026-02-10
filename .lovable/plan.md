

# Fix: Login Automatico WCA e Re-processing Contatti

## Problema
Il login automatico nella Edge Function fallisce: il sito WCA restituisce status 200 ma NON emette il cookie `.ASPXAUTH`. Il sistema cade su Firecrawl (non autenticato) e salva i contatti senza email/telefono.

L'HTML grezzo viene comunque salvato, ma contiene dati "Members only" perche' scaricato senza autenticazione.

## Causa Tecnica
Il login ASP.NET di WCA probabilmente:
- Richiede un redirect chain (302) che il fetch non segue correttamente
- Usa `Set-Cookie` in una risposta redirect che viene persa con `redirect: "manual"`
- Oppure il form di login ha campi aggiuntivi oltre a `__VIEWSTATE` e credenziali

## Piano di Correzione

### Passo 1: Debug del login WCA
Aggiungere logging dettagliato nella funzione `directWcaLogin`:
- Stampare tutti i Set-Cookie headers dalla risposta di login
- Verificare se ci sono redirect (status 302)
- Loggare il body della risposta per capire se il login ha successo ma il cookie e' in un redirect successivo

### Passo 2: Fix della funzione `directWcaLogin`
In base ai risultati del debug, possibili fix:
- **Seguire la redirect chain manualmente**: se il cookie viene settato nella risposta 302, fare un secondo fetch sulla URL di redirect
- **Gestire cookie multipli**: il `.ASPXAUTH` potrebbe richiedere anche altri cookie dalla pagina di login (es. `ASP.NET_SessionId`)
- **Combinare tutti i cookie**: inviare tutti i cookie ricevuti (session + auth) nelle richieste successive

### Passo 3: Aggiungere endpoint di re-parse
Dato che l'HTML grezzo e' gia' salvato (anche se senza dati contatti autenticati), aggiungere:
- Un parametro `reparse: true` alla Edge Function `scrape-wca-partners` che ri-scarica il profilo con credenziali valide e aggiorna l'HTML
- Un parametro `aiParse: true` che lancia `parse-profile-ai` automaticamente dopo il salvataggio

### Passo 4: Re-download con autenticazione funzionante
Una volta fixato il login:
- I 18 partner gia' scaricati potranno essere ri-processati senza riscaricare, lanciando `parse-profile-ai` sull'HTML salvato (ma solo se l'HTML salvato contiene i dati — se e' stato scaricato senza auth, conterra' "Members only" e servira' un ri-download)
- I restanti 77 partner del job verranno scaricati con autenticazione corretta

### Passo 5: Fallback manuale cookie
Come piano B, se il login automatico non funziona:
- Aggiungere un campo "WCA Auth Cookie" nelle Impostazioni (diverso dal session cookie attuale)
- L'utente copia il cookie `.ASPXAUTH` dal browser dopo il login manuale
- Lo scraper lo usa direttamente senza tentare il login automatico

## Dettagli Tecnici

### File da modificare:
- **`supabase/functions/scrape-wca-partners/index.ts`**: Fix `directWcaLogin`, migliorare gestione cookie, aggiungere logging
- **`supabase/functions/parse-profile-ai/index.ts`**: Verificare che gestisca correttamente HTML con "Members only" (skip parsing se dati non autenticati)
- **`src/pages/Settings.tsx`** (se serve fallback): Aggiungere campo per cookie manuale `.ASPXAUTH`

### Sequenza:
1. Deploy con logging dettagliato per debug login
2. Analizzare i log per capire il problema esatto
3. Implementare il fix
4. Testare su un singolo ID (es. 86580 Logenix)
5. Se funziona, rilanciare il resync
6. Se il login automatico non funziona, implementare il fallback manuale

