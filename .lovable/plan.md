

# Agenda: Riscrittura Completa come Agenda a Pagina Piena

## Problema
La pagina attuale ha doppi menu (Agenda.tsx wrappa Reminders.tsx che ha i suoi tab), tab ridondanti (Partner già in Network, Attività già in altra pagina, Pipeline = Sorting). Risultato: confuso e inutile.

## Soluzione
Una singola pagina **agenda a tutta pagina** — un calendario vero, grande, con righe impegni visibili dentro le celle, zoom per vista (giorno/settimana/mese), nessun tab secondario.

### Design

```text
┌──────────────────────────────────────────────────┐
│ [◀ Mese]  Marzo 2026  [Mese ▶]    [G] [S] [M]  │
├──────────────────────────────────────────────────┤
│  Vista MESE: griglia 7 colonne, celle alte       │
│  con righe reminder/attività dentro ogni cella   │
│                                                   │
│  Vista SETTIMANA: 7 colonne larghe, slot orari   │
│  righe = ore 8-20, eventi come blocchi colorati  │
│                                                   │
│  Vista GIORNO: colonna singola espansa           │
│  timeline verticale con tutti gli impegni        │
└──────────────────────────────────────────────────┘
```

### Dati mostrati
- **Reminders** (dalla tabella `reminders`) — follow-up partner
- **Activities** (dalla tabella `activities`) — attività scheduled con `due_date`
- Colore per priorità/tipo, click per dettaglio

### Zoom views
- **Mese** (default): griglia classica, celle grandi con max 4 righe impegno + "+N"
- **Settimana**: 7 colonne con fasce orarie, eventi posizionati per ora
- **Giorno**: timeline verticale singola, tutti i dettagli espansi

### File

| File | Azione |
|------|--------|
| `src/pages/Agenda.tsx` | **Riscrittura completa** — elimina tutti i tab, diventa il calendario unico con toggle G/S/M |
| `src/pages/Reminders.tsx` | Non più importato da Agenda (resta nel codebase per eventuali usi futuri) |

La pagina usa `useReminders()` + una query attività con `due_date` per popolare le celle. Tutto contenuto in `h-full overflow-hidden` con scroll interno solo sulla griglia calendario.

