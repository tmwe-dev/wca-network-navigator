# Fase 0.B — Contratto di pagina V3

Documento normativo. Vale per ogni maschera dentro `src/v3`. Non ci sono eccezioni "solo per questa pagina": è esattamente così che la V2 è diventata confusa.

## 1. Perché serve

Stato attuale verificato in V2:

- `PageTitleHeader` usato da 22 pagine (portale nella top bar)
- `StandardPageFrame` usato da 2 pagine (header dentro la maschera)
- `ExploreContextHeader` usato dalla sezione Esplora
- `GoldenHeaderBar` e `AutoPageTitle` orfani (0 usi)
- ~150 rotte registrate, con la stessa pagina raggiungibile da 2-3 indirizzi diversi

Tre standard concorrenti equivalgono a nessuno standard.

## 2. Struttura unica

```text
┌─ TOP BAR GLOBALE — h-11, fissa, una sola in tutta l'app ─────────────┐
│ ☰  ·  Titolo pagina                        stato · notifiche · utente│
├──────────┬────────────────────────────────────────────┬──────────────┤
│ FILTRI   │ HEADER DI MASCHERA — h-9                   │ WORKFLOW     │
│ (sx)     │ breadcrumb · titolo · ✦AI · azioni primarie│ (dx)         │
│          ├────────────────────────────────────────────┤              │
│ solo     │ TOOLBAR CONTESTUALE — h-9, opzionale       │ solo azioni  │
│ filtri   ├────────────────────────────────────────────┤ e stato      │
│ della    │                                            │ operativo    │
│ pagina   │ CONTENUTO                                  │              │
│          │                                            │              │
└──────────┴────────────────────────────────────────────┴──────────────┘
```

## 3. Regole non negoziabili

1. **Un solo header.** Ogni pagina V3 rende `<PageFrame>`. Nessun componente header alternativo esiste nel codice V3.
2. **Sinistra = solo filtri.** Mai navigazione, mai contenuto, mai azioni.
3. **Destra = solo workflow.** Azioni operative e stato dei dati. Se una pagina non ha workflow, il rail destro non si monta (niente pannelli generici vuoti).
4. **Una sola domanda per pagina.** Ogni pagina dichiara in `pageContract.ts` la domanda a cui risponde ("cosa devo fare ora"). L'azione principale è visibile senza scroll.
5. **Un solo indirizzo per pagina.** Nessun alias. Gli URL V2 diventano redirect verso l'unico URL V3.
6. **✦ AI sempre nello stesso punto**, in alto a destra dell'header di maschera. Stesso comportamento ovunque.
7. **Nessun colore fuori dai token semantici.** Un solo set di badge e stati.
8. **Mobile-first.** Sotto `lg`, filtri e workflow diventano drawer; il contenuto resta intero, mai compresso.
9. **Nessuna larghezza fissa.** Tabelle, form e filtri si adattano.

## 4. Tre tipi di maschera. Solo tre.

| Tipo | Quando | Contenuto | Sinistra | Destra |
|---|---|---|---|---|
| **Lista** | si scorre e si seleziona | tabella o elenco di card + paginazione | filtri della collezione | azioni massive, stato selezione |
| **Dettaglio** | si esamina e si modifica una entità | scheda entità a sezioni | non montato | azioni sull'entità, cronologia |
| **Operativa** | si lavora in continuo (Cockpit, Command, Inbox) | canvas o due-pannelli a piena altezza | code / filtri di lavoro | azioni rapide, stato agente |

Ogni pagina V3 dichiara il proprio tipo. Un tipo nuovo si aggiunge solo modificando questo documento.

## 5. Implementazione

```
src/v3/app/
  pageContract.ts   // dichiarazione di ogni pagina: id, path, tipo, domanda, filtri, workflow
  PageFrame.tsx     // l'unico guscio: header, toolbar, slot AI, aree contenuto
  AppShell.tsx      // top bar globale + rail sinistro/destro + router outlet
  routes.tsx        // un percorso per pagina, nessun alias
```

Forma della dichiarazione:

```ts
export const PAGES = {
  contatti: {
    path: "/v3/contatti",
    kind: "list",
    question: "Chi devo contattare oggi?",
    filters: ["ricerca", "paese", "gruppo", "stato"],
    workflow: ["nuovo-contatto", "import", "azioni-massive"],
  },
} as const;
```

## 6. Come si fa rispettare

- Regola ESLint `tmwe/v3-page-frame`: un file sotto `src/v3/**/pages/` che non renda `PageFrame` non passa il lint.
- Regola ESLint `tmwe/v3-no-legacy-import`: nessun import da `@/components` o `@/v2` dentro `src/v3`.
- Ogni pagina V3 deve avere una voce in `pageContract.ts`, altrimenti il router non la registra.
- Eredità condivisa ammessa: primitive shadcn e `src/design-system`. Nient'altro.

## 7. Tema

Chiaro: fondi chiari, testo scuro ad alto contrasto, bordi delicati ma visibili, badge sobri.
Scuro: fondi scuri raffinati, card con bordo e trasparenza leggera, testo tono su tono sempre leggibile, badge con trasparenza controllata e bordo. Niente grigi troppo deboli.
