# Prototipo di riferimento — Missioni Autopilot (archetipo Monitor / KPI)

Pagina: `src/v2/ui/pages/MissionsAutopilotPage.tsx` (420 righe, guscio `PageShell`).
Questo documento è la **specifica**: la pagina non viene ancora modificata.

## Com'è oggi

- Guscio `PageShell`, quindi header diverso da Cockpit (`StandardPageFrame`) e da
  Email Intelligence (`PageTitleHeader`).
- Nessuna fascia KPI: non si sa a colpo d'occhio quante missioni sono attive,
  quante in pausa, quanto budget resta.
- Le missioni sono card in griglia `md:2 / xl:3`. Ogni card contiene:
  titolo, badge stato, descrizione su 2 righe, barra KPI con percentuale,
  barra Budget con percentuale, eventuale allerta «Budget quasi esaurito»,
  fino a 2 pulsanti di stato (Avvia/Pausa/Riprendi/Stop) e il badge «⚡ Autopilot».
  → **fino a 9 elementi visivi** per card, contro i 5 del contratto.
- I pulsanti Avvia/Pausa/Stop sono sempre visibili su ogni card: in una griglia da 12
  missioni significa fino a 24 pulsanti a schermo, di cui uno `destructive` rosso pieno.
- `STATUS_COLORS` mappa 6 stati su 6 combinazioni diverse di `bg`/`text`
  (`muted`, `primary/20`, `accent`, `primary/30`, `destructive/20`, `destructive/10`):
  due sfumature di primary e due di destructive che l'utente non sa distinguere.
- La timeline eventi compare sotto la griglia solo se una card è selezionata,
  e mostra `JSON.stringify(payload).substring(0,120)`: dato grezzo, non leggibile.
- Il badge Autopilot usa l'emoji ⚡ invece di un'icona del sistema.

## Come deve diventare

```text
┌ header ─────────────────────────────────────────────────────────────┐
│ Intelligence › Missioni Autopilot        [✦AI] [Nuova missione] [ … ]│
├ toolbar ────────────────────────────────────────────────────────────┤
│ Tutte · Attive · In pausa · Concluse            12 missioni          │
├─────────────────────────────────────────────────────────────────────┤
│ ┌─────────┬─────────┬─────────┬─────────┐                           │
│ │   4     │   2     │  68%    │  71%    │   ← 4 KPI, nessun colore  │
│ │ attive  │ pausa   │ obiettivo│ budget │      salvo fuori soglia   │
│ └─────────┴─────────┴─────────┴─────────┘                           │
├─────────────────────────────────────────────────────────────────────┤
│ MISSIONI  (elenco, non griglia)                                     │
│ ● Riattivare partner Cina        obiettivo ▓▓▓▓▓▓░░ 68%   attiva  … │
│ ● 10 risposte positive in 7gg    obiettivo ▓▓▓░░░░░ 31%   pausa   … │
│ ● Nuovi NVOCC Sud America        obiettivo ▓▓▓▓▓▓▓▓ 94%   attiva  … │
├─────────────────────────────────────────────────────────────────────┤
│ DETTAGLIO (pannello a destra o drawer, alla selezione)              │
│  obiettivo · budget · agente · eventi leggibili                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Riga di missione — i 5 elementi di livello 1

1. **Pallino di stato** (colore semantico, 8px) — sostituisce il badge testuale colorato.
2. **Titolo** della missione.
3. **Avanzamento obiettivo**: una sola barra + percentuale.
4. **Etichetta stato** in muted (`attiva`, `in pausa`, `conclusa`).
5. **Menu «…»** con Avvia / Pausa / Riprendi / Stop / Apri dettaglio.

Tutto il resto — descrizione, budget, agente, KPI per chiave, allerta budget,
autopilot on/off, eventi — passa al **livello 2**, nel pannello di dettaglio.

### Mappa stati → token

| Stato attuale | Etichetta | Token |
| --- | --- | --- |
| `draft` | Bozza | `--muted` |
| `active` | Attiva | `--success` |
| `paused` | In pausa | `--warning` |
| `completed` | Conclusa | `--muted-foreground` con spunta |
| `failed` | Fallita | `--destructive` |
| `budget_exhausted` | Budget esaurito | `--destructive` |

`completed` non usa più l'accento: una missione finita non deve competere
visivamente con una attiva.

### Barre di avanzamento

- Obiettivo: barra neutra (`bg-muted`, riempimento `bg-foreground/60`).
- Budget: neutra fino all'80%, `--warning` sopra l'80%, `--destructive` al 100%.
  Sparisce l'allerta testuale ripetuta su ogni card: la barra è già l'allerta.

### Timeline eventi

Nel pannello di dettaglio, non sotto la griglia. Ogni evento su una riga:
`ora · tipo evento tradotto in italiano · riassunto in chiaro`.
Il payload JSON grezzo va dietro un «Mostra dati tecnici».

### Wizard «Nuova missione»

Resta un dialog, ma diviso in 3 passi invece di 11 campi in colonna:
**1. Obiettivo** (titolo, tipo, descrizione) → **2. Agente e target** →
**3. Budget e autopilot**. Il pulsante di conferma resta unico e in fondo.

## Cosa NON cambia

Query, mutation, `computeKpiProgress`, `computeBudgetProgress`, chiavi di cache,
nomi dei campi, comportamento dei pulsanti di stato. L'intervento è solo di
presentazione: stesse funzioni, meno rumore.
