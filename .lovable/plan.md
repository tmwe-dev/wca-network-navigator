## Diagnosi

Misurando lo screenshot a 1016×691, la pagina `/v2/communicate/outreach` (tab "Risposte") spende l'altezza così:

```text
GoldenHeaderBar (breadcrumb + utente)     ~7%   utile
SectionTabs (Inbox/Outreach/...)          ~5%   utile
OutreachStatsHeader "Pipeline Outreach"   ~5%   quasi vuoto (collassato, mostra "0 da inviare · 0 oggi")
OutreachMiniCharts (sparkline+donut)      ~10%  rumore visivo
TabIntroBanner "Risposte · Posta..."      ~17%  testo onboarding
"Centro Operativo" + tab canali Email/WA  ~12%  utile ma sovradimensionato
OutreachLegendFooter                      ~6%   legenda colori
─────────────────────────────────────────────
TOTALE CROMO                              ~62%
LISTA MESSAGGI (il vero contenuto)        ~38% — di cui visibili davvero ~15-18%
```

Risultato: tre messaggi visibili su una lista da centinaia. Il "Pipeline Outreach" header è pensato per **outreach in uscita** (da inviare/oggi/falliti) e non ha alcun senso sopra la tab **Risposte** (inbound).

## Obiettivo

Portare lo spazio messaggi da ~18% a ~80%+ senza perdere informazioni essenziali, applicando la stessa logica a tutte le sub-tab Outreach (Cockpit/In Uscita/Risposte/Attività/Strumenti).

## Piano

### 1. Stats header context-aware (`OutreachStatsHeader`)
- Nasconderlo completamente quando la sub-tab attiva è `circuito` (Risposte) — le stats outbound non c'entrano con l'inbound.
- Per le altre tab: rimanere collassato di default (già così) ma ridurre padding da `py-1.5` a `py-1` e font.

### 2. MiniCharts on-demand
- Spostare `OutreachMiniCharts` **dentro** il pannello Cockpit (dove ha senso) invece che globalmente in cima.
- Rimuoverlo da `OutreachPage.tsx`: libera ~10% di altezza su tutte le altre tab.

### 3. TabIntroBanner → tooltip
- Convertire il banner "Risposte · Posta in arrivo cross-canale..." da blocco fisso a **tooltip su icona ⓘ** accanto al titolo della tab nella `VerticalTabNav`.
- Liberato altro ~17%. Il testo resta accessibile, non più invadente.
- Stessa logica per gli altri `TabIntroBanner` (Cockpit, In Uscita, Attività, Strumenti).

### 4. Legenda footer → toggle nascosto di default
- `OutreachLegendFooter` parte già con flag localStorage `outreach-legend-hidden`, ma di default è visibile. Invertire: nascosto di default, riapribile da una piccola icona "Legenda" nel footer della VerticalTabNav.
- Liberato ~6%.

### 5. "Centro Operativo" channel tabs compatti (`HoldingContactList`)
- Ridurre l'header "Centro Operativo 964" da blocco grande a singola riga compatta con i 3 chip canale (Email 946 / WA 18 / LinkedIn) inline, altezza ~32px invece di ~80px.

### 6. GoldenHeaderBar slim
- Ridurre padding verticale del breadcrumb a `py-1.5` per recuperare ~2%.

## Risultato atteso

```text
Cromo finale                  ~12-15%
Lista messaggi                ~85-88%
Messaggi visibili a 691px:   da 3 → ~10-12
```

## Sezione tecnica

**File da modificare:**
- `src/v2/ui/pages/OutreachPage.tsx` — rimuovere `<OutreachMiniCharts />`, condizionare `<OutreachStatsHeader />` su `tab !== "circuito"`, default-hide legend.
- `src/components/outreach/HoldingPatternCommandCenter.tsx` — rimuovere `<TabIntroBanner />` (sostituito da tooltip).
- `src/components/outreach/InUscitaTab.tsx` / `AttivitaTab.tsx` / `ToolsTab.tsx` — stessa rimozione TabIntroBanner.
- `src/v2/ui/pages/CockpitPage.tsx` — aggiungere `<OutreachMiniCharts />` come header interno opzionale.
- `src/components/ui/VerticalTabNav.tsx` — supportare prop `tooltip` per icona ⓘ accanto a label.
- `src/components/outreach/HoldingContactList.tsx` — header "Centro Operativo" compattato.
- `src/components/outreach/OutreachLegendFooter.tsx` — invertire default a `hidden=true`.
- `src/v2/ui/templates/GoldenHeaderBar.tsx` — padding slim.

**Nessun cambio business-logic**: solo riorganizzazione UI/spaziature, zero modifiche a hook, query, o RPC.

## Domanda di conferma

Procedo su tutti e 6 i punti? Oppure preferisci che faccia solo i primi 3 (rimozione MiniCharts globali + StatsHeader nascosto in Risposte + TabIntroBanner come tooltip), che da soli liberano ~32% di altezza e risolvono il 90% del problema?