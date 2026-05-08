# LinkedIn Read — Ottimizzazione cascata Optimus → Structural → AX Tree

## Principio centrale
> Il nome non è mai una chiave. La chiave è `threadUrl`, `threadId`, `profileUrl`, `profileId` o `linkedinId`.

Adotto la guida che hai scritto. Spacchetto in 3 sprint (P0 / P1 / P2) per restare nei vincoli (modifiche minime, niente refactor opportunistici, file critici come `check-inbox`/`email-imap-proxy` esclusi). Tutto sotto bandiera **LinkedIn Cookie Sync** (solo file in `public/linkedin-extension/` e hook `src/hooks/useLinkedIn*.ts`).

## File toccati (perimetro chiuso)
- `public/linkedin-extension/actions.js` (entry: `readInbox`, `readThread`, `backfillThread`)
- `public/linkedin-extension/ax-tree.js` (declassare confidence)
- `public/linkedin-extension/manifest.json` (bump 3.9.27 → 3.9.28 alla fine di P0, di nuovo a fine P1)
- `public/linkedin-extension.zip` + `public/chrome-extensions/linkedin/linkedin-extension-3.9.28.zip` + `catalog.json`
- `src/lib/whatsappExtensionZip.ts` (versione)
- `src/hooks/useLinkedInMessagingBridge.ts` (tipi propagati)
- `src/hooks/useLinkedInSync.ts` (chiave dedup, salvataggio, upsert linkedin_addresses)
- `src/hooks/useLinkedInBackfill.ts` (no-growth counter)
- `src/data/linkedinAddresses.ts` (già esistente, solo chiamato)
- (test UI) un piccolo pannello in pagina diagnostica LinkedIn esistente — niente nuove rotte

