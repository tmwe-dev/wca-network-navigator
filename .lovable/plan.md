## Cosa cambia

Email Intelligence diventa **mailbox-aware**, esattamente come Funnemail e l'inbox. La selezione del dropdown in alto (Booking, Luca, …) filtra **solo la lista mittenti e i conteggi**. Restano invariati e condivisi tra tutti gli operatori:

- **Gruppi** (`email_sender_groups`) → condivisi
- **Categorizzazioni / regole** (`email_address_rules`, group_id, group_name, AI suggestions) → condivise
- **Routing rules**, **Funnemail** rules, **Scout cache** → invariati

Cambia solo *quali mittenti* vengono mostrati nei tab che mostrano "chi ha scritto": un mittente compare se ha **almeno una email in `channel_messages` per la mailbox selezionata**.

## Impatto utente

Quando sei su **Booking**:
- Vedi solo i mittenti che hanno scritto a `booking@tmwe.it`
- Conteggi header ("Da classificare 1083", "1034/1332 mittenti", "Suggerimenti AI 8") ricalcolati sulla casella attiva
- Se classifichi un mittente, la regola resta valida anche per Luca (è condivisa)

Quando torni su **Luca**: vedi i tuoi mittenti, le classificazioni già fatte da Booking sono già applicate.

## Tab interessati

| Tab | Filtro mailbox |
|---|---|
| Gestione Manuale (mittenti, drag&drop) | sì |
| Suggerimenti AI | sì |
| Auto-Classificazione | sì |
| Funnemail | già filtrato (memoria esistente) |
| Regole & Azioni | no (regole globali) |
| Job Ledger | no |
| Routing Rules | no |
| Scout Cache | no |
| Eval Set | no |

## Dettagli tecnici

1. **`useGroupingData.ts`**
   - Caricare l'**allowlist mittenti per mailbox**: `SELECT DISTINCT lower(from_address) FROM channel_messages WHERE channel='email' AND direction='inbound' AND user_id=<uid o tutti> AND ((mailbox_id = activeMailboxId) OR (activeMailboxId IS NULL AND mailbox_id IS NULL))`. Paginato 1000 con il già esistente `fetchAllRows`.
   - Filtrare `senders` e `classifiedSenders` su quell'allowlist **dopo** il dedup (le regole restano condivise).
   - `populateAddressRules`: aggiungere `eq("mailbox_id", activeMailboxId)` (o `is("mailbox_id", null)` per personale) sulla query `channel_messages`, così "Popola" non importa mittenti di altre caselle.
   - Re-load automatico al cambio mailbox via `useActiveMailbox` come dipendenza dell'effect.

2. **`EmailIntelligencePage.tsx` — KPI in header**
   - `uncategorizedCount` e `aiSuggestionsCount` derivano dalle stesse liste già filtrate → diventano automaticamente mailbox-aware.

3. **`AISuggestionsTab.tsx`**
   - Stesso filtro allowlist applicato alla lista suggerimenti.

4. **Header EmailIntelligenceHeader**
   - Mostrare `Mittenti di {activeMailbox.label}` (es. "Mittenti di Booking") per coerenza con il banner inbox già aggiunto.

5. **Cache react-query**
   - Aggiungere `activeMailbox.mailbox_id` alle query keys di Email Intelligence in `src/lib/queryKeys.ts` per evitare cross-contaminazione tra mailbox.

## Fuori scope

- Non si tocca lo schema DB: nessuna migrazione, nessuna nuova colonna.
- Non si modifica `check-inbox` né le regole RLS.
- Funnemail già filtrato — solo verifica visiva.
- Gruppi e regole restano scrivibili e condivisi (visibilità globale come oggi).

## Rischio

Basso: cambia solo il filtro client-side della lista mittenti. Le regole esistenti restano in DB e visibili agli altri operatori. Se il filtro fallisce a caricare l'allowlist, fallback safe = mostra lista vuota con messaggio "Nessuna email per questa casella" (no crash).
