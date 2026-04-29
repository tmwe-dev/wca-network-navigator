## Audit completo Command — TUTTE le entità (non solo partner)

### Errore del piano precedente

Avevo ridotto tutto al partner. Sbagliato. Command opera su un **dominio multi-entità**: BCA, CRM (contatti importati e **manuali**), partner WCA, prospects, deals, attività, agenda, queue, KB. Ogni handler edge oggi soffre dello **stesso pattern di superficialità**: query minima a una tabella, zero join cross-entità, zero awareness delle altre fonti.

### Le 5 entità "anagrafiche" che Command deve trattare con paritetà

| Entità | Tabella | Origine | Cosa la UI mostra | Cosa il tool ritorna oggi |
|---|---|---|---|---|
| **Partner WCA** | `partners` | Sync directory WCA | Profile description, networks+expires, services, contatti diretti, BCA matchati, deals, activities, address completo, alias, membership | id, città, email/phone, rating, **`raw_profile_html`** (campo VUOTO! anti-pattern), partner_contacts base, networks senza expires, services |
| **Imported Contact** (CRM) | `imported_contacts` | Import CSV/Excel **+ inserimenti manuali** + Sherlock + deep search | Nome, azienda, email/phone/mobile, address, position, lead_status, lead_score+breakdown, deep_search payload, **note**, alias, BCA collegato, interazioni, holding pattern, origin | id, nome, azienda, email, phone, country, lead_status, created_at — **niente note, niente score, niente BCA, niente interactions, niente deep_search** |
| **Partner Contact** | `partner_contacts` | Estrazione/inserimento da scheda partner | Nome, title, email, phone, mobile, is_primary, alias, social links | NON esiste tool dedicato. Solo annidato dentro `get_partner_detail` con 5 campi |
| **Business Card** | `business_cards` | OCR fiere + matching | OCR full payload, ocr_confidence, evento, partner matchato, contatto matchato, note, attachments | id, company_name, contact_name, email, event, match_status — **niente OCR, niente match join, niente note** |
| **Prospect IT** | `prospects` | Scraping italiano | Anagrafica completa, ATECO, prospect_contacts, lead_status | tool `search_prospects` con filtri base |

**Punto critico**: i contatti **inseriti manualmente** vivono in `imported_contacts` con `origin='manual'` (o simili). Il tool oggi non distingue, non espone l'origin nel detail e non mostra le note dell'operatore — proprio il valore aggiunto del lavoro umano.

### Le entità "transazionali" collegate (oggi invisibili a Command)

Per ogni anagrafica sopra, la UI aggrega:

- **`activities`** — call log, meeting, follow-up
- **`contact_interactions`** — log interazioni manuali su singolo contatto
- **`deals`** — opportunità commerciali con stage kanban
- **`channel_messages`** — email/WA/LinkedIn ricevute e inviate
- **`outreach_queue`** — campagne pending/scheduled per contatto
- **`calendar_events`** — meeting, call, follow-up programmati
- **`notifications`** — eventi recenti su questa entità
- **`agent_tasks`** — task AI in corso o completati
- **`partner_relations`** (networks, services, certs, social_links) per partner
- **`blacklist`** — controllo dominio/email
- **`download_jobs`** — sync WCA recenti
- **`lead_score_breakdown`** — formula 0-100

Nessuno di questi viene aggregato nei tool detail oggi.

### Causa radice (uguale per tutte le entità)

1. **Doppio handler non riconciliato**: esiste `_shared/toolHandlersRead.ts` (versione "ricca", parzialmente fatta per partner) ma **non viene mai chiamato**. Command passa per `_shared/platformTools/*Handler.ts` che è la versione minimal.
2. **Zero uso della DAL `src/data/`**: ogni handler riscrive query Supabase a mano. Drift permanente garantito.
3. **Zero join cross-entità**: ogni handler legge una sola tabella, mai aggregati.
4. **Anti-pattern `raw_profile_html`** già violato in `handleGetPartnerDetail` (vedi memoria `wca-data-availability`).
5. **Tool defs incompleti** per i parametri (no paginazione, no sort multi-colonna, no filtri compositi che la UI ha).
6. **Domini scoperti**: deals, calendar, notifications, outreach_queue, agent_tasks, kb, lead_score, agenda — nessun tool li espone.

