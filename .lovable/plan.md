

# Sistema di Login Automatico WCA (Server-Side)

## Situazione attuale
Il sistema ha gia' un meccanismo di auto-login server-side nella funzione `scrape-wca-partners` che funziona: legge username/password dal database, fa login direttamente su wcaworld.com e salva il cookie. Ma la funzione `check-wca-session` NON usa questo meccanismo -- si limita a verificare il cookie esistente senza mai provare a rinnovarlo.

## Cosa cambia
Eliminiamo completamente la dipendenza dal proxy locale. Il login avviene tutto lato server (nelle funzioni backend), senza bisogno di software sul computer.

## Modifiche

### 1. Funzione backend `check-wca-session`
Aggiungere la logica di auto-login: quando il cookie e' scaduto, la funzione prova automaticamente a fare login con le credenziali salvate (username/password), ottiene un cookie fresco e lo salva nel database. Usa lo stesso codice di `directWcaLogin` gia' presente in `scrape-wca-partners`.

### 2. Pagina Impostazioni (`Settings.tsx`)
- Il bottone "Ottieni Cookie Automaticamente" ora chiama direttamente la funzione backend `check-wca-session` (che fara' auto-login server-side), senza passare dal proxy locale
- Rimuovere tutta la logica del proxy (`useWCA`, stato proxy online/offline)
- Rimuovere il banner "apri in nuova scheda" e la guida proxy
- Semplificare l'interfaccia: basta salvare username e password, poi cliccare un bottone "Verifica e Connetti" che fa tutto automaticamente lato server

### 3. Componente `ProxySetupGuide.tsx`
Sostituire completamente: invece di istruzioni su come avviare il proxy, mostrare semplicemente lo stato della connessione WCA (verde/rosso) e un bottone per forzare il rinnovo della sessione.

## Dettagli tecnici

### Funzione `check-wca-session` (aggiornata)
```text
1. Legge il cookie dal database
2. Verifica se funziona (fetch pagina test)
3. Se il cookie e' scaduto:
   a. Legge username/password dal database
   b. Fa login HTTP diretto su wcaworld.com (come gia' fa scrape-wca-partners)
   c. Salva il nuovo cookie nel database
   d. Aggiorna lo stato a "ok"
4. Restituisce il risultato
```

### Pagina Settings (semplificata)
```text
- Card credenziali: username + password + bottone "Salva"
- Card stato sessione: semaforo verde/rosso + bottone "Verifica e Rinnova Sessione"
  - Cliccando il bottone, chiama check-wca-session che fa tutto automaticamente
- Card cookie manuale: campo testo per incollare cookie manualmente (come fallback)
- Card WhatsApp: invariata
```

### File modificati
- `supabase/functions/check-wca-session/index.ts` -- aggiungere auto-login
- `src/pages/Settings.tsx` -- rimuovere logica proxy, semplificare UI
- `src/components/settings/ProxySetupGuide.tsx` -- sostituire con stato connessione

### File NON modificati
- `supabase/functions/scrape-wca-partners/index.ts` -- resta invariato
- `src/hooks/useWCA.ts` -- resta (usato altrove?) ma non piu' necessario in Settings

