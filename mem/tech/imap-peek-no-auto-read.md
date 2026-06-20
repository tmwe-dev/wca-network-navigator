---
name: IMAP fetch deve usare sempre BODY.PEEK[]
description: Vietato BODY[] / RFC822 senza PEEK nei fetch IMAP — marca \Seen in automatico
type: constraint
---
Tutti i fetch IMAP di sincronizzazione/ricezione DEVONO usare `BODY.PEEK[...]`,
mai `BODY[...]` o `RFC822` (senza PEEK), perché questi impostano il flag `\Seen`
sul server marcando la mail come letta in automatico al solo download.

Il flag `\Seen` va inviato al server SOLO su azione utente, tramite la edge
function `mark-imap-seen` (chiamata da `useMarkAsRead`).

**Why:** Bug audit 2026-06-20 — `email-imap-proxy/imap-operations.ts`
`imapFetchMessage` usava `UID FETCH (BODY[])` e marcava lette tutte le email
appena sincronizzate. Corretto in `BODY.PEEK[]`.

Riferimenti corretti già conformi: `check-inbox/messageProcessor.ts`,
`check-inbox/bodyExtractor.ts` (tutti BODY.PEEK[]).
