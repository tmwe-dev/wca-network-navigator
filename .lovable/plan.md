

# Piano 100.000/100.000 — Sistema Email RFC-Compliant

## Stato attuale: 68.000 — Gap: 32.000 punti

Le tue linee guida sono eccellenti e descrivono esattamente lo standard che manca. Tuttavia, dobbiamo lavorare entro i vincoli reali: Edge Function Deno con limite CPU 2s, nessun backend persistente, libreria IMAP `@workingdevshero/deno-imap`. Il sistema non potrà implementare TUTTO il capitolato (es. IDLE, CONDSTORE, QRESYNC, OAuth SASL non supportati dalla libreria), ma possiamo raggiungere il massimo possibile entro questi vincoli.

---

## Fase 1 — Raw Source Storage (RFC 5322 immutabile) [+8.000 punti]

Il cuore mancante: **salvare il messaggio raw completo** come fonte di verità.

- Aggiungere fetch `UID FETCH {uid} (BODY.PEEK[])` per ottenere l'intero RFC 5322
- Salvare il raw in Storage (`import-files/raw-emails/{userId}/{uid}.eml`)
- Calcolare SHA-256 del raw
- Aggiungere colonne al DB: `raw_storage_path`, `raw_sha256`, `raw_size_bytes`, `imap_uid`, `uidvalidity`
- Il raw diventa la fonte immutabile; il parsing strutturato è derivato

## Fase 2 — MIME Parser Robusto (RFC 2046/2045/2231/6532) [+6.000 punti]

Sostituire il parsing parziale con un approccio a due livelli:

- **Livello 1**: BODYSTRUCTURE per navigazione veloce (già implementato)
- **Livello 2**: Se BODYSTRUCTURE fallisce, parsare il raw RFC822 completo con un parser MIME ricorsivo che:
  - Gestisce multipart/mixed, alternative, related annidati a qualsiasi profondità
  - Decodifica RFC 2231 per filename con parametri estesi (`filename*=utf-8''...`)
  - Gestisce message/rfc822 annidati
  - Preserva l'albero MIME completo (non solo leaf parts)
  - Classifica correttamente inline vs attachment usando Content-Disposition + Content-ID

## Fase 3 — Immagini Inline Perfette (RFC 2387 + cid:) [+4.000 punti]

Migliorare la gestione attuale:

- Per immagini piccole (<50KB): usare data URI direttamente nell'HTML (`data:image/png;base64,...`) — zero dipendenza da Storage
- Per immagini grandi: upload a Storage (bucket già pubblico) + cid: replacement
- Supportare tutti i formati: PNG, JPEG, GIF, SVG, WebP, BMP, TIFF
- Gestire il caso in cui Content-ID è presente ma senza `cid:` reference nell'HTML (mostrare come allegato)
- Gestire immagini referenziate da `<img src="cid:...">` E da `background: url(cid:...)` nel CSS inline

## Fase 4 — Frontend Viewer Fedele (Due viste) [+6.000 punti]

Come richiesto dalle linee guida: separare vista fedele e vista sicura.

### Vista A — Original Faithful View
- Iframe completamente sandboxed (`sandbox="allow-same-origin"`)
- HTML originale con solo sostituzione cid: → URL reali
- Nessuna sanitizzazione DOMPurify (solo nell'iframe isolato)
- Preserva layout, stili inline, tabelle, VML, font, colori originali
- Toggle per caricare/bloccare immagini remote e tracking pixel

### Vista B — Safe Normalized View (default)
- DOMPurify con whitelist rigorosa (attuale, migliorato)
- Background bianco forzato, testo scuro, link evidenziati
- Blocco contenuti pericolosi (script, form, JS, active content)

### Miglioramenti UI
- Anteprima allegati (thumbnail per immagini)
- Download allegati con nome originale decodificato RFC 2231
- Indicatore visivo immagini inline vs allegati
- Header completi visibili (From, To, CC, BCC, Date, Message-ID, In-Reply-To)

## Fase 5 — Deduplica e Integrità (RFC 5322 Message-ID + SHA-256) [+3.000 punti]

- Deduplica su combinazione: `raw_sha256` + `message_id_external` + `raw_size_bytes`
- Se stesso SHA-256: skip (già salvato)
- Se diverso SHA ma stesso Message-ID: salvare come variante con flag `is_variant`
- UNIQUE index su `message_id_external` per user (già parzialmente implementato)
- Event log per ogni operazione di sync

## Fase 6 — Sync Robusto e Metadati Server [+3.000 punti]

- Salvare UIDVALIDITY per rilevare cambio mailbox (invalidazione sync)
- Salvare INTERNALDATE dal server (non solo envelope date)
- Salvare RFC822.SIZE
- Salvare flags IMAP (\Seen, \Flagged, etc.)
- Gestire resume dopo crash (già funziona con checkpoint)
- Aggiungere retry con backoff esponenziale per errori di rete

## Fase 7 — Sicurezza e Audit [+2.000 punti]

- Bloccare script, form action, event handler nell'HTML email
- Bloccare remote JS e active content
- Immagini remote: mostrare placeholder con opzione "carica immagini"
- Logging strutturato con metriche: parse_status, defect_flags, warnings
- Audit trail: imported_at, parse_version per ogni messaggio

---

## Modifiche tecniche concrete

### Database (migrazione)
```text
channel_messages:
  + raw_storage_path text
  + raw_sha256 text  
  + raw_size_bytes integer
  + imap_uid integer
  + uidvalidity integer
  + imap_flags text
  + internal_date timestamptz
  + parse_status text DEFAULT 'ok'
  + parse_warnings text[]
```

### Edge Function (`check-inbox/index.ts`)
- Ristrutturazione in sezioni logiche (il file resta unico per vincolo Edge Function)
- Aggiungere fetch raw completo → upload Storage → SHA-256
- Migliorare parser MIME fallback con RFC 2231
- Data URI per inline images piccole
- Salvare metadati server aggiuntivi

### Frontend
- `EmailDetailView.tsx`: aggiungere toggle vista fedele/sicura
- `EmailHtmlFrame`: due modalità rendering
- Blocco immagini remote con placeholder
- Header espandibili completi

### File stimati da modificare
1. `supabase/functions/check-inbox/index.ts` — riscrittura parziale (~400 righe modificate)
2. `src/components/outreach/EmailDetailView.tsx` — refactor vista duale
3. `src/hooks/useChannelMessages.ts` — aggiungere campi nuovi al tipo
4. `src/components/outreach/EmailMessageList.tsx` — minor miglioramenti
5. Migrazione DB per nuove colonne

---

## Cosa NON è possibile nei vincoli attuali

Per trasparenza, queste feature del capitolato non sono implementabili:

- **IMAP IDLE / CONDSTORE / QRESYNC**: la libreria Deno IMAP non li supporta
- **OAuth/SASL**: richiede registrazione app con provider, non è un fix di codice
- **Multi-mailbox**: richiederebbe un redesign del sync loop
- **SMTP/Invio**: richiede un connettore SMTP separato (fase futura)
- **Cifratura raw a riposo**: Supabase Storage non supporta encryption at-rest personalizzata
- **Antivirus/scanning allegati**: non disponibile nel runtime Edge Function

Con queste limitazioni note, il punteggio massimo raggiungibile è ~95.000/100.000. I 5.000 rimanenti richiedono infrastruttura esterna.

