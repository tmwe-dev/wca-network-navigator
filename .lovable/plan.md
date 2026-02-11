
# Fix: Auto-Login e Validazione Sessione WCA

## Situazione dai Log

I log mostrano chiaramente:
- Il server trova **3 email** ma **0 nomi reali** e **5 "Members only"** -- questo significa che la regex per rilevare i nomi dei contatti e' troppo restrittiva
- L'auto-login continua a postare a `/Home/SetLanguage` (i log sono di prima che il deploy del fix fosse completato)
- Quando tu fai il login manuale, funziona per un po', poi la sessione scade e il server non riesce a rinnovarla

## Correzioni

### 1. Fix regex nomi in `check-wca-session` e `save-wca-cookie`

Il problema: la regex cerca `profile_label">...Name...</div>...profile_val">NOME` ma il formato HTML di WCA potrebbe usare classi diverse o struttura diversa. Se il server vede 3 email ma 0 nomi, significa che le email vengono trovate con un pattern diverso da quello dei nomi.

**Soluzione**: Invece di cercare "Name" nel label, cercare qualsiasi testo non-"Members only" nelle righe di contatto. Se ci sono email valide, la sessione e' autenticata -- non serve che ANCHE i nomi siano visibili.

```
// Vecchia logica (troppo restrittiva):
authenticated = contactsTotal > 0 && contactsWithRealName > 0

// Nuova logica (se vedi email, sei autenticato):
authenticated = contactsTotal > 0 && (contactsWithRealName > 0 || contactsWithEmail > 0)
```

Stesso fix in `save-wca-cookie/index.ts` che ha la stessa logica di verifica.

### 2. Verifica deploy auto-login in `scrape-wca-partners`

Il codice aggiornato (che cerca il form con password input) e' gia' nel file ma i log mostrano che era ancora in esecuzione la versione vecchia. Serve un re-deploy forzato e un test per confermare che il form corretto (`/Account/Login`) viene trovato.

### 3. Aggiungere log del form trovato nell'auto-login

Per diagnosticare meglio, aggiungere un log che mostri tutti i form trovati nella pagina e quale viene selezionato, cosi' se il problema persiste possiamo vedere esattamente cosa succede.

## File da Modificare

1. **`supabase/functions/check-wca-session/index.ts`** (linea 120)
   - Cambiare la condizione `authenticated` per accettare anche `contactsWithEmail > 0`

2. **`supabase/functions/save-wca-cookie/index.ts`** (funzione `testCookieDeep`)
   - Stessa correzione della condizione `authenticated`

3. **`supabase/functions/scrape-wca-partners/index.ts`** (funzione `directWcaLogin`)
   - Aggiungere log diagnostico che elenca tutti i form trovati e le loro action
   - Re-deploy forzato per assicurarsi che il fix precedente sia attivo

## Risultato Atteso

- La sessione WCA viene correttamente rilevata come "attiva" quando le email sono visibili (non solo i nomi)
- L'auto-login server-side posta al form corretto e rinnova la sessione automaticamente
- Il semaforo resta verde e i download procedono senza interruzioni
