# Backfill IMAP manuale per regole su address/gruppo

## Obiettivo
Permettere di applicare le regole IMAP esistenti (`mark_read`, `archive`, `move_to_folder`, `spam`) ai messaggi STORICI presenti nella inbox del server, in modo **manuale** tramite un pulsante dedicato, **sequenziale per address**, su **tutti i messaggi storici**, **senza ereditarietà automatica** dello storico per nuovi membri di gruppo.

## Comportamento atteso

1. **Ogni address con regola IMAP attiva** mostra un pulsante "📥 Applica allo storico". Al click il sistema cerca nella inbox IMAP tutti i messaggi `FROM` quell'indirizzo (senza limite temporale) e applica l'`auto_action` configurata.
2. **Ogni gruppo** mostra un pulsante "Applica allo storico al gruppo" che processa **sequenzialmente address per address** (50 address = 50 sessioni IMAP separate, una per address per evitare timeout su sessioni lunghe).
3. **Nessuna esecuzione automatica** al salvataggio della regola: l'utente sceglie quando lanciare il backfill.
4. **Nessuna ereditarietà automatica**: nuovo address aggiunto a un gruppo con regole già attive → le regole valgono solo sui futuri messaggi (comportamento attuale di check-inbox). Per lo storico serve click manuale.
5. **Feedback**: dialog di conferma che mostra "verranno processati N address", spinner durante l'esecuzione, toast finale con report `{ matched, applied, errors }`.

## Modifiche tecniche

### 1. Nuova edge function `backfill-email-rules`
File: `supabase/functions/backfill-email-rules/index.ts`

**Input**:
```ts
{
  operator_id: string,
  scope: "address" | "group",
  target: string,           // email_address oppure group_name
  dry_run?: boolean         // se true conta soltanto, non esegue
}
```

**Logica**:
1. Carica regole `email_address_rules` filtrate per operator + scope (singolo address o tutti gli address del gruppo).
2. Per ogni address con regola attiva (`auto_action` impostata):
   - Apre **una connessione IMAP** dedicata (riusa la classe ImapConn estesa con `searchByFrom(address)` che fa `UID SEARCH FROM "..."`).
   - `SELECT INBOX`, recupera tutti gli UID storici per quell'address.
   - Per ogni UID applica l'azione (`mark_read` / `archive` / `move_to_folder` / `spam`).
   - Aggiorna `channel_messages` (folder/read_at/hidden_by_rule) **solo se il messaggio esiste in DB** (lookup per `imap_uid` + `from_address`); altrimenti aggiorna solo IMAP (storici mai scaricati).
   - Logout, passa al prossimo address.
3. Aggiorna `email_address_rules.applied_count` e `last_applied_at`.
4. Restituisce report `{ addresses_processed, messages_matched, messages_applied, errors[] }`.

**Sicurezza**:
- Verifica auth utente (no service-role-only) per impedire backfill massivi non autorizzati.
- Cap di sicurezza: max 5.000 messaggi per address (override via `auto_action_params.backfill_cap`).
- Niente azione `delete` (coerente con `apply-email-rules` attuale che non la implementa).

### 2. Strategia di condivisione codice — DUPLICA, non refactora
`apply-email-rules` è nella lista delle edge function "non toccare senza autorizzazione" (vincolo memory). Quindi:

**Decisione**: duplichiamo `ImapConn` (con metodo aggiuntivo `searchByFrom`), `findMatchingRule` e `caCerts.ts` dentro `backfill-email-rules/`. Costo: ~200 LOC duplicati. Beneficio: zero rischio di regressione su `check-inbox` → `apply-email-rules`.

L'unica modifica a `apply-email-rules/index.ts` è l'aggiunta del supporto a `auto_action_params.also_mark_read` (vedi punto 5), modifica isolata e minimale (~10 LOC).

### 3. DAL: `src/data/emailRulesBackfill.ts`
```ts
export interface BackfillReport {
  addresses_processed: number;
  messages_matched: number;
  messages_applied: number;
  errors: Array<{ address: string; error: string }>;
}

export async function backfillForAddress(operatorId: string, address: string, dryRun?: boolean): Promise<BackfillReport>;
export async function backfillForGroup(operatorId: string, groupName: string, dryRun?: boolean): Promise<BackfillReport>;
```
Usa `invokeEdge` (wrapper centralizzato).

