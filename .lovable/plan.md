

# Bottone "Login Automatico via Proxy" nella pagina Impostazioni

## Cosa cambia

Aggiungere un bottone nella sezione "Cookie di Sessione WCA" della pagina Impostazioni che:
1. Si connette al proxy locale (`localhost:8001`)
2. Fa login automatico con le credenziali WCA gia salvate in pagina
3. Recupera il cookie `.ASPXAUTH`
4. Lo salva nel database come `wca_session_cookie`
5. Triggera la verifica sessione (semaforo)

Cosi non serve piu copiare manualmente il cookie dal browser.

## Comportamento

- Il bottone appare nella card "Cookie di Sessione WCA", sopra il campo textarea
- Se il proxy non e raggiungibile, il bottone mostra un avviso
- Se username/password non sono compilati, il bottone e disabilitato
- Flusso: Login via proxy -> Ottieni cookie -> Salva nel DB -> Verifica sessione
- Mostra spinner durante l'operazione e toast di successo/errore

## Dettagli tecnici

**File modificato:** `src/pages/Settings.tsx`

Modifiche:
- Importare `useWCA` dal hook esistente
- Aggiungere una funzione `handleAutoLogin` che:
  1. Chiama `wca.login(wcaUsername, wcaPassword)` per autenticarsi via proxy
  2. Chiama `wca.getCookie()` per ottenere il valore `.ASPXAUTH`
  3. Salva il cookie nel DB con `updateSetting.mutateAsync({ key: "wca_session_cookie", value: cookie })`
  4. Aggiorna lo stato locale `setWcaCookie(cookie)`
  5. Chiama `triggerCheck()` per aggiornare il semaforo
- Aggiungere il bottone "Ottieni Cookie Automaticamente" con icona `Wifi` nella card del cookie, con stati:
  - Disabilitato se mancano username o password
  - Spinner durante il caricamento
  - Indicatore proxy online/offline (pallino verde/rosso)
- Gestione errori: se il proxy e offline, mostra toast con istruzioni per avviarlo

