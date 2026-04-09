

# Piano: Agenda Operativa a Libro + Azioni Bulk da Agenda

## Cosa cambia

L'agenda attuale e' un calendario mensile base con celle piccole e nessuna interattivita' operativa. L'utente vuole un'agenda a due pagine (stile libro aperto) dove cliccare un giorno apre il dettaglio completo delle attivita', con possibilita' di selezionare contatti, ricontattarli, e gestire azioni bulk — tutto canalizzato verso "In Uscita" per conferma.

## Architettura nuova

```text
┌─────────────────────────────────────────────────────────┐
│  AGENDA (Reminders.tsx riscritta)                       │
│                                                         │
│  ┌──────────────┐  ┌──────────────────────────────────┐ │
│  │  PAGINA SX   │  │  PAGINA DX                       │ │
│  │              │  │                                   │ │
│  │  Calendario  │  │  Dettaglio giorno selezionato     │ │
│  │  mese con    │  │                                   │ │
│  │  indicatori  │  │  Tab: Email | WhatsApp | LinkedIn │ │
│  │  per giorno  │  │  + Tab: Reminder/Programmati      │ │
│  │              │  │                                   │ │
│  │  Click su    │  │  Lista contatti con:               │ │
│  │  giorno →    │  │  - Checkbox selezione              │ │
│  │  apre DX     │  │  - Bandiera + nome + azienda      │ │
│  │              │  │  - Badge "ha risposto" evidenziato │ │
│  │  Filtri SX   │  │  - Menu 3 pallini (call, note,    │ │
│  │  (sidebar)   │  │    email singola, WhatsApp)        │ │
│  │              │  │                                   │ │
│  │              │  │  Bulk bar in alto:                 │ │
│  │              │  │  - Seleziona tutti                 │ │
│  │              │  │  - Goal picker (follow-up, etc.)   │ │
│  │              │  │  - "Genera email bulk" → In Uscita │ │
│  │              │  │  - "WhatsApp bulk" → In Uscita     │ │
│  └──────────────┘  └──────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## Dettagli implementativi

### 1. Riscrittura `Reminders.tsx` — Layout a libro

- Eliminare i 4 tab attuali (calendario, in attesa, completati, attivita')
- Layout split 40/60: pagina sinistra = calendario compatto + filtri, pagina destra = dettaglio giorno
- Stato: `selectedDay` — click su giorno lo seleziona e popola la pagina destra
- Aspetto "libro aperto": bordo centrale, ombra interna, sfondo leggermente diverso tra le due pagine

### 2. `AgendaDayDetail.tsx` (nuovo componente)

Pagina destra che mostra tutte le attivita' del giorno selezionato:
- **Sub-tab**: Tutti | Email | WhatsApp | LinkedIn | Programmati
- Carica da `activities` filtrate per `created_at` nel giorno + `reminders` con `due_date` nel giorno
- Ogni riga mostra: checkbox, bandiera, nome contatto/azienda, tipo attivita', ora, badge "risposta ricevuta" (verde) se esiste un messaggio inbound successivo
- **Menu 3 pallini** per riga: Chiama, Aggiungi nota, Nuova email, WhatsApp, LinkedIn — riutilizzando `useDirectContactActions`
- **Highlight risposte**: query su `channel_messages` per verificare se c'e' un messaggio inbound dallo stesso contatto dopo l'invio

### 3. `AgendaBulkBar.tsx` (nuovo componente)

Barra azioni bulk che appare quando ci sono selezioni:
- **Goal picker**: dropdown con i tipi email esistenti (Primo contatto, Follow-up, Proposta servizi, etc.) + campo libero per nuovo obiettivo
- **Azioni**:
  - "Genera email" → crea sorting_jobs in `outreach_queue` con status pending → finiscono in "In Uscita"
  - "WhatsApp bulk" → stessa logica → In Uscita
  - "LinkedIn bulk" → stessa logica → In Uscita
- **Regola fondamentale**: azione singola = esecuzione diretta. Azione bulk (2+ selezionati) = sempre In Uscita per conferma

### 4. Filtri sidebar (lato sinistro, sotto il calendario)

- Filtro per tipo attivita' (email, whatsapp, linkedin, chiamata, nota)
- Filtro per stato risposta (ha risposto / non ha risposto)
- Filtro per agente assegnato
- Filtro per priorita'

### 5. Regola bulk → In Uscita

Applicata ovunque nel sistema, non solo agenda:
- Verificare che `EmailComposer`, Cockpit bulk actions, e agenda bulk actions rispettino: se destinatari > 1 → i job vengono creati come `sorting_jobs` con stato `pending` e finiscono nella tab "In Uscita > Invii Diretti" per revisione e conferma prima dell'invio

## File coinvolti

| File | Azione |
|------|--------|
| `src/pages/Reminders.tsx` | Riscrittura completa — layout a libro, calendario SX, dettaglio DX |
| `src/components/agenda/AgendaDayDetail.tsx` | **Nuovo** — dettaglio giorno con tab per canale, lista contatti, azioni |
| `src/components/agenda/AgendaBulkBar.tsx` | **Nuovo** — barra bulk con goal picker, genera email/WA/LinkedIn → In Uscita |
| `src/components/agenda/AgendaCalendarPage.tsx` | **Nuovo** — calendario compatto per pagina sinistra + filtri |
| `src/components/agenda/ActivitiesTab.tsx` | Mantenuto come sotto-componente riutilizzabile |
| `src/hooks/useAgendaDayActivities.ts` | **Nuovo** — query attivita' + reminder + risposte per un giorno specifico |

## Ordine di esecuzione

1. Creare hook `useAgendaDayActivities` (query per giorno)
2. Creare `AgendaCalendarPage` (calendario compatto + filtri)
3. Creare `AgendaDayDetail` (dettaglio giorno con tab e azioni)
4. Creare `AgendaBulkBar` (selezione + goal + invio a In Uscita)
5. Riscrivere `Reminders.tsx` per assemblare il layout a libro

