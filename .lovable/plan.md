# Piano: dedup contatti + layout responsive lista partner

## Problema 1 — Contatti duplicati (DB, gravissimo)

Indagine su Supabase mostra che la tabella `partner_contacts` ha **107.132 righe duplicate su 136.958 totali** (~78%). Esempio Radiant Global Logistics: il referente "Randy Emmons / Manager / bwi.intl@dbaco.com" è presente **4 volte** con id diversi ma stessi dati. Lo stesso pattern colpisce migliaia di partner (29.146 gruppi duplicati). Per questo nel pannello dettaglio l'utente vede 4× lo stesso contatto.

Solo lo 0.5% dei gruppi duplicati (148 su 29.146) ha qualche differenza marginale su `direct_phone`/`mobile`/`title` — quindi è sicuro fare merge tenendo la riga più vecchia (`MIN(created_at)`) e copiando, dove disponibili, gli eventuali campi non-null delle altre prima di eliminarle.

Causa probabile: re-import WCA ripetuti senza upsert idempotente. Va indagato in seconda battuta, ma intanto bonifichiamo i dati.

### Cosa farò
1. **Migrazione SQL `dedup_partner_contacts`**:
   - Per ogni gruppo `(partner_id, lower(email), lower(name))` con count > 1:
     - Identifico la riga "winner" = quella con `created_at` più antica (a parità, `id` minore).
     - Per i campi `title`, `direct_phone`, `mobile`, `contact_alias`, `is_primary`, copio sul winner il primo valore non-null trovato negli altri duplicati (UPDATE coalesce).
     - Soft-delete delle righe duplicate (il trigger globale `no-physical-delete` converte automaticamente DELETE → UPDATE `deleted_at`).
   - Aggiungo un **vincolo UNIQUE parziale** per prevenire la ricomparsa:
     `CREATE UNIQUE INDEX partner_contacts_dedup_uniq ON partner_contacts (partner_id, lower(email), lower(name)) WHERE deleted_at IS NULL;`
   - La migrazione viene eseguita come singola transazione, con un report finale (RAISE NOTICE) di quante righe sono state deduplicate.

2. **Hardening upsert lato applicazione**: cerco i punti che inseriscono in `partner_contacts` (probabilmente edge function di sync WCA / scraper) e verifico che usino `ON CONFLICT (partner_id, lower(email), lower(name)) DO UPDATE` invece di INSERT puri. Questa è una verifica di follow-up che annoto a parte: il vincolo UNIQUE da solo già blocca i nuovi duplicati (al massimo farà fallire le insert mal scritte, segnalando il bug).

## Problema 2 — Layout non responsive (UI)

`src/v2/ui/atoms/EntityRow.tsx` usa una grid a colonne **fisse**:
```
grid-cols-[44px_56px_minmax(0,1fr)_200px_96px]
```
Totale colonne fisse = 396 px (44+56+200+96). Quando il pannello dettaglio è aperto a destra, la lista a sinistra è 1/3 di ~1074 px ≈ **358 px**. Risultato: la colonna titolo (`minmax(0,1fr)`) ha larghezza ≈ 0, badge "Toronto + WCA + 25 anni + clock" si sovrappongono come nello screenshot.

### Cosa farò
1. **Layout adattivo a 2 modalità in `EntityRow.tsx`**:
   - Aggiungo prop `compact?: boolean` (oppure rilevo via `@container` query Tailwind).
   - Modalità **compact** (larghezza < ~480 px): uso layout flex verticale a 2 righe per cella. Riga 1 = checkbox + bandiera + titolo + actions. Riga 2 = sub-title + città + canali + score. Niente più colonne fisse → no overflow.
   - Modalità **wide** (≥ 480 px): mantengo la grid attuale a 5 colonne.
2. **Container query**: avvolgo la lista (`CompanyCardList`) in un `@container` Tailwind così ogni riga si adatta automaticamente alla larghezza del pannello senza dover cablare la prop dall'alto. Aggiungo `@container/row` sulla wrapper e `@[480px]/row:` sulle classi grid in `EntityRow`.
3. **Riduco la colonna città/canali in compact**: bandiera + ISO sotto il titolo, città in lato destro più stretto (es. 120 px invece di 200), oppure città inline come chip.
4. Verifico anche `CompanyCard.tsx` (titleSlot): in compact alcuni badge ("Anni WCA 25", "BCA", lead status) possono andare a capo. Aggiungo `flex-wrap` sul container del titolo per evitare che spingano fuori la riga.

## Sezione tecnica

### File toccati
- **NEW** `supabase/migrations/<timestamp>_dedup_partner_contacts.sql` — merge + UNIQUE index parziale.
- `src/v2/ui/atoms/EntityRow.tsx` — layout responsive a container query.
- `src/v2/ui/molecules/CompanyCardList/CompanyCardList.tsx` — wrapper `@container/row`.
- `src/v2/ui/molecules/CompanyCardList/CompanyCard.tsx` — `flex-wrap` su title row.

### Nessuna modifica a
- DAL `getPartner` / `usePartner` — la query è corretta, il problema è alla sorgente dati. Una volta deduplicati, i contatti compariranno uno solo a partner.
- Edge function di sync WCA — verifica annotata come follow-up; il UNIQUE index è già una rete di sicurezza.

### Verifica post-migrazione
Dopo la migrazione eseguo:
```sql
SELECT count(*) FROM partner_contacts WHERE deleted_at IS NULL;            -- atteso ~29.826
SELECT count(*) FROM (
  SELECT 1 FROM partner_contacts WHERE deleted_at IS NULL
  GROUP BY partner_id, lower(email), lower(name) HAVING count(*) > 1
) x;                                                                        -- atteso 0
```

### Memoria
Aggiorno `mem://features/p5-crm-lifecycle-2026-04-28.md` (o nuova memoria `mem://tech/partner-contacts-dedup-2026-05-02.md`) con: vincolo UNIQUE attivo, criterio merge, obbligo upsert idempotente per future insert.

## Domande aperte (zero blocker, decido in build se non rispondi)
- **Backup**: faccio backup tabella in `partner_contacts_backup_2026_05_02` prima della dedup? Consigliato sì, lo includo di default.
- **Soft vs hard delete dei duplicati**: il trigger globale forza soft-delete → vanno solo "nascosti", non spariscono fisicamente. Va benissimo.
