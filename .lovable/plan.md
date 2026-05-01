## Obiettivo

Le tre liste — **WCA Partner**, **Contatti CRM**, **Biglietti da visita** — devono usare **lo stesso template visivo** ispirato alla card BCA (`ExpandedCardItem`), ricco e leggibile. Sopra ogni lista una **toolbar di ordinamento + filtri rapidi** identica. Niente bandiere doppie, allineamenti a colonne fisse, dettagli sempre visibili (città, contatto principale, canali, status, anni WCA, evento BCA, score).

## Diagnosi del problema attuale

Dallo screenshot `/v2/explore/network` → **Classica**:
- Riga troppo "magra": solo nome azienda + bandiera + città a destra. Niente referente, niente score, niente canali oltre a un'icona email grigia.
- Nessuna toolbar in alto: il chip "Ordine: Nome" è inerte; non si può ordinare per città, per anni WCA, per ultimo contatto, per stato.
- Nessun chip di filtro attivo visibile sulla lista (solo nella sidebar).
- Layout a "due blocchi" (sinistra/destra) senza griglia: città fluttua, le icone sono mute, non si capisce cosa sia cliccabile.
- Vista "Card-azienda" esiste (`CompanyCard`) ma è ancora minimale: usa flag piccolo inline, niente colonna città dedicata, niente score, niente toolbar.

## Template unico — "BCA Expanded Row"

Layout a **5 colonne fisse** allineate (grid CSS, non flex liquidi) per dare un risultato tabellare ma elegante come le BCA:

```text
┌────┬──────┬─────────────────────────────────────────┬──────────────────────┬──────────┐
│ ☑  │ 🏳   │ COMPANY NAME  [WCA 🏆12] [BCA] ✈        │ Shanghai · CN        │  ⋯ menu  │
│    │ ISO  │ Mario Rossi · Sales Manager             │ 📧 💬 🔗 ☎  · score  │ ▸ apri   │
└────┴──────┴─────────────────────────────────────────┴──────────────────────┴──────────┘
  44px  56px            flex (min 0)                          200px              90px
```

Regole rigide:
- **Una sola bandiera per riga**, 28-32px, con codice ISO sotto (atomo `EntityRowFlag` già esistente).
- Striscia verticale colorata 3px a sinistra (come BCA `accent.border`) → tono dipende dalla sorgente:
  - WCA → `primary`
  - CRM → `chart-2`
  - BCA → gradient esistente (matched/unmatched)
- Riga 1 header: nome azienda **bold**, badge sorgente, badge `WCA 🏆<anni>`, badge `BCA` se ha biglietti, `✈` pulsante se in holding.
- Riga 2 sub-header: referente principale + ruolo (in CRM/BCA) o "Nessun referente" in grigio (WCA senza contatti).
- Colonna città: città in alto, sotto riga icone canali (Mail/WA/LinkedIn/Phone/Web) + `score 0-100` in pill sottile.
- Colonna azioni: Quick actions (apri drawer, ⋯ menu) — riusabile da `BCAQuickActions`.

Espansione (chevron a sinistra del checkbox) mostra le **sub-card contatti** già esistenti (`ContactSubCard`) in grid 2 colonne.

## Toolbar unificata — sopra ogni lista

