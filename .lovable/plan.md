## Obiettivo

Eliminare la doppia vista "Card-azienda / Classica" su **WCA Partner** e **CRM**: una sola vista ovunque, con la stessa ergonomia dei **Biglietti da visita** (lista a sinistra con checkbox + dettaglio a destra), card densa di informazioni e barra strumenti che permette di **ordinare e filtrare per ogni dato visibile**.

---

## 1. Tutti i dati che possiamo mostrare e usare per filtrare/ordinare

Per ogni partner WCA (e l'equivalente CRM dove pertinente) abbiamo già in DB:

**Identità**
- Bandiera + codice paese (ISO) + nome paese
- Nome azienda + alias
- Logo (`logo_url`) — fallback iniziali
- Tipo ufficio (`office_type`: HQ / Branch)
- Tipo partner (`partner_type`)
- Città · Indirizzo

**Affiliazione WCA**
- 🏆 Anni in WCA (da `member_since`)
- Scadenza membership (`membership_expires`) — badge "scade fra X mesi"
- Network di appartenenza (`partner_networks[]`: WCA, FCL, Pet Movers, …) — chip multipli
- ⭐ Rating WCA (0-5 → score 0-100)

**Contatti & canali**
- Numero referenti (`partner_contacts.length`)
- Referente principale (nome + ruolo)
- Canali aggregati: 📧 email · 💬 WhatsApp · 🔗 LinkedIn · ☎ telefono · 🌐 sito
- Email/telefono diretti azienda

**Stato commerciale**
- `lead_status`: new / contacted / qualified / holding / archived / blacklisted
- ✈️ Holding pattern (badge pulsante)
- ⏱ Ultimo contatto (`last_interaction_at`) + recency color (verde <7gg, giallo <30gg, rosso >90gg)
- # interazioni (`interaction_count`)
- ⭐ Preferito (`is_favorite`)
- 🟢/⚫ Attivo (`is_active`)

**Arricchimento & qualità dato**
- 🔍 Deep Search fatto (`enriched_at` valorizzato) + data
- Confidence enrichment
- Ha logo · Ha sito · Ha LinkedIn · Ha descrizione

**Servizi & certificazioni** (dai join già caricati)
- `partner_services[]` (Air / Sea / Customs / Warehousing…) → chip
- `partner_certifications[]` (AEO, ISO9001…) → chip

**BCA**
- 🪪 Ha biglietto da visita collegato (`hasBca`) + numero biglietti
- Match confidence se matchato

**Tutti questi campi diventano sia colonne visibili che filtri/ordinatori** nella toolbar superiore.

---

## 2. Layout unico — stesso modello dei Biglietti da visita

```text
┌──────────────────────────── PAGINA (WCA / CRM / BCA) ─────────────────────────────┐
│ TOOLBAR                                                                            │
│ [☑ Tutti 50/12k]  🔎 cerca…   [Sort: Nome ▾]  [⚙ Filtri]   [⋯ Bulk actions]      │
│ Ordina: Nome · Città · Paese · Anni WCA · Score · Ultimo contatto · # contatti    │
│ Filtri attivi (chip rimovibili): 🇷🇴 RO · ✈ in attesa · 🏆≥3 anni · ha email     │
├─────────────────────────────────────────────┬──────────────────────────────────────┤
│ LISTA (40-45%)                              │ DETTAGLIO (55-60%)                   │
│ ┌─────────────────────────────────────────┐ │  Stesso pannello dei Biglietti:     │
│ │ ☑ │ 🇷🇴 │ Side Logistic SRL  [WCA] 🏆3 │ │  - Header (nome, paese, città)      │
│ │ RO│    │ Ms. Buharu · Transport +1     │ │  - Azioni rapide: Email/WA/Call/Web │
│ │   │    │ Cluj-Napoca  📧💬🔗  ⭐72     │ │  - Cockpit / Deep / LinkedIn/Camp.  │
│ │   │    │ ⏱ 3gg fa · ✈                 │ │  - Lista contatti (4)               │
│ ├─────────────────────────────────────────┤ │  - Timeline interazioni             │
│ │ ☑ │ 🇷🇴 │ Black Sea Brokers …          │ │  - Servizi · Certificazioni · Reti  │
│ └─────────────────────────────────────────┘ │                                     │
│  +carica altri…                             │  (vuoto = empty state con icona)    │
└─────────────────────────────────────────────┴──────────────────────────────────────┘
```

**Selezione multipla** (come BCA): se sono selezionati 2+, il pannello destro mostra il **bulk panel** ("N elementi selezionati · Aggiungi al Cockpit · Deep Search batch · Crea campagna · Soft-delete") invece del dettaglio singolo.

---

## 3. Card riga — anatomia (densità BCA)

```text
☑  🇷🇴   COMPANY NAME           [WCA] [Network] 🏆3  ⭐72   🌟         ⋯
   RO    Ms. Ilaria Buharu · Transport Manager  +3 contatti
         📍 Cluj-Napoca       📧 💬 🔗 ☎ 🌐    ⏱ 3gg · ✈ in attesa
```

**6 zone**:
1. Checkbox (selezione multipla)
2. Bandiera 32px + ISO
3. Identità: nome + chip (WCA, network, BCA, partner_type, HQ/Branch)
4. Sub-header: referente principale · ruolo · "+N contatti"
5. Footer riga: città · canali attivi · score pill · recency · ✈ holding · ⭐ fav
6. Azioni: ⋯ (apri, preferito, deep, soft-delete)

Click sul body → seleziona e apre il dettaglio. Click sul checkbox → multi-select, pannello destro diventa bulk.

---

## 4. Toolbar superiore — ordinamento & filtri completi

**Pillole sort** (toggle asc/desc): Nome · Paese · Città · Anni WCA · Score · Ultimo contatto · # contatti · Ultima sync.

**Pannello filtri** (drawer "⚙ Filtri" che si apre da destra) — multi-selezione:
- Paese (multi)
- Network WCA (chip)
- Tipo ufficio (HQ / Branch)
- `lead_status` (multi)
- ✈ Holding pattern (in / out / tutti)
- Anni WCA (range slider)
- Score / Rating (range)
- Ha email · Ha telefono · Ha LinkedIn · Ha sito · Ha logo (toggle)
- Ha BCA collegato
- Deep Search fatto (sì / no / mai)
- Servizi (multi-chip da `partner_services`)
- Certificazioni (multi-chip)
- Ultimo contatto (mai / <7g / <30g / >90g)
- Preferiti

I filtri attivi appaiono come **chip rimovibili** sotto la toolbar (riga 3) — uguale alla `ActiveFiltersBar` esistente.

---

## 5. Unificazione delle viste (rimozione "Classica")

- **Eliminare** il toggle "Card-azienda / Classica" su `NetworkPage` e `ContactsPage`.
- La vista Card diventa **l'unica vista**.
- Le funzionalità della "Classica" che mancano (sync WCA, Deep Search canvas, mappa) restano accessibili tramite **azioni nella toolbar** (`⋯ Bulk` + pulsanti dedicati `Sincronizza`, `Mappa`, `Deep Search`) — non come vista separata.
- Componenti `Operations`, `ContactListPanel` classici → conservati ma non più routati (fade-out graduale).

---

## 6. Dettaglio a destra (Golden Layout esteso a WCA)

Su `NetworkPage` introduciamo lo stesso `GoldenLayout` già usato in `ContactsPage`:
- Lista a sinistra (la nostra `CompanyCardList` con checkbox).
- Drawer a destra: riusa il **Partner Detail Drawer** esistente (già visibile nello screenshot 2 — Comunicazione, Azioni AI, Contatti, ecc.).
- Quando 2+ selezionati → **BulkActionsPanel** condiviso (clone della UI BCA dello screenshot 3): "N selezionati · Aggiungi al Cockpit · Deep Search batch · Crea campagna · Soft-delete".

---

## 7. Sezione tecnica (per Lovable/dev)

**File da creare**
- `src/v2/ui/molecules/CompanyCardList/CompanyCardSelectable.tsx` — variante con checkbox controllato + click body = select.
- `src/v2/ui/organisms/EntityListWithDetail.tsx` — wrapper riusabile (lista virtualizzata + GoldenLayout + bulk panel).
- `src/v2/ui/organisms/BulkActionsPanel.tsx` — pannello destro per N selezionati (Cockpit / Deep batch / Campagna / Soft-delete).
- `src/v2/ui/organisms/EntityFiltersDrawer.tsx` — drawer filtri "⚙" con tutti i predicati elencati al §4 (definizione dei filtri passata come schema dichiarativo per riusarlo su WCA/CRM/BCA).
- `src/v2/hooks/companyList/useCompanySelection.ts` — Set<id> + helpers selectAll / clear / toggle.
- `src/v2/hooks/companyList/useCompanyFilters.ts` — predicati pure-function applicati lato client sopra `companies` + chips derivati.

**File da estendere**
- `CompanyEntity` (`types.ts`): aggiungere `lastInteractionAt`, `interactionCount`, `leadStatus`, `isFavorite`, `services[]`, `certifications[]`, `networks[]`, `enrichedAt`, `membershipExpires`, `officeType`, `partnerType`, `hasWebsite`, `hasLinkedin`, `bcaCount`.
- `useWcaPartnersAsCompanies` + `useCrmContactsAsCompanies`: popolare i nuovi campi (i join sono già caricati dalla DAL).
- `EntityRow`: 6° slot opzionale per riga "footer" (recency + holding + fav).
- `NetworkPage`: rimuovere toggle, montare `EntityListWithDetail` con `source="wca"`.
- `ContactsPage`: idem, con `source="crm"`.
- `ListToolbar`: aggiungere bottone "⚙ Filtri" che apre `EntityFiltersDrawer`; aggiungere pillole sort estese.

**Vincoli architetturali** (rispettati)
- Tutta la logica nei hook (`src/v2/hooks/companyList/`), UI logic-less.
- Nessuna chiamata diretta a `supabase.from(...)`: solo DAL `src/data/partners.ts` / `src/data/contacts.ts` (già fatto).
- Nessuna nuova migration: tutti i campi richiesti esistono già in DB.
- Query keys centralizzati in `queryKeys.ts`.
- Filtri lato client su pagine già caricate (per WCA: il dataset è scoped sui paesi selezionati, per CRM: su pagine paginated).

**Out of scope** (questa iterazione)
- Modifiche a edge functions, RLS, schema DB.
- Modifiche al drawer di dettaglio partner — viene riusato così com'è.
- Modifiche alla logica holding pattern / lead status (solo visualizzazione).

---

## 8. Domanda di verifica

Confermi: **vista unica ovunque** (eliminiamo "Classica" da WCA e CRM) e **drawer dettaglio = identico ai Biglietti da visita**, con bulk panel quando selezioni 2+?
