

# Piano: Fix Autenticazione WCA e Pipeline Completa

## Problema centrale
Il login automatico HTTP non funziona. I download girano per ore salvando dati senza email/telefoni. Questo vanifica l'intero scopo dello scraping.

## Soluzione in 3 parti

### Parte 1: Verifica pre-download (STOP immediato se non autenticati)

Modificare la Edge Function `process-download-job` per fare un **test di autenticazione** prima di iniziare il processing. Se il test fallisce (pagina con "Members only"), il job si mette automaticamente in **pausa** e notifica l'utente.

Logica:
- Al primo ID del job, controlla se il risultato contiene email/contatti reali
- Se vede "Members only", setta `status = 'paused'` e `error_message = 'Sessione WCA scaduta - aggiorna il cookie nelle Impostazioni'`
- Il job NON prosegue a scaricare dati inutili per ore

File: `supabase/functions/process-download-job/index.ts`

### Parte 2: Fix del login automatico con debug approfondito

Riscrivere `directWcaLogin` con una strategia piu' robusta:
- Seguire TUTTI i redirect (anche multipli) collezionando ogni cookie
- Testare immediatamente il login facendo un fetch di un profilo noto e verificando se "Members only" e' assente
- Se il login HTTP non funziona, loggare esattamente cosa succede (status, cookie names, body snippet) per capire il meccanismo

Se il login HTTP continua a fallire (cosa probabile con ASP.NET moderno), il sistema passa automaticamente al cookie manuale con un messaggio chiaro.

File: `supabase/functions/scrape-wca-partners/index.ts`

### Parte 3: Semaforo WCA nella sidebar + check automatico

Creare il sistema di monitoraggio sessione gia' discusso:

1. **Nuova Edge Function `check-wca-session`**: fa un fetch di un profilo WCA noto (ID 86580) con il cookie salvato. Se vede dati reali restituisce `authenticated: true`, altrimenti `false`. Salva il risultato in `app_settings`.

2. **Hook `useWcaSessionStatus`**: polling ogni 5 minuti, espone lo stato della sessione.

3. **Indicatore nella sidebar**: pallino verde/rosso che mostra a colpo d'occhio se sei loggato. Cliccando sul rosso vai alle Impostazioni.

File nuovi:
- `supabase/functions/check-wca-session/index.ts`
- `src/hooks/useWcaSessionStatus.ts`

File da modificare:
- `src/components/layout/AppSidebar.tsx` - aggiungere indicatore
- `supabase/config.toml` - registrare `check-wca-session`

## Dettagli tecnici

### Check pre-download in `process-download-job`
```text
Al primo ID (current_index === 0):
  1. Chiama scrape-wca-partners con preview=true
  2. Se authStatus !== 'authenticated':
     - Setta job.status = 'paused'
     - Setta job.error_message = 'Cookie WCA scaduto'
     - NON proseguire
  3. Se authStatus === 'authenticated':
     - Prosegui normalmente
```

### Edge Function `check-wca-session`
```text
1. Leggi wca_session_cookie e wca_auth_cookie da app_settings
2. Se nessun cookie: return { authenticated: false, reason: 'no_cookie' }
3. Fetch https://www.wcaworld.com/directory/members/86580 con il cookie
4. Conta occorrenze "Members only" nel body
5. Se < 3 occorrenze: authenticated = true
6. Aggiorna app_settings: wca_session_status = 'ok'/'expired', wca_session_checked_at = now()
7. Return { authenticated, checkedAt, reason }
```

### Indicatore sidebar
```text
Footer della sidebar:
- Verde: "WCA Connesso" (sessione attiva)
- Rosso: "WCA Scaduto" con link a /settings (sessione scaduta)
- Grigio: "Verifica..." (check in corso)
In modalita' collapsed: solo pallino colorato con tooltip
```

### Sequenza di implementazione
1. Creare `check-wca-session` Edge Function
2. Creare `useWcaSessionStatus` hook
3. Aggiungere indicatore in `AppSidebar`
4. Modificare `process-download-job` per il check pre-download
5. Migliorare il debug logging in `directWcaLogin`
6. Deploy e test con WCA ID 86580

### Risultato atteso
- Non si perdono piu' ore a scaricare dati vuoti
- Il semaforo in sidebar mostra sempre se sei loggato
- Se il cookie scade durante un download, il job si ferma da solo
- Il login automatico viene migliorato ma con fallback chiaro al cookie manuale

