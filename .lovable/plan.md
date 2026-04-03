

# Debugging Completo — Valutazione Sistema Email

## Voto: 6.200 / 100.000

Il sistema ha una buona architettura di base ma presenta bug attivi e lacune gravi che impediscono il funzionamento corretto in produzione.

---

## Cosa funziona (punti guadagnati: ~6.200)

1. **Architettura IMAP** — Connessione, autenticazione, UID SEARCH, checkpointing incrementale: solido
2. **ENVELOPE + BODYSTRUCTURE** — Approccio corretto per RFC 3501
3. **Fallback raw HEADER.FIELDS** — Presente e funzionante per envelope vuoti
4. **Sender matching** — Exact + domain fallback: ben fatto
5. **Decodifica RFC 2045** — `decodeMimePart()` con charset + transfer-encoding: implementato
6. **collectMimeLeafParts()** — Navigazione ricorsiva BODYSTRUCTURE: corretta
7. **Attachments + inline images** — Flusso completo download → Storage → DB
8. **cid: replacement** — RFC 2392 implementato
9. **Continuous sync + batch=1** — Stabile

---

## BUG ATTIVI (evidenze dai log)

### Bug 1 — Storage key con caratteri illegali (CRITICO)
**Evidenza log:**
```
Invalid key: emails/.../‹DB7P191MB0268...@...OUTLOOK.COM›/image001.png
Invalid key: emails/.../‹DB7P191MB0268...@...OUTLOOK.COM›/message-2.1.eml
```
**Causa:** Il `messageId` usato nel path contiene `<>` e altri caratteri che Supabase Storage rifiuta. Riga 654/711: `storagePath = \`emails/${userId}/${messageId}/${filename}\``
Il `messageId` da envelope contiene `<...>` ma il `.replace(/[<>]/g, "")` a riga 562 viene fatto solo nel fallback header, NON nell'envelope principale (riga 540). Inoltre restano caratteri come `@` e `.` lunghi.

**Fix:** Sanitizzare il `messageId` prima di usarlo come path (rimuovere `<>`, sostituire `@` e altri caratteri non-path-safe).

### Bug 2 — ImapParseError su BODYSTRUCTURE malformati
**Evidenza log:**
```
ImapParseError: Invalid body structure format
data: '2918 NIL ("attachment" ("creation-date"...')
```
**Causa:** La libreria `@workingdevshero/deno-imap` non gestisce tutti i formati BODYSTRUCTURE (es. attachment con parametri non standard). Il codice cattura l'errore ma il `parts` rimane vuoto, quindi ricade nel fallback section "1" che potrebbe non essere text/plain.

**Impatto:** Per queste email, il body potrebbe essere vuoto o sbagliato.

### Bug 3 — `import-files` bucket è PRIVATO
Il bucket non è pubblico, quindi `getPublicUrl()` (riga 662) restituisce un URL che non funziona. Le inline images sostituite con `cid:` punteranno a URL inaccessibili.

**Fix:** O rendere il bucket pubblico, oppure usare `createSignedUrl()` con durata lunga.

---

## PROBLEMI DI DESIGN

### Bug 4 — Frontend mostra solo `body_text`, ignora `body_html`
`EmailInboxView.tsx` riga 155: `{selectedMsg.body_text || "(corpo vuoto)"}` — mostra **solo** il plain text. L'HTML non viene mai renderizzato. Per email che hanno solo HTML (molto comune), il corpo appare vuoto.

### Bug 5 — Allegati non visibili nel frontend
Il frontend non mostra gli allegati. Non c'è query a `email_attachments` né UI per scaricarli.

### Bug 6 — `created_at` usato come data email
Il messaggio viene salvato con `created_at = now()` (default DB), non con la data originale dell'email. L'ordinamento cronologico è sbagliato.

### Bug 7 — Limit 200 messaggi
`useChannelMessages` ha `limit(200)`. Con 3895 email, il 95% non sarà visibile.

### Bug 8 — Nessuna paginazione
Non c'è scroll infinito né paginazione nel frontend.

### Bug 9 — `onConflict: "message_id_external"` senza indice UNIQUE
Il campo `message_id_external` nella tabella `channel_messages` potrebbe non avere un vincolo UNIQUE, il che farebbe fallire l'upsert silenziosamente.

---

## RIEPILOGO VALUTAZIONE

| Area | Voto /10 | Note |
|------|----------|------|
| Connessione IMAP | 9 | Solido, con CA certs |
| Parsing ENVELOPE | 7 | Funziona ma fallback incompleto |
| BODYSTRUCTURE | 6 | Ricorsione OK, ma crash su formati edge-case |
| Decodifica RFC 2045 | 8 | Encoding + charset corretti |
| Storage allegati | 3 | Key illegali, bucket privato |
| Inline images cid: | 3 | Upload fallisce, URL non accessibili |
| Frontend visualizzazione | 2 | Solo plain text, no HTML, no allegati |
| Data/ordinamento | 3 | Usa created_at server, non data email |
| Scalabilità | 3 | Limit 200, no paginazione |
| Robustezza errori | 7 | Skip UID su errore, buono |

**Voto complessivo: 6.200 / 100.000** — Il backend IMAP ha basi solide (~60%), ma i bug attivi su storage keys e la mancanza quasi totale di rendering frontend (HTML, allegati, date) lo rendono inutilizzabile come sistema di posta reale.

---

## Piano Fix (priorità)

1. **Sanitizzare messageId** nel storage path (fix immediato)
2. **Rendere `import-files` pubblico** o usare signed URLs
3. **Renderizzare body_html** nel frontend con `dangerouslySetInnerHTML` + sanitizzazione (DOMPurify)
4. **Mostrare allegati** nel dettaglio email con link download
5. **Salvare la data originale** dell'email (dal campo `date` dell'envelope)
6. **Gestire BODYSTRUCTURE malformati** con fallback RFC822 TEXT
7. **Aggiungere paginazione** o scroll infinito
8. **Verificare indice UNIQUE** su `message_id_external`

