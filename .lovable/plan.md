

## Piano: Filtro Circuito di Attesa nella barra filtri Contatti

### Obiettivo

Aggiungere un toggle nella riga "Raggruppa" (Row 3) della `ContactFiltersBar` che permetta di filtrare i contatti per stato del circuito di attesa:
- **Default attivo**: mostra solo contatti NON nel circuito (interaction_count = 0, lead_status = "new")
- **Disattivato**: mostra tutti, inclusi quelli nel circuito

### Modifiche

**1. `src/hooks/useContacts.ts`** — Aggiungere campo `holdingPattern` ai filtri

- Aggiungere `holdingPattern?: "out" | "in" | "all"` a `ContactFilters`
- Nella query `useContacts`: se `holdingPattern === "out"` → `q = q.eq("interaction_count", 0)`; se `"in"` → `q = q.gt("interaction_count", 0)`
- Stessa logica in `useContactsByGroup` se usato per il conteggio

**2. `src/hooks/useContactGroups.ts`** — Propagare il filtro holdingPattern anche nei conteggi dei gruppi

**3. `src/components/contacts/ContactFiltersBar.tsx`** — UI del toggle

- Nella Row 3 (accanto ai pulsanti Raggruppa), aggiungere un separatore e due pulsanti toggle:
  - Icona `Plane` (o `CircleDot`) per "In circuito" 
  - Icona `PlaneLanding` (o simile) per "Fuori circuito" (default attivo)
  - "Tutti" come terza opzione
- Stile coerente con i pulsanti di raggruppamento esistenti

**4. `src/components/contacts/ContactListPanel.tsx`** — Inizializzare il filtro default

- Impostare `holdingPattern: "out"` come valore iniziale nello state dei filtri, così di default si vedono solo i contatti non ancora nel circuito

### Layout risultante (Row 3)

```text
Raggruppa: [🌍] [📍] [🏷] [📅]  |  Circuito: [✈ Tutti] [🔴 In attesa] [⚪ Da lavorare ←default]
```