NESSUNA modifica a edge functions email, RLS, journalist review, Partner Connect, send-linkedin, schema DB (l'RPC `upsert_linkedin_address` e la tabella `linkedin_addresses` esistono già — verificato in migration `20260508054531`).

---

## SPRINT P0 (subito, alta priorità) — versione 3.9.28

### P0.1 Stop dedup per nome
File: `public/linkedin-extension/actions.js` (righe 603-605, 658, 677-679) + `src/hooks/useLinkedInSync.ts` (riga 132).

Sostituire `nameKey` con cascata:
```text
key = threadUrl || profileUrl || linkedinId || profileId || `${name}|${lastMessage}|${lastActivity}`
```

### P0.2 AX Tree non finge la direzione
File: `public/linkedin-extension/ax-tree.js`.
- `readInbox` AX: `unread = null`, `lastMessage = null`, `confidence ≤ 0.45`.
- `readThread` AX: per ogni messaggio dove non si distingue mittente → `direction: "unknown"`, `confidence: 0.35`. Mai più `inbound` di default.

In `useLinkedInSync.ts`: messaggi `direction === "unknown"` salvati come `inbound` solo se anche il preview thread era unread; altrimenti scartati con warning `ax_tree_direction_unknown`.

### P0.3 Propagare gli ID reali fino al DB
Estendere il payload in `actions.js → readInbox/readThread` con i campi:
```ts
type LinkedInThread = {
  name; threadUrl; profileUrl; linkedinId; profileId; threadId;
  unread; lastMessage; lastActivity;
  method: "optimus" | "structural" | "ax_tree";
  confidence: number;
};
type LinkedInMessage = {
  text; sender; direction; timestamp;
  threadUrl; threadId; profileUrl; profileId; linkedinId;
  method; confidence;
};
```
Aggiornare il typing in `useLinkedInMessagingBridge.ts`.

In `useLinkedInSync.ts` salvare:
- `from_address` = `profileUrl || linkedinId || profileId` (non più `name`)
- `from_name` = `name`
- `thread_id` = `threadId || threadUrl`
- `email_date` = `parsedTimestamp || created_at`
- `raw_payload` = `{ profileUrl, profileId, linkedinId, threadUrl, threadId, method, confidence }`

### P0.4 Chiamare `upsert_linkedin_address` durante la sync
In `useLinkedInSync.ts`, dopo ogni messaggio salvato con successo:
```ts
await supabase.rpc("upsert_linkedin_address", { p_user_id, p_operator_id, p_profile_slug, p_profile_url, p_display_name, p_headline: null, p_direction, p_message_at });
```
Best-effort: fallimento RPC → warning, non blocca la sync.

### P0.5 Test UI diagnostico (3 bottoni)
Nella pagina diagnostica LinkedIn esistente (cercare quella usata oggi per `Leggi Inbox`):
1. **Leggi Inbox** → tabella: `name | threadUrl | profileUrl | unread | lastMessage | method | confidence`
2. **Leggi Thread** → input/select `threadUrl` → tabella: `direction | sender | text | timestamp | method | confidence`
3. **Backfill Thread** → input `threadUrl + lastKnownText + maxScrolls` → mostra: `messagesFound, stoppedBy, scrolls`

Dove la pagina diagnostica non esiste ancora, aggiungo un piccolo pannello in `/v2/...` (rotta che già ospita i bottoni LinkedIn — da identificare nel primo step di build, **senza** creare nuove rotte top-level).

### P0 Done = bump 3.9.28, ZIP rigenerati, sync funzionante con ID reali in DB.

---

## SPRINT P1 — versione 3.9.29

### P1.1 Structural fallback inbox robusto
In `actions.js` structural fallback:
- `detectUnread(card)` con 4 segnali (class, aria, bold, counter)
- `extractLastMessage(card, name)` con priorità selettori e blacklist label

### P1.2 Structural fallback thread con direzione
`inferDirection(el, selfName)` come da guida (class outbound/inbound, sender = "you/tu/me/io" o `selfName`). Default `"unknown"` (non più `inbound`).

### P1.3 Backfill scroll-up con no-growth counter
`useLinkedInBackfill.ts` + parte estensione `backfillThread`:
- variabili `noGrowthCount`, `prevMessageCount`
- esci con `stoppedBy = anchor_found | top_reached_no_growth | max_scrolls | timeout`
- minimo 2-3 cicli senza crescita prima di uscire

### P1.4 Dedup messaggi stabile
Sostituire `messageDedup.buildDeterministicId(... + index)` con `buildLinkedInMessageId`:
```text
hash("li" | threadId|threadUrl | profileId|linkedinId|profileUrl | direction | normSender | normText | normTimestamp)
```
Fallback senza timestamp: `... | nearestVisibleDate | localWindowIndex`. Helper in `src/lib/linkedinDedup.ts` (nuovo file piccolo, scope LI).

### P1.5 Strategia sync allargata
```ts
shouldReadThread = thread.unread === true
  || !threadAlreadySeen(threadId || threadUrl)
  || previewDiffersFromLastDbMessage(thread.lastMessage)
  || forceBackfill === true;
```
`threadAlreadySeen` e `previewDiffersFromLastDbMessage` interrogano `channel_messages` con cache locale per evitare N+1.

---

## SPRINT P2 — rifinitura (nessun bump versione richiesto, può andare in 3.9.29)

### P2.1 Confidence + warnings nel response extension
Ogni risposta:
```ts
{ success, method, confidence, warnings: string[], counts: { rawCandidates, accepted, dropped } }
```
Warning standardizzati: `ax_tree_missing_last_message`, `ax_tree_direction_unknown`, `structural_unread_low_confidence`, `optimus_unavailable`, `profile_url_missing`, `dedup_key_fallback_name_used`.

### P2.2 Snapshot DOM su fallimento
Già presente in `sendMessage` (probe). Estendere a `readInbox`/`readThread` quando `accepted === 0`.

### P2.3 Pannello qualità sync
Toast sostituito da piccolo pannello con: thread analizzati, accettati, scartati per motivo, confidence media, % method.

---

## Cosa NON si fa
- Nessuna modifica a `check-inbox`, `email-imap-proxy`, `mark-imap-seen`
- Nessuna modifica a Partner Connect (resta v3.4.3 con `LI_DELEGATED`)
- Nessuna modifica a journalist review / editorial layer
- Nessuna modifica a schema DB (RPC e tabella esistono)
- Nessun refactor di Optimus / AILearn (resta percorso primario)
- Nessuna nuova rotta top-level — il pannello test va dove i bottoni già esistono

## Validazione finale (checklist tua, integrale)
| Caso | Atteso |
|---|---|
| Due contatti con stesso nome | entrambi presenti |
| Thread con messaggi miei e suoi | direzione corretta |
| Optimus disattivato | structural fallback ancora utile |
| AX Tree fallback | dati low-confidence, mai falsi inbound |
| Thread già letto ma mai salvato | letto almeno una volta |
| Backfill storico | non esce al primo scroll |
| Messaggio vecchio letto oggi | mantiene timestamp LinkedIn |
| Rubrica LinkedIn | nuova riga con `profile_slug` / `profile_url` |
| Duplicate sync | zero duplicati |
| Inbox test UI | permette read thread e backfill |

## Reversibilità
Ogni sprint è un commit isolato; il bump versione è l'ultimo step. Rollback = ripristinare versione precedente nel `manifest.json` e nei ZIP.

## Domanda di approvazione
Confermi che procediamo **per sprint sequenziali (P0 → P1 → P2)**, ciascuno con bump versione + ZIP + test prima di passare al successivo? Oppure preferisci P0+P1 in un'unica spinta e P2 dopo?
