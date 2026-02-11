
# Un Solo Click: L'Estensione fa Login + Sync Automaticamente

## Il Problema Attuale
L'estensione Chrome legge solo i cookie, ma non fa il login. Quindi se non sei gia' loggato su wcaworld.com, non trova `.ASPXAUTH` e si pianta. Inutile.

## La Soluzione
Trasformare l'estensione Chrome in un sistema **completamente automatico**:

**1 click = login + cattura cookie + invio al server + verifica**

L'utente clicca un solo bottone ("Connetti WCA") e l'estensione:
1. Apre wcaworld.com/Account/Login in background
2. Compila automaticamente username e password (presi dal server)
3. Clicca "Login"
4. Aspetta che il login finisca
5. Legge TUTTI i cookie (incluso .ASPXAUTH)
6. Li invia al server
7. Mostra il risultato: verde = OK, rosso = errore

## Anche la Pagina Impostazioni Diventa Semplice

Nella tab WCA: un solo bottone grande "Connetti WCA" che:
- Se l'estensione e' installata: lancia il login automatico
- Bottone "Verifica Sessione" sotto, piu' piccolo
- Tutto il resto (cookie manuale, diagnostica tecnica) nascosto in un "Avanzate" collassato

---

## Dettagli Tecnici

### File da modificare

| File | Cosa cambia |
|------|-------------|
| `public/chrome-extension/manifest.json` | Aggiungere permessi `tabs`, `scripting`, `activeTab` per poter aprire tab e iniettare script |
| `public/chrome-extension/popup.js` | Riscrivere: un bottone che fa login automatico + sync in un colpo solo |
| `public/chrome-extension/popup.html` | Semplificare: un solo bottone grande, stato chiaro |
| `src/pages/Settings.tsx` | Semplificare tab WCA: un bottone "Connetti WCA", nascondere complessita' |

### Flusso tecnico dell'estensione

1. Click su "Connetti WCA"
2. `chrome.tabs.create({ url: "https://www.wcaworld.com/Account/Login", active: false })` - apre tab in background
3. Quando la pagina carica, inietta uno script con `chrome.scripting.executeScript` che:
   - Cerca i campi username/password nella pagina
   - Li compila con le credenziali (recuperate dal server tramite una edge function dedicata)
   - Submittisce il form
4. Listener su `chrome.tabs.onUpdated` aspetta il redirect post-login
5. Dopo il redirect: `chrome.cookies.getAll({ domain: "www.wcaworld.com" })` - legge tutti i cookie
6. Invia al server tramite `save-wca-cookie`
7. Chiude la tab di login
8. Mostra risultato nella popup

### Nuova Edge Function: `get-wca-credentials`

Serve una piccola edge function che restituisce username/password WCA salvati in `app_settings`, cosi' l'estensione non ha le credenziali hardcoded.

### Modifiche alla pagina Settings

La tab WCA diventa:
- Un bottone grande "Connetti WCA" con istruzioni semplici
- Stato sessione (verde/rosso) ben visibile
- Sezione "Avanzate" collassata per cookie manuale e diagnostica
- Rimozione di bottoni ridondanti e testo tecnico
