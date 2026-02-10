

# Piano: Creare lo script `wca-auth-proxy.py`

Dato che hai gia installato Python e `requests`, il prossimo passo e creare lo script proxy locale. Siccome Lovable non puo scrivere file sul tuo desktop, ti forniro il codice completo da copiare.

## Cosa faremo

1. **Ti daro lo script Python completo** da salvare come `~/Desktop/mixer/wca-auth-proxy.py`
2. **Lo avvii** con `python3 wca-auth-proxy.py`
3. **Vai su /wca** nel frontend per testare la connessione

## Lo script include

- Server HTTP locale su porta 8001 con CORS
- Login automatico su wcaworld.com (gestisce il token ASP.NET)
- Cookie manuale come fallback
- Proxy per scaricare pagine WCA autenticate
- Tutti e 7 gli endpoint che il frontend si aspetta (`/api/status`, `/api/auth`, `/api/set-cookie`, `/api/cookie`, `/api/proxy`, `/api/logout`)

## Sequenza

1. Copiare lo script nella cartella `~/Desktop/mixer/`
2. Eseguire `python3 wca-auth-proxy.py`
3. Aprire `/wca` nel browser
4. Verificare che il pallino proxy diventi verde
5. Testare il login con le credenziali WCA

## Sezione tecnica

Lo script usa `http.server` (standard library) + `requests` per:
- GET alla pagina login WCA per estrarre `__RequestVerificationToken` dal form HTML
- POST con token + credenziali per ottenere `.ASPXAUTH`
- `requests.Session()` per mantenere i cookie tra le richieste
- Proxy pass-through con il cookie autenticato
- Ritorna 401 se la sessione scade (il frontend fa auto re-auth)

