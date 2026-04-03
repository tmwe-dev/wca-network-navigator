

# Piano: Rendere il download email robusto e visibile

## Problemi identificati

1. **Il download sembra fermo**: Quando le email sono duplicate (già nel DB), la funzione ritorna `total: 0` e nessun messaggio. La UI non mostra nulla, il contatore non avanza → sembra bloccato.

2. **Si ferma dopo 3 errori consecutivi**: `MAX_RETRIES = 3` è troppo basso per un sync di 3600+ email. Un timeout di rete o un errore transitorio uccide l'intero processo.

3. **Nessun feedback per i duplicati**: L'utente non vede che il sistema sta saltando email già scaricate — sembra morto.

## Soluzione

### 1. backgroundSync.ts — Resilienza e feedback

- **Aumentare MAX_RETRIES da 3 a 10** con backoff più aggressivo
- **Mostrare progresso anche per duplicati**: Quando `total: 0` ma `has_more: true`, aggiornare il batch counter e mostrare `remaining` nella UI (la funzione già ritorna `remaining`)
- **Aggiungere `skipped` al progress**: Contare le email saltate (duplicate) separatamente
- **Non resettare `consecutiveErrors` solo su success** — resettare anche quando `total: 0` con `has_more: true` (il server ha risposto OK, non è un errore)

### 2. EmailDownloadPage.tsx — Feedback visivo per duplicati

- Mostrare nella barra di stato: "Blocco X — Y scaricate, Z saltate (duplicate), W rimanenti"
- Quando `total: 0` e il sync è attivo, mostrare un indicatore "Scansione in corso..." con il numero rimanente
- Il contatore `remaining` dal server dà il progresso reale

### 3. check-inbox — Fast-forward per duplicati (opzionale ma consigliato)

- Nella edge function, quando un UID viene skippato come duplicato, la funzione già fa `continue` e avanza `maxUid`. Il problema è che ogni duplicato richiede comunque: connessione IMAP → fetch dimensione → fetch raw → SHA-256 → query DB → skip. Sono ~3 secondi buttati per email.
- **Aggiungere un pre-check per imap_uid**: Prima di fare il fetch IMAP, controllare se `imap_uid` + `uidvalidity` esiste già nel DB. Se sì, skip immediato senza toccare IMAP. Questo accelererà enormemente il passaggio attraverso i duplicati.

## File da modificare

| File | Cosa |
|---|---|
| `src/lib/backgroundSync.ts` | Aggiungere `skipped` e `remaining` al progress, aumentare retry, feedback duplicati |
| `src/pages/EmailDownloadPage.tsx` | Mostrare skipped/remaining nella UI, indicatore scansione attivo |
| `supabase/functions/check-inbox/index.ts` | Pre-check `imap_uid` nel DB prima del fetch IMAP per fast-forward duplicati |

## Dettagli tecnici

**Pre-check duplicati nel check-inbox** (riga ~800):
```sql
SELECT id FROM channel_messages 
WHERE imap_uid = $uid AND uidvalidity = $uidvalidity AND user_id = $userId
```
Se esiste → skip immediatamente, aggiorna checkpoint, `continue`. Zero accesso IMAP.

**backgroundSync progress** — aggiungere:
```typescript
interface BgSyncProgress {
  // ...existing
  skipped: number;    // email saltate (duplicate)
  remaining: number;  // dal server
}
```

Quando `result.total === 0` e `has_more === true`:
- Incrementare `skipped`
- Aggiornare `remaining` dal risultato
- Continuare il loop (non è un errore)

