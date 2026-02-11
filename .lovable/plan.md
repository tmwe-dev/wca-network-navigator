

# Fix: Auto-Login Server-Side - Approccio Robusto

## Problema Attuale

I log mostrano che:
1. Il deploy del fix e' avvenuto DOPO che la pipeline era gia' finita -- il nuovo codice non e' stato ancora testato
2. Il form di login WCA contiene campi `usr` (text) e `pwd` (password) ma il regex li associa al form sbagliato (`/Home/SetLanguage`)
3. La regex non-greedy `([\s\S]*?)</form>` potrebbe fallire se il form di login WCA non e' chiuso correttamente o ha form annidati

## Soluzione: Approccio Diretto Senza Dipendenza dai Tag Form

Invece di cercare di isolare il tag `<form>` corretto (fragile con HTML mal formato), usare un approccio diretto:

1. **Trovare l'action corretta**: cercare qualsiasi `action` che contiene "Login" o "Account" nella pagina
2. **Usare i campi gia' rilevati**: i log mostrano che `usr` e `pwd` vengono gia' trovati correttamente -- usarli direttamente
3. **Estrarre il token CSRF**: cercare `__RequestVerificationToken` nel form piu' vicino al campo password

### File: `supabase/functions/scrape-wca-partners/index.ts`

Riscrivere `directWcaLogin` per:

```
// 1. Cercare action con "Login" o "Account" nell'intera pagina
const loginActionMatch = loginPageHtml.match(/action\s*=\s*"([^"]*(?:Login|Account)[^"]*)"/i)
const loginAction = loginActionMatch?.[1] || '/Account/Login'

// 2. Usare i campi usr/pwd gia' rilevati (o fallback a UserName/Password)
// 3. Cercare __RequestVerificationToken piu' vicino al campo password
```

Questo elimina completamente la dipendenza dal parsing dei tag `<form>` che e' la causa di tutti i fallimenti.

### Aggiungere anche: fallback all'estensione se auto-login fallisce

Se l'auto-login server-side fallisce (nessun `.ASPXAUTH` nel response), il sistema deve continuare comunque con i dati parziali dal server + dati completi dall'estensione Chrome, senza bloccare la pipeline.

## Dettagli Tecnici

### Modifiche in `supabase/functions/scrape-wca-partners/index.ts`

Funzione `directWcaLogin` (~riga 530-650):
- Rimuovere la logica di parsing dei form con regex
- Cercare direttamente `action="...Login..."` o `action="...Account..."` nell'HTML
- Usare i nomi campi `usr`/`pwd` (rilevati dai log) con fallback a `UserName`/`Password`
- Cercare `__RequestVerificationToken` value nell'intera pagina (c'e' un solo token nella pagina)
- Aggiungere log chiaro: `Direct login: POSTing to ${loginAction} with fields usr+pwd`

### Risultato Atteso
- Il POST va a `/Account/Login` (o qualsiasi URL contenga "Login")
- I campi `usr`+`pwd` vengono inviati correttamente
- Il cookie `.ASPXAUTH` viene restituito nel response
- I download successivi usano la sessione autenticata per estrarre email/telefoni

