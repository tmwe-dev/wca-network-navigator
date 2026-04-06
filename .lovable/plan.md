

# Allineamento strutturale CRM ↔ Network

## Differenze attuali

```text
NETWORK                              CRM
─────────────────────               ─────────────────────
Layout:                              Layout:
  Nessun tab verticale                 VerticalTabNav (Contatti/Biglietti)
  Lista paesi nel FiltersDrawer        GroupsSidebar come ResizablePanel col.1
  Lista partner al centro              ContactListPanel col.2
  Dettaglio partner col.3              ContactDetailPanel col.3

Filtri (FiltersDrawer):              Filtri (FiltersDrawer):
  Cerca con risultati inline           Cerca semplice
  Lista paesi con checkbox             Nessuna lista paesi
  Sync WCA button                      Raggruppa/Ordina/Origine/Stato/Circuito/Canale/Qualità
  Nessun raggruppa/ordina inline       Tutto in FilterSection verticali
```

**Problemi chiave**:
1. CRM ha Contatti/Biglietti come tab verticali a sinistra → occupano spazio, incoerenti col Network che non li ha
2. CRM ha GroupsSidebar come pannello resizable integrato → il Network usa il FiltersDrawer per i paesi
3. I filtri CRM sono tutti impilati verticalmente nel drawer, senza separazione logica
4. Nessuna lista paesi scrollabile nel drawer CRM come nel Network

## Piano di allineamento

### 1. Tab Contatti/Biglietti → orizzontali in alto
**File**: `src/pages/CRM.tsx`

Eliminare `VerticalTabNav` e sostituire con tab orizzontali nell'header della pagina (come i tab del Network "partners/bca"). I due tab ("Contatti", "Biglietti") diventano piccoli chip/button in alto, liberando lo spazio laterale sinistro.

### 2. Eliminare GroupsSidebar dal layout CRM
**File**: `src/pages/Contacts.tsx`

Rimuovere il `ResizablePanel` con `GroupsSidebar` (colonna 1). La lista gruppi/paesi si sposta nel FiltersDrawer, identica alla lista paesi del Network. Il layout diventa: lista contatti | dettaglio — come il Network ha lista partner | dettaglio.

### 3. Ristrutturare i filtri CRM nel FiltersDrawer
**File**: `src/components/global/FiltersDrawer.tsx`

Riorganizzare la sezione CRM seguendo la struttura del Network:

```text
┌─────────────────────────────┐
│ 🔍 CERCA                    │  ← con risultati inline come Network
│   [input + risultati live]  │
├─────────────────────────────┤
│ 🌍 PAESI (X selezionati)   │  ← lista scrollabile con checkbox
│   [chip attivi]             │  ← identica al Network
│   [lista paesi + conteggi]  │
├─────────────────────────────┤
│ ── RAGGRUPPA ── ORIGINE ──  │  ← chip orizzontali su una riga
│ [Paese][Origine][Stato][Gr] │  ← raggruppa
│ [WCA][Import][RA][BCA]      │  ← origine
├─────────────────────────────┤
│ ↕ ORDINA                    │
│ [Nome][Paese][Azienda][Rec] │
├─────────────────────────────┤
│ 👤 STATO ── ✈ CIRCUITO ──  │  ← su una riga
│ [Tutti][Nuovo][Contattato]  │
│ [Fuori][In][Tutti]          │
├─────────────────────────────┤
│ 📡 CANALE ── ✨ QUALITÀ ── │
│ [Email][Tel][LI][WA]        │
│ [Arricchiti][Non arr.]      │
└─────────────────────────────┘
```

Differenze dal layout attuale:
- **Aggiungere lista paesi** con checkbox e conteggi (usa `useContactGroupCounts` filtrato per `group_type === "country"`)
- **Cerca con risultati inline** come nel Network (query su `imported_contacts`)
- I filtri restano gli stessi ma raggruppati più compattamente

### 4. Passare il filtro paese selezionato alla ContactListPanel
**File**: `src/pages/Contacts.tsx`, `src/components/contacts/ContactListPanel.tsx`

Invece di ricevere `filterGroupKey` dalla GroupsSidebar rimossa, la ContactListPanel leggerà i paesi selezionati dal contesto globale (`crmSelectedCountries` o riutilizzando la logica `filterGroupKey` dal drawer).

## File coinvolti

| File | Modifica |
|------|----------|
| `src/pages/CRM.tsx` | Sostituire VerticalTabNav con tab orizzontali in alto |
| `src/pages/Contacts.tsx` | Rimuovere GroupsSidebar e ResizablePanel col.1, semplificare layout a 2 colonne |
| `src/components/global/FiltersDrawer.tsx` | Sezione CRM: aggiungere lista paesi con checkbox + cerca inline con risultati |
| `src/contexts/GlobalFiltersContext.tsx` | Aggiungere `crmSelectedCountries: Set<string>` se serve (o riusare groupBy+filterGroupKey) |

Nessuna migrazione DB, nessun nuovo componente. La struttura risultante sarà identica al Network: filtri e paesi nel drawer a sinistra, lista al centro, dettaglio a destra.

