## Obiettivo
Estendere l'integrazione TMWE già in piedi (proxy, OAuth, whitelist) per coprire 4 funzioni operative:
1. **Match cliente** Lovable ⇄ TMWE (anagrafica)
2. **Sync attività**: chi è cliente attivo, quali servizi fa, quanto fattura
3. **Listini & quotazioni** legati al cliente
4. **Rubrica contatti** TMWE collegata al partner

## Decisioni confermate
- **Identità chiamante**: **token OAuth dell'operatore loggato** (Luca Arcana admin → vede tutto). Tutte le edge che leggono dati TMWE usano `identity: "user"` e richiedono che l'operatore abbia completato `tmwe-oauth-start`. Se non collegato → UI mostra CTA "Connetti TMWE".
- **Match**: auto-suggerimento per P.IVA + VIES con conferma manuale (un click "Collega"). Niente auto-link silenzioso.
- **Sync**: ibrido. Snapshot (status attivo, fatturato 12 mesi, listino assegnato) salvato in DB, refreshato ogni 6h via cron + on-demand dal pulsante "Risincronizza". Dettagli singola fattura/tariffa: live.
- **Quotazioni**: lettura listino assegnato + `rate_lookup` per rotta singola. Multi-corriere `rate_shipment` rimandato.

> Nota cron: il cron usa il **system token** (client_credentials) solo per la lettura aggregata multi-cliente, perché non ha sessione utente. Letture interattive da UI usano sempre il token OAuth dell'operatore. Audit traccia entrambe.

## Cosa cambia

### A. Whitelist TMWE_OPS (`supabase/functions/_shared/tmweClient.ts`)
Aggiungo 12 op (tutte read; identity `user` salvo dove indicato):
```text
anagrafica.list            GET  api_anagrafica_crud
anagrafica.byId            GET  api_anagrafica_crud?id=
anagrafica.searchByVat     GET  api_anagrafica_crud?vat=
anagrafica.contacts        GET  api_anagrafica_contacts
anagrafica.addresses       GET  api_anagrafica_addresses
anagrafica.vies            GET  api_anagrafica_vies
listini.list               GET  api_listini
listini.assignments        GET  api_listini_assignments
listini.prices             GET  api_listini_prices
listini.rateLookup         GET  api_listini_rate_lookup
invoices.byClient          GET  api_invoices_crud?client_id=
invoices.billableShipments GET  api_invoice_billable_shipments
```
Il cron batch può usare `identity: "system"` solo per `anagrafica.list`/`invoices.byClient` aggregati.

### B. Tabelle nuove (migration)
- `tmwe_partner_links` — `partner_id`, `tmwe_client_id`, `tmwe_vat`, `match_confidence` (`exact_vat`/`vies`/`manual`), `linked_by_user_id`, `linked_at`. Unique `(partner_id)` e `(tmwe_client_id)`. RLS: SELECT per tutti gli operatori autenticati; INSERT/DELETE solo via DAL/edge.
- `tmwe_customer_snapshot` — `tmwe_client_id` PK, `denomination`, `vat`, `is_active`, `assigned_price_list_id`, `assigned_price_list_name`, `last_synced_at`.
- `tmwe_revenue_monthly` — `tmwe_client_id`, `year`, `month`, `revenue_amount`, `currency`, `invoices_count`, `services_breakdown` (jsonb). PK `(client_id,year,month)`.
- `tmwe_request_audit` — `op_name`, `identity`, `caller_user_id`, `partner_id?`, `status`, `latency_ms`, `created_at`. RLS: solo admin in lettura.

### C. Edge functions nuove (tutte con `getClaims()` + CORS whitelist + Zod input)
- **`tmwe-partner-match`** — `{partner_id}` → ritorna `candidates[]` con score. Usa OAuth utente.
- **`tmwe-partner-link`** — `{partner_id, tmwe_client_id, confidence}` → upsert link + trigger sync immediato per quel client.
- **`tmwe-customer-sync`** — orchestratore. Modalità `single` (uso utente) o `batch` (cron, system token, header `x-cron-secret`). Upsert snapshot + revenue.
- **`tmwe-quote-lookup`** — `{partner_id, origin, destination, weight, service_type}` → risolve listino del cliente, chiama `listini.rateLookup`, ritorna prezzo+breakdown. OAuth utente.

