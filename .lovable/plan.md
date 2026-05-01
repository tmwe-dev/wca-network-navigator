## Obiettivi

1. Risparmiare ~25% di altezza nella maschera **Biglietti** (sia in CRM › Biglietti sia in Network › BCA), perché con il pannello dettaglio aperto a destra l'area scrollabile è troppo piccola.
2. Spostare l'intera colonna sinistra dei Biglietti (paesi + filtri qualità + ordinamento + selettore vista) **dentro la sidebar globale a scomparsa** ("linguetta"), come avviene per WCA Partner.
3. Standardizzare l'header in alto su tutte le sezioni con il pattern già visto in Network (icona di sezione + nome sezione + sub-toggle + contatore).
4. Rimuovere duplicazioni nelle "righe orizzontali" sotto l'header.

## Stato attuale (problemi)

In `BCAUnifiedHub` (usato sia dal CRM che dal Network via `BusinessCardsView`) la verticalità è occupata da **6 fasce orizzontali** sopra la lista:

```text
[ GoldenHeaderBar 44px breadcrumbs ]   ← header globale
[ SectionTabs 36px ]                   ← Contatti / Kanban / Biglietti …
[ Toolbar: search + sel. tutti + count + Sincronizza ]
[ "Vista:" Compatta / Media / Espansa ]
[ BCAQualityDashboard "Qualità Portfolio BCA" ]
[ Timeline Evento + hint "Clicca una card…" ]
─────────────────────────────────────  ← solo qui inizia la lista scrollabile
```

A destra il pannello dettaglio fissa header + 4 azioni intelligenti, e la parte dati grezzi si riduce a poche righe.

La sidebar paesi (320px) è duplicata: c'è già una linguetta globale (`ContextFiltersRail`) che però per `/v2/pipeline/biglietti` ritorna `null` e per Network/BCA viene esplicitamente nascosta. Il risultato è che i Biglietti hanno la propria sidebar interna ma la "linguetta" globale resta inutilizzata.

## Piano

### A) Spostare la sidebar paesi dei Biglietti dentro la linguetta globale

- In `ContextFiltersRail.tsx`: aggiungere il caso "biglietti" (sia `/v2/pipeline/biglietti` sia Network con `networkView === "bca"`). La linguetta riapre una colonna 320px che contiene un nuovo componente `BCAFiltersRailContent` con: ricerca, lista paesi (count), toggle "Solo WCA match" / "Solo con email" / "Nascondi in circuito", ordinamento, selettore vista (Compatta/Media/Espansa).
- Il nuovo componente legge/scrive lo stato via context (vedi sotto).
- Rimuovere dal corpo di `BCAUnifiedHub.tsx` e di `BusinessCardsView.tsx` la `BcaCountrySidebar` interna e il chevron di toggle.

Per condividere lo stato tra la rail e la pagina senza prop-drilling tra route diverse: estrarre `useBcaGrouping` in un piccolo provider `BcaFiltersProvider` (Context) montato da `PipelineSection` (rotta biglietti) e da `OperationsView` (Network BCA). La rail e il body consumano lo stesso hook.

### B) Compattare le fasce orizzontali della pagina Biglietti

Riducendo da 6 a 2 fasce sopra la lista (target: −25% di altezza occupata):

```text
[ Toolbar unica 36px:
    🔎 search · vista [▦▤▥] · 372 biglietti · 302 aziende ·
    ✓ Seleziona tutti · ⏱ Timeline · ⟳ Sincronizza ]

[ Qualità Portfolio BCA — collassato in una pill 24px,
    cliccabile per espandere il pannello ricco esistente ]
```

Dettagli:
- Spostare il selettore vista (Compatta/Media/Espansa) **dentro la toolbar** (icone-only con tooltip).
- Spostare "Timeline Evento" e "Sincronizza" come bottoni icona nella stessa toolbar.
- Il contatore "biglietti · aziende · selezionati" diventa testo inline nella toolbar.
- L'hint "Clicca una card…" diventa un piccolo tooltip sull'icona vista, non più una riga dedicata.
- `BCAQualityDashboard`: trasformare il render di default in barra compatta `383 · 269 match · 369 con email` con chevron per espandere on-demand. Il componente ricco resta intatto, viene solo wrappato in un `<details>` collassabile chiuso di default.

Stesse modifiche valide per `BusinessCardsView` (Network › BCA), così il comportamento è univoco.

### C) Standardizzare l'header in alto (pattern Network)

Applicare ovunque il pattern dello screenshot di riferimento:

```text
[ ☰  • [icon-sezione] Nome sezione  [pill switch sub-view]   ⏱… 12.286 record   🔔 utente  … ]
[ Home › Esplora › Network ]                                             ← breadcrumb
[ WCA Partner | Mappa | Sherlock ]                                       ← SectionTabs
```

Operativo:
- Creare un piccolo helper `<SectionHeaderIcon section="crm" />` mappato a icona + label (`crm`→Users, `pipeline`→Workflow, `intelligence`→Brain, `communicate`→Mail, ecc.).
- `GoldenHeaderBar` resta per il breadcrumb.
- Esporre lo stesso slot `#campaign-header-controls` già usato da Network anche nelle altre sezioni (rinominato `#section-header-controls`), così ogni sezione può portare il proprio sub-toggle (es. Pipeline: stessa pillola Contatti/Kanban se usata in toolbar?), e il contatore globale.

### D) Eliminazione duplicati sotto l'header

Audit rapido per sezione:
- **Pipeline › Contatti CRM**: oggi mostra GoldenHeaderBar + SectionTabs + (dentro `ContactsPage`) un proprio toolbar con search + filtri + counter; spesso doppione del rail. Proposta: search + counter restano nella toolbar di pagina; togliere la riga "FILTRI" interna ridondante (i filtri vivono nella linguetta globale).
- **Pipeline › Biglietti**: vedi sezione B.
- **Network › WCA Partner**: già pulito, solo verificare che `StatPill` fluttuanti non si duplichino col counter del header.
- **Pipeline › Kanban / Duplicati / Campagne / Agenda**: verificare che ognuna non ridichiari un proprio breadcrumb interno.

## File toccati (stima)

```text
src/v2/ui/templates/ContextFiltersRail.tsx          (+ caso biglietti)
src/components/contacts/bca/BCAFiltersRailContent.tsx  (NEW)
src/components/contacts/bca/BcaFiltersProvider.tsx     (NEW)
src/components/contacts/bca/BCAUnifiedHub.tsx       (toolbar compatta, no sidebar interna)
src/components/operations/BusinessCardsView.tsx     (idem, no sidebar interna)
src/components/operations/bca/BCAQualityDashboard.tsx  (modalità compact + expand)
src/v2/ui/pages/sections/PipelineSection.tsx       (wrap biglietti in BcaFiltersProvider)
src/components/operations/OperationsView.tsx       (wrap BCA in BcaFiltersProvider)
src/v2/ui/templates/SectionHeaderIcon.tsx          (NEW, helper icona+label sezione)
src/v2/ui/pages/sections/{Pipeline,Intelligence,Communicate,Config}Section.tsx
   (aggiunta header standard come ExploreSection)
```

Nessuna modifica di business logic / DAL / edge. Tutto frontend/presentazionale.

## Risultato atteso

- Pannello dettaglio destra: la zona scroll dei dati grezzi recupera ~120-160px verticali (≈25% in più).
- Una sola sidebar a scomparsa per i Biglietti, identica a quella di WCA Partner.
- Header coerente in tutte le sezioni (icona + nome + sub-toggle + breadcrumb + tab).
