# Esplora · WCA Partner — audit e standard "maschera elenco→dettaglio"

Questa maschera diventa il **template di riferimento** per tutte le pagine che elencano entità
(Contatti CRM, Biglietti, Inbox, Rubriche). Non si butta via nulla: si riordina, si toglie il
rumore cromatico e si eliminano i doppioni di comando.

## Componenti reali oggi in pagina (censimento)

Livello guscio
- `NetworkPage.tsx` (185 righe) — solo orchestrazione: dati, deep-link `?partnerId`, eventi
  globali (`v2-open-partner`, `network-select-partner`, mission drawer), 3 bulk action.
- `EntityListWithDetail.tsx` (431) — guscio condiviso WCA/CRM/BCA: sort, ricerca, filtri locali,
  filtro holding, selezione multipla, chip, auto-focus primo record.
- `GoldenLayout.tsx` — split 40/60 ridimensionabile e persistito; su mobile dettaglio full-screen.

Colonna sinistra
- `ListToolbar` (234) — conteggio, ricerca, dropdown ordinamento, pillola Holding, slot azioni.
- Pulsanti "Seleziona tutto" e "Filtri" iniettati dal guscio.
- `ActiveFiltersBar` — chip filtri attivi (globali + locali).
- `CompanyCardList` → `CompanyCard` (542) + `ContactSubCard` — la card ricca.
- `EntityFiltersDrawer` (367) — filtri **locali** in drawer.

Colonna destra
- `PartnerDetailInline` (144) → `PartnerDetailFull` → `PartnerDetailHeader` (203),
  `PartnerDetailInfo` (420), `PartnerDetailActivity` (247).
- `BulkActionsPanel` (179) — sostituisce il dettaglio quando c'è ≥1 selezione.
- `SherlockLauncherDialog` (livelli 1/2/3).

Fuori pagina ma sempre presenti
- Top bar globale + `ExploreContextHeader` (cycler sezione + contatore).
- `ContextFiltersRail` → `NetworkFiltersSection` (372) — filtri **globali** (paesi, ricerca,
  qualità dati, disponibilità contatti) nella sidebar destra a scomparsa.
- Banner blacklist scaduta, FloatingCoPilot vocale.

## Problemi trovati (audit)

1. **Due sistemi di filtro concorrenti.** `NetworkFiltersSection` (globale, sidebar) e
   `EntityFiltersDrawer` (locale, drawer dal pulsante "Filtri" in toolbar) filtrano le stesse
   dimensioni con stati diversi. L'utente non sa quale sta usando; i chip mescolano le due fonti
   con prefissi diversi (`country:` vs `local-country:`).
2. **Tre livelli di ricerca sovrapposti**: ricerca globale nella sidebar filtri, ricerca locale
   in toolbar, ricerca ⌘K di sistema.
3. **Comportamento della selezione ambiguo.** Con **una sola** checkbox spuntata il pannello
   destro passa già a `BulkActionsPanel` e il dettaglio del partner sparisce: comportamento
   sorprendente. La soglia bulk dovrebbe essere ≥2 (o pannello bulk in overlay basso).
4. **Auto-focus del primo record** al caricamento: apre un dettaglio non richiesto e compete con
   il deep-link `?partnerId`.
5. **Rumore cromatico nella card**: fino a 9 badge/chip colorati per riga (WCA, trofeo anni, BCA,
   blacklist, cliente, lead status, Sherlock, stella, aereo) + email in blu, telefono in
   `chart-3`, città, arricchito in verde, origine, recency a 4 toni, ScorePill, icone canale.
   Con 49 righe a schermo il colore perde ogni significato.
6. **Bandiera + logo + checkbox** nella stessa colonna sinistra: tre elementi visivi diversi in
   64px, il logo spesso non carica (si nasconde e lascia un buco).
7. **Colori grezzi residui** fuori palette: `ListToolbar` 9 occorrenze (pillola holding
   emerald/amber/sky), `PartnerDetailActivity` 10, `PartnerDetailHeader` 2, `BulkActionsPanel` 1,
   più `text-amber-500` nell'icona Sherlock del dettaglio.
8. **Comandi sparsi su 4 file**: top bar, riga toolbar, menu "…" di ogni card, header del
   dettaglio (3 icone Sherlock separate).
9. **Il dettaglio non ha un titolo identitario** coerente: solo nome in 14px, mentre la card
   sinistra urla in 17px extrabold maiuscolo.
10. **Contratto di pagina non rispettato**: nessun `StandardPageFrame`, header nascosto
    (`hideHeader`), quindi niente posizione fissa per ✦ AI e 🎙 voce.