### D. Cron pg_cron
Job `tmwe-customer-sync-6h` ogni 6 ore: chiama `tmwe-customer-sync` con `mode=batch, limit=50`, usando `x-cron-secret` da Vault (pattern già usato da `smart-scheduler`).

### E. DAL (`src/data/tmwe.ts`)
Wrapper tipizzati: `findTmweCandidates`, `linkPartnerToTmwe`, `unlinkPartnerFromTmwe`, `getTmweSnapshot`, `getRevenueLast12Months`, `getAssignedPriceList`, `getPriceListPrices`, `lookupTmweQuote`, `triggerCustomerResync`. Nessuna `supabase.from()` fuori DAL.

### F. UI nuova (V2, logic-less in pages, business in hooks)

**1. Tab "TMWE" nella pagina partner** (`src/v2/ui/pages/partner/PartnerTmweTab.tsx`)
- Banner "Connetti TMWE" se l'utente non ha OAuth attivo (deep-link a `tmwe-oauth-start`).
- Sezione "Anagrafica TMWE": stato collegamento. Se non collegato → bottone "Cerca su TMWE" → dialog candidati. Se collegato → card con denominazione/VAT/badge attivo.
- Sezione "Fatturato 12 mesi": sparkline + totale + breakdown servizi.
- Sezione "Listino assegnato": nome + drawer "Vedi tariffario".
- Sezione "Quotazione veloce": form rotta/peso → prezzo.
- Bottone "Scollega" (solo admin).

**2. Pagina `/v2/tmwe/clients`** (Direzionale)
- Tabella snapshot linkati: denominazione, partner, fatturato YTD, status, last sync.
- Filtri: attivi/inattivi/non-fatturanti >90gg, servizio.
- CTA "Risincronizza" per riga + "Risincronizza tutti".

**3. Hooks**: `useTmweMatch`, `useTmweSnapshot`, `useTmweRevenue`, `useTmwePriceList`, `useTmweQuote`, `useTmweOAuthStatus`.

### G. Sicurezza
- Tutte le edge UI-callable: JWT operatore obbligatorio via `getClaims()`.
- Cron edge: `x-cron-secret` validato lato edge.
- CORS via `_shared/cors.ts`.
- Zod su input.
- Logging via `_shared/structuredLogger.ts`.
- Nessun token TMWE esposto al frontend.

## Tecnico

### Mapping match score
- `exact_vat`: P.IVA identica → score 100.
- `vies`: VIES conferma stessa entità → score 90.
- `name_fuzzy`: levenshtein ≤2 su denominazione + città → 60-80.
- <60 escluso.

### File nuovi/modificati
```text
supabase/functions/_shared/tmweClient.ts            (+ 12 ops)
supabase/functions/tmwe-partner-match/index.ts      NEW
supabase/functions/tmwe-partner-link/index.ts       NEW
supabase/functions/tmwe-customer-sync/index.ts      NEW
supabase/functions/tmwe-quote-lookup/index.ts       NEW
supabase/migrations/<ts>_tmwe_link_and_snapshot.sql NEW
src/data/tmwe.ts                                    (+ 9 wrapper)
src/v2/hooks/useTmwe*.ts                            NEW (6 hook)
src/v2/ui/pages/partner/PartnerTmweTab.tsx          NEW
src/v2/ui/pages/tmwe/TmweClientsPage.tsx            NEW
src/lib/queryKeys.ts                                (+ tmwe.*)
```

## Fuori scope (sprint successivo)
- `rate_shipment` multi-corriere
- Booking spedizioni da Lovable
- Scrittura su TMWE (creazione clienti, modifica listini)
- Webhook TMWE → Lovable (fatture pagate)
- Match contatti rubrica TMWE ⇄ contacts Lovable

## Rischi & mitigazioni
- **Operatore non ha OAuth TMWE** → banner CTA, niente fallback silenzioso.
- **Falso match VAT** → conferma manuale obbligatoria.
- **Sandbox down** → UI mostra "ultima sync" da snapshot DB.
- **Costo cron** → cap 50/run, salta se `last_synced_at < 5h`.

## Verifica fine sprint
- `tmwe-partner-match` ritorna candidati per 3 partner test.
- Link partner→client persiste e snapshot popolato in <30s.
- Cron 6h gira due volte, `last_synced_at` aggiornato.
- `tmwe-quote-lookup` ritorna prezzo per listino assegnato.
- Pagina `/v2/tmwe/clients` mostra ≥1 riga con fatturato.