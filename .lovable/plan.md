
# Riparazione Sistema Autenticazione WCA

## Problema Identificato

Ho fatto una verifica profonda e ho trovato **3 bug critici interconnessi** che causano il problema:

### Bug 1: Falso Positivo nella Verifica Sessione
La funzione `testCookie` (usata da `check-wca-session` e `save-wca-cookie`) testa il cookie visitando un profilo WCA e cerca email/telefoni nella pagina. Trova `info@pelikantransport.com` e `+355 52 225 510` - ma questi sono i dati PUBBLICI dell'azienda, visibili a tutti. I contatti PERSONALI (es. `gmataj@pelikantransport.com`, Mr. Genc Mataj) sono protetti e mostrano "Members only".

Risultato: il sistema dice "sessione OK" quando in realta' NON lo e'.

### Bug 2: Cookie Incompleto
Il cookie attualmente salvato nel database contiene solo:
- `wca=0ojbnai1zayzuumwfpczdvgj`
- `__RequestVerificationToken=...`

Ma MANCA il cookie fondamentale: **`.ASPXAUTH`** che e' il vero token di autenticazione di ASP.NET. Senza `.ASPXAUTH`, WCA tratta ogni richiesta come anonima.

### Bug 3: Soglia "Members Only" Errata
La funzione `directFetchPage` considera la pagina "parzialmente autenticata" se trova piu' di 2 occorrenze di "Members only". Ma anche con 4-10 occorrenze (tutti i contatti personali nascosti), il sistema prosegue e salva i dati senza nomi/email/telefoni personali.

## Piano di Correzione

### Passo 1: Correggere `testCookie` in tutte le edge functions

Cambiare la logica di verifica da "cerca email generiche nella pagina" a "cerca specificamente i dati protetti dei contatti personali". Il test corretto deve:
- Verificare che i `contactperson_row` contengano nomi reali (non "Members only")
- Cercare la PRESENZA di email personali nei blocchi contatto (non email aziendali nel footer)
- Considerare la sessione valida SOLO se almeno 1 contatto ha nome + email visibili

Questo corregge `check-wca-session`, `save-wca-cookie` e `wca-auto-login`.

### Passo 2: Migliorare `wca-auto-login` per catturare `.ASPXAUTH`

L'auto-login attuale fa il POST di login e raccoglie i cookie di risposta, ma potrebbe non seguire correttamente TUTTI i redirect (WCA fa 2-3 redirect dopo il login). Migliorare:
- Seguire manualmente OGNI redirect raccogliendo i `Set-Cookie` ad ogni step
- Cercare specificamente `.ASPXAUTH` o `.AspNet.ApplicationCookie` nei cookie raccolti
- Se dopo tutti i redirect `.ASPXAUTH` non e' presente, dichiarare il login FALLITO (non simulare successo)
- Aggiungere log dettagliato di ogni cookie ricevuto ad ogni step

### Passo 3: Aggiungere pre-check bloccante nello scraper

Modificare `scrape-wca-partners` per:
- Prima di scaricare qualsiasi profilo, fare un test di autenticazione REALE (non basato su `app_settings.wca_session_status` che e' inaffidabile)
- Se il cookie non contiene `.ASPXAUTH`, tentare immediatamente l'auto-login
- Se l'auto-login fallisce, restituire un errore chiaro invece di procedere con dati incompleti
- MAI salvare contatti vuoti - se un `contactperson_row` ha solo il titolo e nessun nome/email, segnalarlo come errore di autenticazione

### Passo 4: Aggiornare l'estensione Chrome (fallback)

L'estensione Chrome e' l'unico metodo che puo' catturare `.ASPXAUTH` (cookie HttpOnly). Aggiornare `popup.js` per:
- Mostrare nella popup quali cookie specifici sono stati trovati (in particolare `.ASPXAUTH`)
- Se `.ASPXAUTH` manca, avvisare l'utente di rifare il login su wcaworld.com
- Aggiornare il `manifest.json` con i permessi corretti (gia' fatto)

### Passo 5: Aggiungere diagnostica nella pagina Download Management

Nella pagina di download, mostrare:
- Quale cookie e' in uso (con/senza `.ASPXAUTH`)
- Risultato dell'ultimo test di autenticazione REALE
- Un pulsante "Tenta Auto-Login" che mostra i log dettagliati

## File da modificare

| File | Modifica |
|------|----------|
| `supabase/functions/check-wca-session/index.ts` | Riscrivere `testCookie` per verificare contatti personali, non email pubbliche |
| `supabase/functions/save-wca-cookie/index.ts` | Stesso fix per `testCookie` + verificare presenza `.ASPXAUTH` |
| `supabase/functions/wca-auto-login/index.ts` | Seguire tutti i redirect, cercare `.ASPXAUTH`, log dettagliato |
| `supabase/functions/scrape-wca-partners/index.ts` | Pre-check autenticazione reale, bloccare download se non autenticato, non salvare contatti vuoti |
| `src/components/download/WcaSessionIndicator.tsx` | Mostrare dettagli cookie (con/senza .ASPXAUTH) |

## Sequenza di esecuzione

1. Fix `testCookie` in tutte e 3 le edge functions (check, save, auto-login)
2. Migliorare `wca-auto-login` per catturare `.ASPXAUTH`
3. Aggiungere pre-check bloccante in `scrape-wca-partners`
4. Deploy e test automatico su Pelikan (ID 69664)
5. Aggiornare UI diagnostica
