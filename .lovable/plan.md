## Obiettivo

Rimuovere completamente il "matching per dominio" sui mittenti email. Un'email in entrata ha un unico `from_address`. Se quell'indirizzo esatto esiste come partner / partner_contact / imported_contact / prospect → associazione 1:1. Altrimenti il mittente resta semplicemente l'email, **senza** inventare partner per somiglianza di dominio.

## Cosa cambia

### 1. `supabase/functions/check-inbox/dbOperations.ts` — `matchSender`
- Rimuovere tutto il blocco `if (domain) { … domainPattern … }` (righe 86-121).
- Rimuovere il concetto di `match_confidence` (`'domain' | 'domain_ambiguous'`). Tipo ridotto a `'exact' | 'none'`.
- L'RPC `match_email_sender`: ignorare i risultati con suffisso `_domain` (trattarli come `none`), oppure passare un flag che disabiliti la branch dominio. Scelta: filtrare lato TS — se `r.source_type` finisce in `_domain` ⇒ `none`.
- Quando `none`: `source_type='unknown'`, `source_id=null`, `partner_id=null`, `name=email` (l'address stesso, così l'UI mostra l'address reale).

### 2. Trigger DB `on_inbound_message`
Nuova migrazione che semplifica la parte introdotta il 2026-05-05:
- Rimuovere il ramo `IF v_match_confidence IN ('domain','domain_ambiguous') THEN v_safe_partner_id := NULL`.
- `partner_id` dell'activity = `NEW.partner_id` (che ora è già garantito esatto o null dalla function).
- Mantenere intatti i filtri newsletter/spam/no-reply (utili e indipendenti).

### 3. UI `src/components/agenda/AgendaDayDetail.tsx`
- Rimuovere il badge giallo "da verificare" basato su `match_confidence === 'domain'`.
- Mantenere la visualizzazione del `from_address` reale sotto il nome (è una buona aggiunta).

### 4. Pulizia attività esistenti errate
Le 4 attività pendenti oggi associate per dominio vanno corrette: scollegare il `partner_id` dove la mail reale non corrisponde all'`email` del partner. Nuova query SQL puntuale (insert tool, non migration).

### 5. Memoria
- Aggiornare `mem/features/agenda-sender-attribution.md`: rimuovere riferimenti a `match_confidence` e domain matching. Politica nuova: **1 email = 1 mittente, match solo esatto**.
- Aggiornare `mem/index.md` di conseguenza.

## Cosa NON cambia
- Filtri newsletter / no-reply nel trigger.
- Visualizzazione del `from_address` sotto il nome partner in agenda.
- Enrichment queue per mittenti sconosciuti (resta utile).
- check-inbox download/IMAP (intoccabile per memoria).

## File toccati
- `supabase/functions/check-inbox/dbOperations.ts` (~40 righe rimosse)
- nuova migrazione SQL (~30 righe) per `on_inbound_message`
- `src/components/agenda/AgendaDayDetail.tsx` (~10 righe rimosse)
- query insert one-shot per le 4 activities sbagliate
- `mem/features/agenda-sender-attribution.md` + `mem/index.md`

Confermi e procedo?
