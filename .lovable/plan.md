
# Piano di Uniformazione UI — "Semplice come un gioco"

## Principio guida
Ogni maschera deve avere la stessa struttura: **Nav verticale sx (con filtri integrati) → Contenuto principale**. Un bambino di 10 anni deve capire dove cliccare.

---

## 1. Componente Standard: `SectionShell`

Creare un wrapper riutilizzabile che tutte le maschere useranno:

```
┌──────────────────────────────────────────────┐
│ [Header compatto: titolo + conteggio + azioni]│
├──────────┬───────────────────────────────────┤
│ Nav sx   │                                   │
│ + Filtri │     Contenuto principale          │
│ integrati│     (lista, calendario, ecc.)     │
│          │                                   │
└──────────┴───────────────────────────────────┘
```

**File:** `src/components/layout/SectionShell.tsx`
- Props: `title`, `count`, `filters[]`, `actions[]`, `children`
- Il nav verticale è PARTE del contenuto di ogni tab, non della shell Outreach

## 2. VerticalTabNav → Aggiungere slot filtri

La sidebar 140px attuale mostra solo i link. Modifica:
- Sotto i tab: sezione **Filtri** collassabile
- Ricerca testuale (input compatto)
- Chip filtro per stato, agente, tipo, priorità
- Conteggio risultati in tempo reale

**File:** `src/components/ui/VerticalTabNav.tsx` — aggiungere prop `filterSlot?: ReactNode`

## 3. Cards Standardizzate — `UnifiedContactRow`

Creare UN componente card usato ovunque:

```
┌─────────────────────────────────────────────────┐
│ ☐ │ 🏢 Azienda        │ 👤 Nome · Ruolo │ 🏙 Città │ ● Stato │ ⚡ Canali │
└─────────────────────────────────────────────────┘
```

**File:** `src/components/shared/UnifiedContactRow.tsx`
- Layout a riga singola, colonne fisse
- Checkbox opzionale
- Badge stato colorato (Nuovo=grigio, Contattato=blu, Trattativa=arancione, Chiuso=verde)
- Icone canali compatte (mail, linkedin, whatsapp)
- Doppio clic → apre ContactRecordDrawer
- Usato in: Cockpit, Circuito, CRM Contatti, Attività

## 4. Empty States Utili

Creare `src/components/shared/EmptyState.tsx`:
- Icona grande animata
- Titolo chiaro ("Non ci sono contatti qui")
- Sottotitolo con azione suggerita ("Vai al Cockpit per aggiungerne")
- Pulsante CTA primario

Applicare a:
- **Circuito**: "Nessun contatto in attesa → Contatta qualcuno dal Cockpit per iniziare"
- **In Uscita**: "Nessun invio in coda → Trascina un contatto nel Cockpit per generare un messaggio"
- **CRM vuoto**: "Nessun contatto importato → Importa un file CSV o aggiungi manualmente"
- **Attività vuote**: "Tutto fatto! Nessuna attività in sospeso"

## 5. Cockpit — Semplificazione Drop Zone

Le 4 drop zone occupano il 50% dello schermo vuote. Modifica:
- **Stato normale** (nessun drag): mostrare un pannello compatto con 4 pulsanti canale in riga orizzontale, non 4 box giganti
- **Stato drag**: espandere le zone con animazione
- Ridurre da `min-h-[80px]` a `min-h-[56px]` per le zone

**File:** `src/components/cockpit/ChannelDropZones.tsx`

## 6. Attività — Card più ricca

La card attività attuale mostra solo titolo + priorità. Aggiungere:
- Icona tipo attività (email, call, meeting)
- Nome azienda/contatto
- Agente assegnato (avatar emoji)
- Data scadenza con colore (rosso se scaduta)

**File:** `src/components/outreach/AttivitaTab.tsx`
- Rimuovere le 4 card metriche giganti → sostituire con contatori inline nella toolbar

## 7. Circuito — Da vuoto a funzionale

Attualmente schermo vuoto con aereo. Anche con 0 contatti, mostrare:
- Header con titolo + filtri stato (Contattati/In Corso/Trattativa)
- Empty state utile con CTA
- Quando ci sono dati: layout a colonne kanban (drag between status)

**File:** `src/components/outreach/HoldingPatternTab.tsx`

## 8. Header Coerente

Rimuovere la barra blu portal di Network. Tutte le pagine usano lo stesso header globale:
- Hamburger sx
- Titolo sezione al centro (opzionale)  
- Azioni dx (sync, AI assistant)

Non toccare Global/Campagne (escluse dal sistema UI).

---

## File coinvolti

| File | Azione |
|------|--------|
| `src/components/shared/EmptyState.tsx` | **NUOVO** — empty state riutilizzabile |
| `src/components/shared/UnifiedContactRow.tsx` | **NUOVO** — card contatto standard |
| `src/components/ui/VerticalTabNav.tsx` | Aggiungere `filterSlot` |
| `src/components/cockpit/ChannelDropZones.tsx` | Ridurre dimensioni, layout orizzontale |
| `src/components/outreach/AttivitaTab.tsx` | Card più ricche, rimuovere metriche giganti |
| `src/components/outreach/HoldingPatternTab.tsx` | Empty state, header filtri |
| `src/components/outreach/InUscitaTab.tsx` | Empty state |
| `src/pages/Cockpit.tsx` | Usare UnifiedContactRow in modalità lista |

## Ordine di esecuzione

1. EmptyState + UnifiedContactRow (componenti base)
2. VerticalTabNav con filtri
3. Cockpit drop zones compatte
4. Attività card ricche
5. Circuito funzionale
6. In Uscita empty state
