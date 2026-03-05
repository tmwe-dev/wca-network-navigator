

## Redesign Filtri Contatti — Chiaro, Iconico, Intuitivo

### Problema attuale
I filtri sono una fila piatta di dropdown senza etichette visibili. Non è chiaro cosa ciascun selettore controlla. Mancano icone esplicative e separazione visiva.

### Soluzione
Ristrutturare `ContactFiltersBar.tsx` con un layout a blocchi etichettati, dove ogni filtro ha:
- **Icona** a sinistra che identifica immediatamente la funzione
- **Etichetta** sopra il campo (label piccola, sempre visibile)
- **Raggruppamento visivo** chiaro: ricerca in alto, poi filtri in blocchi separati

### Layout proposto

```text
┌─────────────────────────────────────────────────┐
│ 📁 Gruppo di carico                             │
│ [  Tutti i gruppi  ▼ ]                          │
├─────────────────────────────────────────────────┤
│ 🔍 [ Cerca azienda, nome, email...          ]   │
├─────────────────────────────────────────────────┤
│ 🌍 Paese      📌 Origine    🏷 Status    📊 Vista│
│ [ Tutti ▼ ]  [ Tutte ▼ ]  [ Tutti ▼ ] [Paese▼] │
├─────────────────────────────────────────────────┤
│ 📅 Periodo                                      │
│ [ Da... ]  →  [ A... ]                          │
└─────────────────────────────────────────────────┘
```

### Dettagli implementativi

Ogni filtro avvolto in un mini-blocco con:
```tsx
<div className="space-y-1">
  <label className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
    <Globe className="w-3 h-3" /> Paese
  </label>
  <Select ...>
</div>
```

Icone per ogni filtro:
- Gruppo: `FolderOpen`
- Ricerca: `Search`  
- Paese: `Globe`
- Origine: `MapPin`
- Status: `Tag`
- Raggruppa per: `LayoutGrid`
- Periodo: `Calendar`

### File da modificare

| File | Modifica |
|------|----------|
| `src/components/contacts/ContactFiltersBar.tsx` | Redesign completo con label + icone + layout a blocchi |

