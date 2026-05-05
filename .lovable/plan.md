## Riepilogo

Cinque interventi paralleli sulla pagina Contatti CRM + ripristino visibilità email per `jose@tmwe.it` e per gli altri 3 operatori autorizzati.

---

## 1. Fix email invisibili (root cause)

**Diagnosi**: l'utente loggato `jose@tmwe.local` non ha record in `operators`. La RLS di `channel_messages` (`operator_id = ANY get_effective_operator_ids()`) restituisce array vuoto → 0 email visibili. Stessa cosa per WA/LinkedIn e ogni tabella che usa la stessa funzione.

**Azioni DB** (migration + insert):
- Allineare `authorized_users` ai 4 indirizzi: `jose.gabriel@tmwe.it`, `luca@tmwe.it`, `imane@tmwe.it`, `luigi@tmwe.it`.
- Per ciascuno dei 4: garantire record in `operators` legato al `user_id` dell'auth.users corrispondente. Aggiornare anche le 3 righe operator già esistenti con la nuova email `@tmwe.it` (oggi puntano a `@tmwe.local`).
- `is_admin = true` per `luca@tmwe.it` e per `jose.gabriel@tmwe.it`.
- Riassegnare le **10.011 email storiche**: i record in `channel_messages` di Luca/Imane/Luigi restano sui rispettivi operator (già corretti); a Jose ne assegniamo zero (vede solo le proprie + tutto in master mode da admin).
- Verifica post-migration: `SELECT count(*) FROM channel_messages` con sessione di Jose deve restituire 10.011 (admin master) o solo le sue (admin senza master mode attivo).

---

## 2. Filtro Origine "Non classificati"

`src/v2/ui/pages/explore/contacts/CRMFiltersSection.tsx` + reducer global filters: aggiungere voce sintetica `__unclassified__` nel dropdown Origine. Il loader `useCrmContactsAsCompanies` mappa `__unclassified__` → `origin IS NULL OR origin = ''`.

---

## 3. Toolbar lista compatta

`src/v2/ui/pages/explore/contacts/EntityListWithDetail.tsx` (+ `ListToolbar.tsx`): tutto su una riga, contatore "49/49 aziende" spostato a destra, etichette `Ordina:` ridotte a icona sotto 1100px, rimuovere `flex-wrap`. Il chip "Filtri attivi · ITALY" entra nel cluster destro.

---

## 4. CompanyCard arricchita

`src/components/.../CompanyCardList/CompanyCard.tsx` + loader contatti:
- Avatar 32px da `enrichment_data.logo_url` (fallback iniziali).
- Badge `Cliente` quando `lead_status = 'converted'`.
- Riga sub-meta: `Origine · Ultima Deep Search (relativeAge)`.
- Link `mailto:` / `tel:` compatti per email e telefono primario.
- Nessuna nuova chiamata AI: tutto da campi DB già presenti.

---

## 5. Audit + Fix Deep Search dai 3 puntini

Il menu emette `window.dispatchEvent(new CustomEvent('sherlock-launch'))` ma solo `NetworkPage` e `PartnerDetailInline` hanno il listener → click silente nelle altre pagine (Contatti CRM, Cestinone, BCA, RA, BulkActions, ContactDetail).

**Fix**: estrarre il listener in `src/hooks/useSherlockLauncher.ts`, montarlo come singleton in `App.tsx`, rimuovere i due listener locali per evitare doppia esecuzione. Audit completo di tutti i `MoreVertical/MoreHorizontal/⋯` per verificare che ognuno passi un `partner_id`/`contact_id` valido nell'evento.

---

## Ordine esecuzione
1. Diagnosi email → migration `operators` + `authorized_users` (richiede approvazione utente).
2. Singleton `useSherlockLauncher` in `App.tsx` + cleanup listener duplicati.
3. CompanyCard arricchita + loader.
4. Filtro "Non classificati".
5. Toolbar compatta.

## Dettagli tecnici

```text
operators (oggi)             →  operators (target)
─────────────────────────────────────────────────────
ae35ad39 luca@tmwe.local     →  ae35ad39 luca@tmwe.it       admin
27b60e53 imane@tmwe.local    →  27b60e53 imane@tmwe.it
fe1db58a luigi@tmwe.local    →  fe1db58a luigi@tmwe.it
(missing)                    →  NEW      jose.gabriel@tmwe.it admin
```

`channel_messages.operator_id` invariato — solo l'email dell'operator cambia, gli UUID sono stabili.

## Out of scope
- Refactor toolbar in più componenti.
- Merge automatico origini duplicate (già coperto da `BulkMergeOriginsDialog`).
- UI per gestione operators (resta su admin DB).
