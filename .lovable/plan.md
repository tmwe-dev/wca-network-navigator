## Obiettivi

1. **Auto-focus prima entità + apertura dettaglio** su tutte le pagine lista (Funnemail, Inreach, Contatti, ecc.).
2. **Default ordinamento**: in Inreach (client di posta) data DESC; in Funnemail brand azienda A-Z. Pulsante per raggruppare per mittente.
3. **Pulsante "Letto"** che marca e fa sparire la mail se vista = "Non lette". Vista default = **Non lette**.
4. **Loghi azienda** sempre presenti nelle card lista (Funnemail e Inreach) — verifica che `CompanyLogo` renderizzi anche con dominio sconosciuto (placeholder iniziali).
5. **Deep search + arricchimento + classificazione automatici** all'ingresso di ogni mail da **mittente sconosciuto** (dominio non presente in CRM/contatti).

## Cambi UI/Logica

### 4.1 Auto-selezione prima riga (già presente in Funnemail e Inreach via useEffect)
- Verificare/estendere a `EntityListWithDetail` (Contatti, CRM, ecc.): se nessun `urlContactId` e lista non vuota, autoselezionare il primo elemento ordinato e chiamare `onOpenContact`.

### 4.2 Default filtri globali
- `GlobalFiltersContext` → cambiare default:
  - `funnemailView`: `"all"` → `"unread"`
  - `sortingFilter`: `"all"` → `"unreviewed"` (Inreach default = non lette)
  - `emailSort`: rimane `"date_desc"` (Inreach)
- `funnemail_list_view_v1` (localStorage) default sort: `"date_desc"` → `"company_asc"`.

### 4.3 Pulsante "Letto" sulle card
- Aggiungere icona "✓ Letto" su `FunnemailMailCard` e `EmailMessageList` accanto alle altre azioni.
- Click → `markAsRead.mutate(msg.id)` → invalidazione query → la mail sparisce automaticamente perché il filtro client-side esclude `read_at != null` quando vista=unread.

### 4.4 Loghi nelle card Funnemail
- Verificare che `CompanyLogo` con `email + name` mostri sempre fallback (iniziali colorate) quando il favicon non è disponibile.
- Il caso reale è già gestito; aggiungere `fallbackInitials` esplicito e `bg-muted` per garantirne la visibilità anche con domini sconosciuti.

### 4.5 Toolbar Funnemail — sort default + raggruppa
- `FunnemailListToolbar` esiste già con sort/group. Cambiare etichetta default a "Azienda A-Z" e mantenere "Raggruppa per mittente" come toggle visibile.

## Backend: deep search + enrichment all'ingresso

### 5.1 Trigger automatico in `check-inbox`
**Nodo critico** — modifica isolata, dietro feature flag, senza toccare il flusso di download.

- Dopo il salvataggio di un nuovo `channel_messages` inbound, per ogni mittente NUOVO (dominio non già in `partners` né in `partner_contacts`/`imported_contacts` dell'operatore):
  - Inserire job in nuova tabella `inbound_enrichment_queue` (status pending).
- Nessuna chiamata AI sincrona dentro `check-inbox` (per non rallentare il polling).

### 5.2 Nuova edge function `process-inbound-enrichment`
- Cron ogni 1 min, lock su job pending, batch max 5.
- Per ogni job:
  1. Estrae brand da `from_address`, dominio.
  2. Chiama `invokeAi("deep_search.scout")` con scope esistente → arricchimento basico.
  3. Chiama `invokeAi("funnemail.classify")` per suggerimento classificazione → salva su `channel_messages.ai_classification_suggestion` (jsonb).
  4. Aggiorna `inbound_enrichment_queue.status = done`.
- Hard guards e rate limit invariati.

### 5.3 UI: mostra suggerimento AI sulla card
- `AiSuggestionChip` già esiste ma riceve `null`. Connetterla via `useFunnemailInbox` leggendo il campo `ai_classification_suggestion` dal messaggio. Una volta accettato → assegna gruppo + mark suggestion as accepted.

## File da modificare

```text
src/contexts/GlobalFiltersContext.tsx                  defaults unread
src/v2/ui/pages/funnemail-inbox/FunnemailMailList.tsx  default sort company_asc
src/v2/ui/pages/funnemail-inbox/FunnemailMailCard.tsx  pulsante Letto + logo fallback
src/components/outreach/EmailMessageList.tsx           pulsante Letto
src/v2/ui/organisms/EntityListWithDetail.tsx           auto-select first
src/v2/hooks/useFunnemailInbox.ts                      pass ai_classification_suggestion
supabase/functions/check-inbox/index.ts                enqueue enrichment per mittenti nuovi
supabase/functions/process-inbound-enrichment/         nuova edge function
migration                                              tabella inbound_enrichment_queue + colonna ai_classification_suggestion + cron
```

## Vincoli rispettati

- `check-inbox`: aggiunta solo enqueue, no chiamate AI sincrone (constraint "no modifiche senza autorizzazione" → richiedo OK esplicito qui).
- AI Invocation Charter: tutto via `invokeAi()` con scope registrato.
- Editorial review: non interessato (sola classificazione, non invio).
- Soft-delete: invariato.

## Domanda di sblocco

Per l'arricchimento automatico devo aggiungere ~10 righe di enqueue in `check-inbox`. Confermo che è coperto dall'autorizzazione data nella scorsa modifica (flag re-sync) o vuoi un OK esplicito separato?