## Proposta: l'archetipo "Elenco → Dettaglio"

Struttura a 3 zone, identica per WCA Partner, Contatti, Biglietti:

```text
┌ header di pagina (StandardPageFrame) ────────────────────────────────┐
│ Esplora · WCA Partner · 12.286      [azione primaria] [⋯] [📊] ✦ 🎙 │
├──────────────┬───────────────────────────────────┬──────────────────┤
│ RAIL FILTRI  │  ELENCO                           │  DETTAGLIO       │
│ (sinistra,   │  toolbar: conteggio · ricerca ·   │  identità        │
│  a scomparsa)│  ordina · chip attivi             │  + sezioni       │
│  paesi,      │  ─────────────────────────────    │  + azioni        │
│  qualità,    │  card sobrie (5 info livello 1)   │                  │
│  contatti    │                                   │                  │
└──────────────┴───────────────────────────────────┴──────────────────┘
```

Regole del template:
- **Un solo sistema di filtri**: il rail sinistro. `EntityFiltersDrawer` viene assorbito lì come
  sezione "Filtri avanzati"; il pulsante "Filtri" in toolbar apre il rail invece del drawer.
- **Una sola ricerca in pagina**: quella della toolbar; la casella nel rail diventa "cerca dentro
  i filtri" (paese) e non duplica la ricerca partner.
- Toolbar su una riga: conteggio · ricerca · ordina · holding · "…" (seleziona tutto, esporta,
  sincronizza). Chip attivi su riga sotto, solo se presenti.
- **Card a 5 informazioni di livello 1**: nome, referente principale, città/paese, stato
  (un solo badge + `+N`), recency. Tutto il resto (BCA, trofeo, origine, arricchimento, score,
  canali) passa a livello 2: visibile su hover o nella card aperta/selezionata.
- **Colore = stato, mai decorazione**: email/telefono/città diventano chip neutri; verde/ambra/
  rosso solo per stato dati; accento indigo solo per la riga aperta e l'azione primaria.
- Bandiera come unico marcatore geografico a sinistra (20px, contenitore neutro); logo dentro il
  blocco titolo con fallback a iniziali, così non lascia buchi.
- **Selezione**: 1 checkbox = dettaglio resta aperto e compare una barra azioni in basso;
  ≥2 = pannello bulk a destra. Auto-focus del primo record solo su desktop e solo se non c'è
  deep-link.
- Dettaglio: intestazione identità unica (logo/bandiera/nome/città/#id), azioni Sherlock
  raccolte in un solo pulsante con menu 3 livelli, corpo invariato.

## Fasi di lavoro

1. **Fase A — contratto e comandi.** `NetworkPage` dentro `StandardPageFrame` con ✦/🎙/📊;
   toolbar ridotta a una riga con menu "…"; pulsante Filtri → apre il rail.
2. **Fase B — un solo sistema di filtri.** `EntityFiltersDrawer` assorbito in
   `NetworkFiltersSection` come sezione avanzata; unificazione dei prefissi chip.
3. **Fase C — card sobria.** Riscrittura presentazionale di `CompanyCard` con livello 1/livello 2,
   `+N` sui badge, chip neutri, logo con fallback iniziali.
4. **Fase D — selezione e dettaglio.** Soglia bulk ≥2 + barra azioni singola; intestazione
   identità nel dettaglio; Sherlock in un menu unico.
5. **Fase E — bonifica colore.** Rimozione delle 22 occorrenze fuori palette nei file coinvolti.
6. **Fase F — generalizzazione.** Le stesse modifiche valgono automaticamente per Contatti CRM e
   Biglietti perché condividono `EntityListWithDetail`; verifica visiva sulle tre pagine.

## Note tecniche

- Interventi solo di presentazione: nessuna modifica a query, hook dati, DAL, edge function,
  eventi globali (`v2-open-partner`, `sherlock-launch`, `campaign-create-bulk`) o bulk handler.
- File toccati: `NetworkPage.tsx`, `EntityListWithDetail.tsx`, `ListToolbar.tsx`,
  `CompanyCard.tsx`, `ContactSubCard.tsx`, `EntityFiltersDrawer.tsx`, `NetworkFiltersSection.tsx`,
  `PartnerDetailInline.tsx`, `PartnerDetail{Header,Activity}.tsx`, `BulkActionsPanel.tsx`.
- Persistenza esistente (sort per source, holding per source, larghezza split) mantenuta.

## Fuori perimetro

Logica di business, sincronizzazione WCA, Sherlock/deep search, mappa e globo, menu globale.