Componente nuovo `ListToolbar` (atomo V2), incollato in cima alle tre viste:

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ ☑ Tutti (50/12k)   ↕ Ordina ▾   🔎 Cerca…   ⚙ Filtri attivi: [3]      │
│ Ordina per:  Nome · Città · Anni WCA · Ultimo contatto · Score · Stato │
│ Chips filtri: [🇨🇳 China ✕] [Con email ✕] [Holding ✕]                  │
└─────────────────────────────────────────────────────────────────────────┘
```

- Bottoni d'ordinamento sono **pillole cliccabili** con freccia ▲▼ per direzione.
- Cerca locale (debounced) sopra l'elenco visibile.
- Chips filtri attivi (riusa `ActiveFiltersBar` già esistente) — cliccando ✕ li rimuove.
- Persistenza ordine/filtri in `localStorage` per chiave (`list:wca`, `list:crm`, `list:bca`).

## Mappatura colonne per sorgente

| Slot         | WCA Partner                  | CRM Contact                | BCA                         |
|--------------|------------------------------|----------------------------|-----------------------------|
| Bandiera     | `country_code` partner       | `country` contatto         | `country` partner/biglietto |
| Titolo       | `company_name`               | `company` o nome contatto  | `company_name` BCA          |
| Badge        | `WCA 🏆 anni` + alias        | `Lead status` colorato     | `match_status` + WCA anno   |
| Sub-header   | Referente top (se presente)  | `name · position`          | `contact_name · position`   |
| Città        | `city` partner               | `city` contatto            | `location` o partner.city   |
| Canali       | email/phone/web partner      | email/phone/wa/li contatto | email/phone biglietto       |
| Score        | `rating * 20`                | `lead_score` 0-100         | `match_confidence`          |
| Sort options | Nome · Città · Anni · Score  | Nome · Città · Score · Stato · Ultimo contatto | Nome · Evento · Match · Data |

## File interessati

**Nuovi (atomi V2 condivisi)**
- `src/v2/ui/atoms/EntityRow.tsx` — riga template a 5 colonne (sostituisce header `CompanyCard`).
- `src/v2/ui/molecules/ListToolbar/ListToolbar.tsx` — toolbar ordinamento + ricerca + chips.
- `src/v2/ui/molecules/ListToolbar/useListSort.ts` — hook stato (sortKey, sortDir) con persistenza.
- `src/v2/ui/atoms/ScorePill.tsx` — pill score 0-100 con tono dinamico.

**Refactor (presentazione, niente logica business)**
- `src/v2/ui/molecules/CompanyCardList/CompanyCard.tsx` → header riscritto su `EntityRow`, sub-card contatti invariate.
- `src/v2/ui/molecules/CompanyCardList/types.ts` → aggiungere `score?: number`, `primaryContact?: {name, role}`, `channels?: ContactChannels`, `wcaYears?: number`, `hasBca?: boolean` a `CompanyEntity`.
- `src/v2/hooks/companyList/useWcaPartnersAsCompanies.ts` → popolare i nuovi campi (rating→score, top contatto, canali aggregati, flag BCA).
- `src/v2/hooks/companyList/useCrmContactsAsCompanies.ts` → idem per CRM.
- `src/v2/ui/pages/NetworkPage.tsx` → `ListToolbar` sopra `CompanyCardList`, default view = "Card-azienda" (rimuovere toggle `Classica` o relegare a tab nascosto). 
- `src/v2/ui/pages/CRMPage.tsx` → stessa toolbar + `CompanyCardList source="crm"`.
- `src/components/contacts/bca/BCAUnifiedHub.tsx` → adottare `ListToolbar` (sostituire la barra ordinamento esistente) per coerenza.

**Rimozioni / pulizia**
- `src/components/operations/PartnerVirtualList.tsx` (riga "Classica" attuale) → marcato deprecato; vista "Classica" rimossa dal toggle in `NetworkPage` (codice preservato dietro `?legacy=1` per debug).

## Performance
- Tutto resta dentro `CompanyCardList` virtualizzato (`@tanstack/react-virtual`).
- Score/canali calcolati nei mapper hook (memo) — nessun fetch extra.
- Espansione lazy invariata.

## Ordine di lavoro consigliato
1. Atomi nuovi: `EntityRow`, `ScorePill`, `ListToolbar`, `useListSort`.
2. Estensione `CompanyEntity` + 2 hook adapter (WCA + CRM).
3. Riscrittura header `CompanyCard` su `EntityRow`.
4. Integrazione `ListToolbar` in NetworkPage, CRMPage, BCAUnifiedHub.
5. Smoke test visivo + screenshot QA.

Confermi e procediamo? Posso anche partire **solo dalla WCA** (Fase 1-3 + integrazione su NetworkPage) per validare lo stile prima di replicarlo su CRM e BCA.