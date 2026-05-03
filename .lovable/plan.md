## Obiettivo
Quando un partner/contatto entra in qualsiasi contenitore "in uscita" (cockpit, campagna pendente, coda outreach, bozza email non spedita), deve **scomparire** dalle liste di lavoro come se fosse `lead_status=holding`. Se l'entry viene cancellata senza invio → il partner torna automaticamente visibile.

## Definizione operativa di "occupato" (Holding allargato)
Un partner_id si considera **occupato** se esiste almeno una riga viva (`deleted_at IS NULL`) per il suo `partner_id` in:

- `outreach_queue` con `status IN ('pending','queued','scheduled','processing')`
- `campaign_jobs` con `status IN ('pending','queued','in_progress')`
- `cockpit_queue` con `status IN ('queued','in_progress')`
- `email_campaign_queue` con `status IN ('pending','queued','sending')` collegata a `email_drafts.status='draft'`/`queue_status IN ('idle','queued','running')`

Nessun trigger di scrittura su `lead_status`: la transizione è **derivata in lettura** così, se l'utente cancella la riga in coda, il partner torna immediatamente "free" senza side-effect su `partners.lead_status`.

## Ambito
- Tutte le liste basate su `CompanyCardList` (Network/WCA, CRM Contacts, BCA).
- **Prospects** e qualsiasi vista che oggi mostra aziende/contatti lavorabili.
- Convive col filtro esistente `holdingFilter` (Senza/Solo/Tutti) — semplicemente la base "holding" diventa più larga.

## Architettura

### 1. Nuova tabella materializzata di stato (sola lettura)
Vista `v_partner_busy` (o tabella materializzata aggiornata via trigger) con una sola colonna utile:

```text
partner_id  | source ('outreach'|'campaign'|'cockpit'|'draft') | since
```

Indice su `partner_id`. Nessuna logica nuova in DB lato write — solo una **VIEW** che fa UNION delle 4 sorgenti filtrate per status "vivo". Più semplice, sempre fresca, niente trigger.

### 2. DAL `src/data/partnerBusy.ts`
- `findBusyPartnerIds(scope?: { partnerIds?: string[] }): Promise<Set<string>>`
- Singolo round-trip `select partner_id from v_partner_busy` (eventualmente filtrato `in (...)` se la lista è piccola).
- Cache react-query da 30s con invalidate quando le mutation toccano: outreach_queue, campaign_jobs, cockpit_queue, email_drafts.

### 3. Hook `useBusyPartners(partnerIds: string[])`
Chiave query centralizzata in `src/lib/queryKeys.ts` (`v2.busyPartners`). Restituisce `Set<string>`.

### 4. Integrazione nelle liste
In `EntityListWithDetail` la pipeline filtri diventa:

```text
companies
  → enrich con `meta.holding = meta.holding || busy.has(c.id)`
  → applica holdingFilter (Senza/Solo/Tutti) come oggi
  → filtri standard
```

Vantaggio: zero modifiche ai 3 adapter (`useWcaPartnersAsCompanies`, `useCrmContactsAsCompanies`, BCA) — l'arricchimento avviene in un solo punto.

### 5. UI feedback
- Il chip esistente "Senza circuito di attesa" resta invariato come label, ma ora copre anche cockpit/queue/draft.
- Tooltip aggiornato sull'icona ✈️ della card: "In circuito di attesa (cockpit / campagna in attesa / coda invio / bozza)".
- Quando un partner è "busy" per via di queue ma con `lead_status` neutro, mostra ✈️ con stile leggermente diverso (outline invece di filled) — opzionale, da confermare.

### 6. Invalidazione cache
Hook helper `useInvalidateBusyPartners()` chiamato dopo:
- enqueue/cancel outreach
- create/cancel campagna
- add/remove cockpit
- save/discard bozza

## Cosa NON cambia
- `partners.lead_status` resta governato dal Lead Status Guard Protocol esistente. La nuova logica è solo "vista".
- Nessuna modifica al backend di invio/coda. Nessun trigger nuovo. Nessuna RLS toccata (la VIEW eredita le policy delle tabelle sottostanti).

## Dettaglio tecnico (per chi sviluppa)

### Migration
```sql
CREATE OR REPLACE VIEW public.v_partner_busy AS
  SELECT partner_id, 'outreach'::text AS source, created_at AS since
  FROM public.outreach_queue
  WHERE deleted_at IS NULL
    AND partner_id IS NOT NULL
    AND status IN ('pending','queued','scheduled','processing')
  UNION ALL
  SELECT partner_id, 'campaign', created_at
  FROM public.campaign_jobs
  WHERE partner_id IS NOT NULL
    AND status IN ('pending','queued','in_progress')
  UNION ALL
  SELECT partner_id, 'cockpit', created_at
  FROM public.cockpit_queue
  WHERE partner_id IS NOT NULL
    AND status IN ('queued','in_progress')
  UNION ALL
  SELECT ecq.partner_id, 'draft', ecq.created_at
  FROM public.email_campaign_queue ecq
  JOIN public.email_drafts d ON d.id = ecq.draft_id
  WHERE ecq.partner_id IS NOT NULL
    AND ecq.status IN ('pending','queued','sending')
    AND d.status = 'draft';
```
(Confermare nomi colonne `email_campaign_queue.partner_id` prima di applicare; in caso negativo, fare lookup via `recipient_email` o saltare quella sorgente.)

### File toccati (stima)
- `supabase/migrations/<ts>_v_partner_busy.sql` (nuovo)
- `src/data/partnerBusy.ts` (nuovo)
- `src/v2/hooks/useBusyPartners.ts` (nuovo)
- `src/lib/queryKeys.ts` (1 chiave)
- `src/v2/ui/organisms/EntityListWithDetail.tsx` (1 effetto enrich pre-filter)
- `src/v2/ui/molecules/CompanyCardList/CompanyCard.tsx` (tooltip ✈️)
- 4–6 hook di mutation per invalidare la chiave (cockpit add, outreach enqueue, campaign create, draft save)

## Out of scope (proposta separata se serve)
- Estensione automatica di `lead_status` a `first_touch_sent` quando si manda davvero il primo messaggio — già coperta dal Lead Status Guard Protocol.
- Vista contatto-level (oggi la "occupazione" è a livello partner; se serve granularità contatto per le sub-card, va aggiunto un secondo indice su `contact_id`).
