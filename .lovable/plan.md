# Missioni Autopilot — maschera operativa, non cruscotto

## Confermo la tua lettura

Sì, hai ragione su tutti e tre i punti:

1. **I riepiloghi non stanno in una maschera operativa.** La fascia KPI (Attive / In pausa / Obiettivo) occupa la parte alta e non serve a fare nulla: informa e basta. Va spostata dietro un'icona.
2. **I filtri di stato in fila (Attive / In pausa / Concluse) sono un secondo riepilogo travestito da filtro.** Contano invece di far agire.
3. **La pagina deve dare: la missione, il prompt, e un campo libero dove l'agente risponde e lavora su un canvas** — lo stesso modello della Command. Questo è il centro, non l'elenco.

Aggiungo una cosa che non hai citato ma che è lo stesso problema: oggi ci sono tre file di comandi sovrapposte (menu globale in alto, riga microfono/AI/Nuova missione, menu di riga). Vanno ridotte a una.

## La proposta: tre colonne, un solo centro

```text
┌── rail SX ─────┬──────── canvas centrale ────────┬── rail DX ───┐
│ Missioni       │  Missione: "Riattivazione ..."  │ Contesto     │
│ ─ ricerca      │                                 │ ─ target     │
│ ─ Riattivaz... │  [ prompt / obiettivo editabile]│ ─ canale     │
│ ─ Nuovi lead   │                                 │ ─ budget     │
│ ─ Follow-up... │  ─ thread agente ─────────────  │ ─ cadenza    │
│                │  agente: ho preparato 12 mail   │              │
│ [+ Nuova]      │  [canvas risultato: tabella]    │ Azioni       │
│                │                                 │ ─ Avvia      │
│                │  ─────────────────────────────  │ ─ Pausa      │
│                │  > scrivi cosa deve fare...  ✦🎙│ ─ Termina    │
└────────────────┴─────────────────────────────────┴──────────────┘
```

- **Rail sinistro (sempre presente, come in tutte le pagine)**: elenco missioni con sola ricerca e stato come pallino colorato accanto al nome. Nessun contatore, nessuna riga di filtri: se cerchi, filtri.
- **Centro**: la missione selezionata. In alto il nome e il prompt/obiettivo modificabile in linea. Sotto il thread con l'agente. Sotto ancora il campo libero con ✦ AI e 🎙 voce integrati nel campo stesso (non in una barra separata).
- **Canvas**: quando l'agente produce qualcosa (lista contatti, bozze email, piano di azioni) compare come blocco nel thread, espandibile a tutta larghezza — stesso comportamento del canvas della Command.
- **Rail destro**: parametri della missione (target, canale, budget, cadenza) e azioni di stato. Sono la parte "che serve mentre lavori", quindi restano a portata ma fuori dal centro.

## Dove finiscono i riepiloghi

Un'unica icona 📊 nell'header della pagina apre un pop-up (popover) con: attive, in pausa, concluse, obiettivo raggiunto, budget consumato, eventi recenti. Si legge quando serve, non occupa spazio operativo.

## Cosa sparisce

- La fascia KPI fissa in alto.
- La riga di filtri stato (Attive / In pausa / Concluse).
- La riga separata microfono / AI / Nuova missione: 🎙 e ✦ entrano nel campo di input, "Nuova missione" diventa il `+` in cima al rail sinistro.
- Il menu "…" di riga: le azioni sulla missione vivono nel rail destro della missione aperta.

## Nota tecnica

- Solo presentazione. Query, mutation, calcoli KPI/budget e wizard di creazione restano identici; i KPI già calcolati vengono semplicemente resi nel popover invece che nella fascia.
- Nuovi componenti presentazionali: `MissionRail` (sx), `MissionWorkspace` (centro, riusa il pattern thread+canvas della Command), `MissionContextRail` (dx), `MissionSummaryPopover`.
- `StandardPageFrame` resta il guscio; i rail seguono il pattern overlay su mobile (drawer) già in uso.
- Se il modello funziona, questa diventa l'impronta per tutte le maschere operative successive (Esplora, Cestinone, Cockpit).
