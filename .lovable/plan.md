## Piano di fix

1. **Correggere `manage-email-folders` in modo minimo**
   - Rimuovere l’uso di `auth.getClaims()` se presente nella versione corrente deployata.
   - Usare il pattern compatibile già visibile nel file locale: creare un client con `SUPABASE_ANON_KEY` e header `Authorization`, poi chiamare `auth.getUser(token)`.
   - Restituire `401 INVALID_TOKEN` solo se il token utente è assente/non valido, evitando il `500` runtime.

2. **Verificare il token inviato dal frontend**
   - Confermare che `invokeEdge()` continui a usare `supabase.functions.invoke`, così l’access token della sessione viene allegato dal client SDK.
   - Non modificare i chiamanti UI salvo evidenza che inviino un UID errato o un token anonimo.

3. **Validare la funzione dopo la modifica**
   - Deploy/test della sola funzione `manage-email-folders`.
   - Controllare i log della funzione per verificare che non compaia più `anonClient.auth.getClaims is not a function`.
   - Se resta un `401 INVALID_TOKEN`, isolare se arriva da sessione scaduta o da chiamata con anon key, senza toccare `check-inbox`, `email-imap-proxy` o `mark-imap-seen`.

## Nodo critico e impatto

- Nodo critico: **Edge Function auth + operazioni IMAP**.
- Modifica prevista: **locale, reversibile, solo sulla validazione auth della funzione**.
- Nessun refactor, nessuna modifica a download email, invio email, batch, deduplica o pipeline AI.