
# Fix: Non Scartare l'HTML Scaricato con Cookie

## Il Problema Reale

Il flusso attuale dello scraper e' questo:

1. Scarica la pagina con il cookie di sessione -> ottiene 37.557 caratteri di HTML con i dati dei contatti
2. Conta 4 occorrenze di "Members only" nella pagina (soglia: >2)
3. **SCARTA TUTTO L'HTML** (`html = ''`) e prova l'auto-login
4. Auto-login FALLISCE (il form di WCA ha cambiato struttura)
5. Firecrawl scarica la pagina SENZA autenticazione -> ottiene una versione con meno dati
6. Il parsing viene fatto sulla versione Firecrawl (incompleta)

Il cookie FUNZIONA (check-wca-session lo conferma), ma lo scraper lo ignora perche' ci sono alcune stringhe "Members only" sparse nella pagina. Queste stringhe possono apparire in sezioni secondarie (come i branch office) anche quando i contatti principali sono visibili.

## La Soluzione

Modificare `scrape-wca-partners/index.ts` per:

1. **Non scartare mai l'HTML scaricato con il cookie** - usarlo sempre come fonte primaria
2. Usare Firecrawl SOLO se non c'e' nessun cookie e nessun HTML disponibile
3. Salvare sempre l'HTML completo nel database per ri-parsing futuro con AI

## Modifiche Pianificate

| File | Modifica |
|------|----------|
| `supabase/functions/scrape-wca-partners/index.ts` | Rimuovere la logica che scarta l'HTML quando trova "Members only". Mantenere il direct-fetch come fonte primaria. |

## Dettaglio Tecnico

### Logica attuale (righe 830-843):
```text
if (wcaSessionCookie) {
  const result = await directFetchPage(url, wcaSessionCookie)
  html = result.html
  if (!result.membersOnly) {
    authStatus = 'authenticated'
  } else {
    html = ''  // <-- BUG: scarta 37.557 caratteri di HTML buono!
  }
}
```

### Logica corretta:
```text
if (wcaSessionCookie) {
  const result = await directFetchPage(url, wcaSessionCookie)
  html = result.html  // Mantieni SEMPRE l'HTML scaricato
  if (!result.membersOnly) {
    authStatus = 'authenticated'
  } else {
    authStatus = 'members_only'
    // NON scartare html - contiene comunque dati parziali utili
    // Prova auto-login per ottenere una versione migliore
  }
}
```

Nella sezione auto-login (righe 847-889), sovrascrivere `html` SOLO se l'auto-login riesce e produce una versione migliore (non membersOnly). Se l'auto-login fallisce, si usa comunque l'HTML del direct-fetch con cookie.

Nella sezione Firecrawl (righe 892-926), usare Firecrawl SOLO se `html` e' ancora vuoto (nessun cookie disponibile).

Questo garantisce che:
- L'HTML scaricato con il cookie (che contiene contatti, email, telefoni) non venga mai buttato via
- Firecrawl serve solo come ultima risorsa quando non c'e' nessun cookie
- I dati vengono sempre salvati nel database per ri-parsing futuro
