
## Confronto pannelli di dettaglio BCA

Esistono **2 detail panel** e **3 viste hub** che leggono tutti dalla stessa tabella `business_cards`. Ecco cosa fa cosa.

### Detail Panel — solo 2 file, uno è wrapper dell'altro

| File | Cosa contiene | Usato da |
|---|---|---|
| `BCADetailPanel.tsx` (213 righe) — esporta `BusinessCardDetailPanel` | Header azienda + logo partner WCA matchato · foto biglietto · **azioni rapide** (Email, WhatsApp, Chiama, Workspace) · `BCASmartActions` · `BCAOcrConfidence` · `BCACreateContact` · dettagli contatto · evento/data/luogo · stato match + confidenza · tags · note · "Cerca logo Google" · `ManualPartnerMatcher` (ricerca + conferma match) | `BusinessCardsHub` (CRM legacy) |
| `BCAUnifiedDetailPanel.tsx` (248 righe) | **Wrappa** `BusinessCardDetailPanel` aggiungendo SOPRA una hero grid 2×2 di "Azioni intelligenti" (Cockpit · Deep Search · LinkedIn · Campagna). Ogni tile è un drop target indipendente con ref-counter per non flickerare | `BCAUnifiedHub` (Pipeline /v2/pipeline/biglietti) |

**Conclusione:** non c'è duplicazione di logica. `BCAUnifiedDetailPanel` = `BCADetailPanel` + hero drop-target. È già il superset corretto.

### Viste Hub — qui sì c'è duplicazione

| File | Layout | Filtro evento | Bulk Delete | Upload | Detail panel |
|---|---|---|---|---|---|
| `BCAUnifiedHub` (Pipeline) | Gruppi azienda + 3 view + Quality + Timeline + Sync | ❌ (manca) | ❌ (manca) | ❌ | `BCAUnifiedDetailPanel` |
| `BusinessCardsHub` (CRM tab legacy) | Lista flat + 3 view | ✅ (Select inline) | ✅ (in `UnifiedBulkActionBar`) | ✅ DropZone + Dialog evento | `BusinessCardDetailPanel` (no smart actions) |
| `BusinessCardsView` (Operations) | Identico a `BCAUnifiedHub` ma senza panel | ❌ | ❌ | ❌ | nessuno |

### Cosa manca a `BCAUnifiedHub` (target ufficiale)

1. **Bulk Delete** — esiste in `BusinessCardsHub.handleBulkDelete` (riga 109): chiama `deleteBusinessCards(ids)` da `@/data/businessCards` + conferma + invalidate. Va portato uguale in `BCAUnifiedHub` e passato come `onDelete` al `UnifiedBulkActionBar` (già presente in JSX, basta aggiungere la prop).
2. **Filtro Evento dentro la sidebar** — la `BCAFiltersSection` globale (`src/components/global/filters-drawer/BCAFiltersSection.tsx`) ha già "Stato match" + "Evento" come ChipGroup, ma è disconnessa dal `BcaFiltersContext` (usa state locale). Va cablata al provider `BcaFiltersContext` così che i chip cambino realmente `g.filtered`. In alternativa va creata una sezione equivalente in `BCAFiltersRailContent.tsx` (già esistente, da estendere) collegata al contesto.
3. **Rimozione Upload** — eliminare `BCAUpload.tsx` (DropZone + useUploadAndParse) e ogni traccia dialog evento. Visto che l'unico consumer è `BusinessCardsHub`, la rimozione è naturale insieme alla deprecazione di quel hub.

## Piano operativo

### Step 1 — Estendere `BCAUnifiedHub` con Bulk Delete
- Importare `deleteBusinessCards` da `@/data/businessCards`.
- Aggiungere `handleBulkDelete` (conferma → delete → toast → reset selezione → `qc.invalidateQueries(queryKeys.businessCards.all)`).
- Passare `onDelete={handleBulkDelete}` al `<UnifiedBulkActionBar>`.

### Step 2 — Filtro Evento nella side rail
- In `BcaFiltersContext.tsx` esporre già `eventFilter` / `setEventFilter` (verificare; se assente, aggiungere allo stato e applicarlo dentro `useBcaGrouping`).
- In `BCAFiltersRailContent.tsx` aggiungere una `FilterSection icon={Users} label="Evento"` con chips dinamici derivati da `cards.map(c => c.event_name)` (lista unica + count), collegati al setter del contesto.
- Rimuovere il "Sync"-only e mantenere solo i filtri (la sync resta nella toolbar dell'hub).

### Step 3 — Rimuovere upload e CRM legacy hub
- Eliminare `src/components/contacts/BusinessCardsHub.tsx`.
- Eliminare `src/components/contacts/bca/BCAUpload.tsx` (DropZone + useUploadAndParse).
- In `src/v2/ui/pages/CRMPage.tsx`: rimuovere `lazy(() => import("@/components/contacts/BusinessCardsHub"))` e l'eventuale tab "Biglietti" del CRM, oppure sostituirla con un redirect a `/v2/pipeline/biglietti` (consigliato: redirect, così se l'utente arriva da link vecchi finisce sull'hub canonico).
- Rimuovere import correlati da `CRMPage` e ripulire eventuali tab labels.

### Step 4 — Memoria
- Aggiornare `mem://features/bca-quality-and-automation.md` (o creare nuova memoria `bca-canonical-hub`) con: "BCAUnifiedHub è la vista ufficiale; BusinessCardsHub e BCAUpload deprecati e rimossi; upload biglietti non più disponibile dall'UI (resta `parse-business-card` edge function lato API se serve)."

## Note tecniche

- `BusinessCardsView` (Operations) NON viene toccato in questo piano — è già senza panel e gestito separatamente. Se vuoi consolidarlo anche lui, fai sapere.
- `BusinessCardsViewV2` orfano (78 righe, Network) lo lascio com'è salvo richiesta esplicita.
- Il pannello `BCAUnifiedDetailPanel` resta invariato: è già la versione completa.
- Bulk Delete passa per `deleteBusinessCards` che fa `DELETE` SQL — il trigger globale di soft-delete (memoria `no-physical-delete`) lo intercetta automaticamente in `UPDATE deleted_at`, quindi nessun rischio di perdita dati.

Confermi di procedere con questo piano?