### 4. UI
- **`SenderCard`**: dopo "Regole attive" appare pulsante "📥 Applica allo storico" — visibile solo se l'address ha `auto_action` IMAP impostata.
- **`GroupDropZone`**: header del gruppo ottiene icona piccola (📥) accanto al contatore. Click → dialog di conferma con numero di address che verranno processati.
- **`BackfillConfirmDialog`** (nuovo): "Verranno cercati nella inbox IMAP tutti i messaggi storici dei {N} address di '{group}' e applicate le regole. L'operazione può richiedere alcuni minuti. Continuare?" + checkbox opzionale "Esegui prima un dry-run per contare i messaggi".
- **Progress**: spinner + toast finale con report. In v1 niente progress granulare; mitigato dal cap di 20 address per chiamata.

### 5. Bridge schema vs UI — fix collaterale necessario
**Discovery critico**: `RulesConfiguration.tsx` salva in `applied_rules` (JSON array), ma il vero schema di `email_address_rules` ha `auto_action` (string singola) + `auto_action_params` (JSONB). La pipeline `apply-email-rules` legge solo `auto_action`.

**Conseguenza attuale**: le checkbox dello UI **non vengono mai eseguite** dall'IMAP. Il backfill sarebbe inutile senza fixare anche questo.

**Fix**:
- Restringere le checkbox a **una sola azione principale** (radio/select) tra: `archive`, `move_to_folder`, `spam`, `mark_read`, `hide`.
- Aggiungere un toggle ausiliario "Segna anche come letto" (combinabile con archive/move/spam).
- Mappa al salvataggio: `auto_action = '<azione principale>'` + `auto_action_params = { also_mark_read: true, target_folder?: string }`.
- In `apply-email-rules/index.ts` (modifica isolata, ~10 LOC): nel branch `archive/spam/move_to_folder`, dopo il `moveTo` riuscito, se `auto_action_params.also_mark_read === true` chiama anche `markSeen` sull'UID nella nuova cartella.
- Le azioni `forward_to`, `auto_reply`, `delete`, `mark_important`, `skip_inbox` (presenti nello UI ma non implementate nel worker) vengono **rimosse o marcate "🚧 in arrivo"** disabilitate, per non promettere comportamenti inesistenti.

## File toccati

**Nuovi**:
- `supabase/functions/backfill-email-rules/index.ts` (~280 LOC)
- `supabase/functions/backfill-email-rules/caCerts.ts` (copia)
- `src/data/emailRulesBackfill.ts` (~40 LOC)
- `src/components/email-intelligence/management/BackfillButton.tsx`
- `src/components/email-intelligence/management/BackfillConfirmDialog.tsx`

**Modificati**:
- `src/components/email-intelligence/management/SenderCard.tsx` — integra `BackfillButton` per address.
- `src/components/email-intelligence/management/GroupDropZone.tsx` — integra icona backfill + dialog su gruppo.
- `src/components/email-intelligence/management/RulesConfiguration.tsx` — restringe a una azione principale + toggle "anche segna come letto", rimuove le azioni non implementate.
- `src/components/email-intelligence/manual-grouping/useGroupingData.ts` — esponi `auto_action`, `applied_count`, `last_applied_at` per badge "applicato N volte".
- `src/data/emailAddressRules.ts` — aggiungi campi `auto_action`, `auto_action_params`, `applied_count`, `last_applied_at` all'interfaccia `EmailAddressRule`.
- `supabase/functions/apply-email-rules/index.ts` — supporto `auto_action_params.also_mark_read` (modifica isolata ~10 LOC).

**NON toccati** (vincoli memory):
- `check-inbox/*`
- `email-imap-proxy`, `mark-imap-seen`
- Schema DB: nessuna migration — usiamo campi esistenti.

## Limiti e debito tecnico
- **Senza queue persistente**: se l'edge function va in timeout a metà address, gli UID già processati restano spostati senza ripresa automatica. Mitigazione: cap 20 address per chiamata + idempotenza naturale (un `UID MOVE` su messaggio già spostato fallisce in modo benigno).
- **Niente progress realtime granulare**: l'UI mostra solo spinner. Per progress fine serve `backfill_jobs` table + polling — fuori scope v1.
- **Cap 5.000 messaggi per address**: protegge mailbox storiche enormi. Override via `auto_action_params.backfill_cap`.
- **`UID SEARCH FROM`** può essere lento su provider senza indici full-text — accettato, operazione manuale.

## Cosa resta fuori (v2 potenziale)
- Dry-run con preview interattivo dei messaggi candidati.
- Backfill asincrono in coda con worker pg_cron (per gruppi >100 address).
- Ereditarietà regole sui nuovi membri di gruppo (esclusa per scelta).
- Azione `delete/trash` nativa con autodetection cartella cestino del provider.