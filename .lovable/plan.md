
# Fix: Sessione WCA invalidata dal server + scraper cieco

## Causa radice trovata

Due cose uccidono la sessione:

### 1. `check-wca-session` fa richieste dal server con il cookie del browser

Ogni volta che il semaforo controlla lo stato, la Edge Function fa una richiesta HTTP a `wcaworld.com/directory/members/86580` usando il cookie salvato. Questa richiesta arriva dall'IP del server (non dal browser dell'utente). WCA vede lo stesso cookie usato da due IP diversi e invalida la sessione.

**Soluzione**: eliminare il test HTTP dal `check-wca-session`. Il semaforo deve basarsi SOLO sui dati gia' nel database (ultimo check, presenza del cookie, risultati recenti dei job) — senza MAI toccare WCA dal server.

### 2. Lo scraper non rileva la sessione morta

Dai log di adesso:
```
ID 88149: contactBlocks=0, html=23460c -> "AUTH OK"
ID 142034: contactBlocks=0, html=23462c -> "AUTH OK"  
ID 92928: contactBlocks=0, html=23460c -> "AUTH OK"
ID 131527: contactBlocks=0, html=23462c -> "AUTH OK"
(tutti identici...)
```

TUTTI i profili restituiscono esattamente ~23460 byte e 0 contatti. E' chiaramente una pagina generica. Lo scraper li salta tutti dicendo "membro senza contatti" — ma sono TUTTI senza contatti, il che e' impossibile.

**Soluzione**: aggiungere un contatore di profili consecutivi senza contatti. Se X profili di fila (es: 5) hanno tutti 0 contact blocks, mettere il job in pausa con errore "possibile sessione scaduta". Inoltre, controllare se la dimensione HTML e' sempre identica (segno di pagina cached/generica).

## Modifiche

### File 1: `supabase/functions/check-wca-session/index.ts`

Rimuovere completamente la chiamata HTTP a WCA (`testCookieDeep`). Il controllo diventa:
- Legge `wca_auth_cookie` / `wca_session_cookie` da `app_settings`
- Verifica se `.ASPXAUTH` e' presente nel cookie (senza fare richieste HTTP)
- Legge i risultati recenti dei job (contatti trovati/mancanti) per stimare lo stato
- NON tocca mai wcaworld.com

### File 2: `supabase/functions/scrape-wca-partners/index.ts`

Nessuna modifica diretta al singolo fetch. La logica di rilevamento resta com'e'.

### File 3: `supabase/functions/process-download-job/index.ts`

Aggiungere un contatore di "profili consecutivi senza contatti":
- Se 5 profili consecutivi restituiscono 0 contact blocks, mettere il job in pausa
- Messaggio: "5 profili consecutivi senza contatti — possibile sessione scaduta"
- Salvare il contatore nel campo `error_message` per il frontend
- Quando un profilo HA contatti, azzerare il contatore

### File 4: `supabase/functions/wca-auto-login/index.ts`

Nessuna modifica — gia' non viene chiamato automaticamente.

## Risultato atteso

- Il server NON fa piu' richieste a WCA (niente piu' invalidazione sessione)
- Se la sessione scade naturalmente, il job si ferma dopo max 5 profili vuoti
- L'utente viene avvisato e puo' ri-sincronizzare il cookie con l'estensione Chrome
- Il download riprende da dove si era fermato

## File modificati

| File | Modifica |
|------|----------|
| `supabase/functions/check-wca-session/index.ts` | Rimuovere fetch HTTP a WCA, basarsi solo su dati DB |
| `supabase/functions/process-download-job/index.ts` | Contatore profili vuoti consecutivi, pausa automatica dopo 5 |
