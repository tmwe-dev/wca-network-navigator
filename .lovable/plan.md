

# Fix Bug Email e WhatsApp — Piano di Implementazione

## Situazione

Il DB ha già l'indice UNIQUE su `message_id_external` (migration `20260402071555`). Restano da fixare i file di codice.

## Modifiche

### 1. `supabase/functions/check-inbox/index.ts` — Fix IMAP + upsert

- **Rimuovere `node:tls`** e usare `Deno.connectTls()` nativo (funziona con certificati CA validi)
- L'host di default è già `imaps.aruba.it` (riga 150) — il secret `IMAP_HOST` va aggiornato dall'utente se punta ancora a `mx01.vmteca.net`
- **Riga 270**: `.insert(messages)` → `.upsert(messages, { onConflict: "message_id_external" })`
- **Righe 283-293**: Rimuovere il blocco morto `interaction_count: undefined` e sostituire con `supabase.rpc("increment_contact_interaction", { p_contact_id: msg.source_id })` solo per `source_type === "imported_contact"`

### 2. `src/hooks/useWhatsAppInbox.ts` — Fix mapping campi + hash

- **Riga 55**: `msg.text` → `msg.lastMessage || msg.text` (il background.js restituisce `lastMessage`)
- **Riga 43**: `msg.timestamp` → `msg.time` (il background.js restituisce `time`)
- **Hash**: Sostituire la funzione `hashMessage` a 32-bit con concatenazione diretta `wa_${contact}_${timestamp}_${text.slice(0,50)}` (più robusto, nessuna collisione)

### 3. `public/whatsapp-extension/manifest.json` — Compatibilità iframe

- Aggiungere `"match_about_blank": true` e `"match_origin_as_fallback": true` ai `content_scripts`
- Aggiungere `"all_frames": true` (già presente, verificare)

### 4. Secret `IMAP_HOST`

- Chiedere all'utente di verificare/aggiornare il secret `IMAP_HOST` a `imaps.aruba.it`

## File coinvolti

| File | Modifica |
|------|----------|
| `supabase/functions/check-inbox/index.ts` | Riscrivere `imapConnect` con `Deno.connectTls`, insert→upsert, fix interaction_count |
| `src/hooks/useWhatsAppInbox.ts` | Fix `msg.lastMessage`, `msg.time`, hash robusto |
| `public/whatsapp-extension/manifest.json` | `match_about_blank`, `match_origin_as_fallback` |