### Fix proposto — un'unica passata, multi-entità

**Fase 1 — Riscrittura "detail" handler con aggregazione cross-entità**

Tre handler riscritti (uno per anagrafica primaria), tutti con lo stesso pattern: leggi entità + aggrega in parallelo le entità collegate.

1. **`handleGetPartnerDetail`** (`partnersSearchHandler.ts`)
   - Fix anti-pattern: `has_profile = !!profile_description`, `profile_summary` da `profile_description`
   - Aggiungi: member_since, membership_expires, alias, mobile, fax, address, office_type, partner_type, branches, logo, enrichment_data
   - Aggrega: `partner_contacts` + `business_cards` (matched) + `imported_contacts` (matched) deduplicati per email → `contacts_count_total` + `contacts_breakdown`
   - Join: deals, activities recenti (10), channel_messages recenti (5 con direzione), outreach_queue pending count, blacklist status, networks WITH `expires`, services, social_links, calendar_events futuri

2. **`handleGetContactDetail`** (`contactsHandler.ts`) — **questo è il fix più importante che mancava**
   - Restituisce TUTTI i campi (incluso `note`, `origin`, `position`, `address`, `alias`, `enrichment_data`, `lead_score`, `lead_score_breakdown`, `deep_search_at`, payload deep_search se presente)
   - Identifica esplicitamente se è **manuale** (`origin='manual'` o equivalente) e lo segnala in output
   - Aggrega: `contact_interactions` (timeline), `business_card` collegato (via email), `partner` collegato (se transferred_to_partner_id), `channel_messages` (email thread filtrate per email contatto), `outreach_queue` voce attiva, `calendar_events` futuri, `agent_tasks` su questo contatto, `notifications` recenti
   - `holding_pattern_state` calcolato (in/out + giorni dall'ultima interazione)

3. **NUOVO `handleGetBusinessCardDetail`** (`businessCardsHandler.ts`)
   - Restituisce OCR completo, ocr_confidence, attachments, note
   - Join: partner matchato (con stesso schema sintetico di partner_detail), imported_contact matchato, channel_messages collegati per email, calendar_events
   - Indica chiaramente `match_state` e cosa è collegato

4. **NUOVO `handleGetProspectDetail`** (handler dedicato)
   - Anagrafica + ATECO + `prospect_contacts` + activities + deals collegati

**Fase 2 — Tool defs arricchiti (`platformToolDefs.ts`)**

- `search_partners`: aggiungi multi-country, lead_status[], member_expiring_within, services[], sort_by extra (interaction_count, last_interaction_at)
- `search_contacts`: aggiungi paginazione, sort multi-colonna, filtri channel/quality/met_personally/wcaMatch/group, **filtro `origin='manual'`** per trovare i contatti inseriti a mano
- `search_business_cards`: aggiungi filtri `match_status`, `has_partner_match`, `has_contact_match`, ocr_confidence range, evento+date
- Nuovi tool: `get_business_card_detail`, `get_prospect_detail`, `search_partner_contacts` (cercare direttamente nei contatti diretti dei partner)

**Fase 3 — Nuovi tool per domini transazionali (1 file: `domainsExtraHandler.ts`)**

- `list_deals` (filtri stage, owner, partner/contact)
- `get_pipeline_view` (kanban aggregato)
- `list_outreach_queue` (filtri status, scheduled_at)
- `list_calendar_events` (range date, type, entity_id)
- `list_notifications` (filtri unread, type, entity)
- `list_agent_tasks` (status, agent)
- `search_kb` (full text su kb_entries)
- `get_lead_score_breakdown` (per qualsiasi entità con score)
- `check_blacklist_email` (controllo singolo)
- `list_email_send_log` (storico campagne per contatto)
- `get_holding_pattern_list` (lista contatti out)
- `get_global_dashboard` (stats omnicomprensive: pipeline, queue, missioni, conversion)

**Fase 4 — System prompt Command (`scopeConfigs.ts`, case "command")**

Allarga le regole detail-mode oltre i partner:

```
DETAIL-MODE per qualsiasi entità nominata:
- "Acme srl" o nome azienda → search_partners + search_contacts (azienda) + search_business_cards in parallelo;
  se 1 partner dominante → get_partner_detail; se solo contatti → get_contact_detail per ognuno (top 3)
- "Mario Rossi" o nome persona → search_contacts (manuali e importati) + search_partner_contacts + search_business_cards;
  se match unico → get_contact_detail / get_business_card_detail
- "biglietto da visita di X" → search_business_cards → get_business_card_detail
- "prospect Y" → search_prospects → get_prospect_detail

Note: i contatti inseriti manualmente (origin='manual') sono LAVORO UMANO PREZIOSO,
mostra sempre `note` e `position` quando li recuperi.

Per qualsiasi entità: il detail aggrega activities, deals, calendar, outreach,
business cards, channel_messages. Non rispondere "non ho accesso" se esiste
un tool dedicato del dominio (deals/calendar/notifications/queue/kb).
```

**Fase 5 — Test paritetà**

`platformTools_test.ts`: per ogni entità sample (partner, contact manuale, contact importato, BCA, prospect), il detail handler deve ritornare gli stessi count e campi della UI. CI verifica.

**Fase 6 — Memoria + doc**

- `mem/features/command-orchestrator-v2.md` aggiornato con la lista nuovi tool e l'allargamento multi-entità
- Marker `@deprecated` su `toolHandlersRead.ts` per evitare confusione futura

### File toccati

1. `supabase/functions/_shared/platformTools/partnersSearchHandler.ts` — riscrittura `handleGetPartnerDetail` + fix anti-pattern
2. `supabase/functions/_shared/platformTools/contactsHandler.ts` — riscrittura `handleGetContactDetail` (incluso supporto contatti manuali) + arricchimento `handleSearchContacts`
3. `supabase/functions/_shared/platformTools/businessCardsHandler.ts` — riscrittura `handleSearchBusinessCards` + nuovo `handleGetBusinessCardDetail`
4. `supabase/functions/_shared/platformTools/prospectsHandler.ts` — nuovo `handleGetProspectDetail`
5. `supabase/functions/_shared/platformTools/domainsExtraHandler.ts` — NUOVO: handler per i 12 nuovi tool transazionali
6. `supabase/functions/_shared/platformTools/platformToolDefs.ts` — espansione parametri esistenti + 14 nuovi tool defs
7. `supabase/functions/_shared/platformTools/platformToolHandlers.ts` — routing nuovi handler
8. `supabase/functions/_shared/scopeConfigs.ts` — aggiornamento system prompt case "command" multi-entità
9. `supabase/functions/_shared/platformTools_test.ts` — test paritetà
10. `mem/features/command-orchestrator-v2.md` — aggiornamento doc

### Risultato atteso

Una sola PR. Dopo il merge Command può rispondere con paritetà alla UI per **partner, contatti CRM (importati e manuali), partner contacts, business cards, prospects**, e per i loro domini collegati (deals, agenda, queue, notifications, score, KB). Niente più "scopri-cose-mancanti" a singhiozzo.

### Garanzie

- **Nessuna modifica alla UI o alla DAL** (`src/data/` invariata): cambi solo nello strato edge.
- **Soft-delete e RLS** rispettati: gli handler usano lo stesso supabase client già configurato.
- **Hard guards** invariati: nessun nuovo tool destructive.
- **Backwards compatible**: i tool esistenti mantengono firma; aggiungono solo campi al return.