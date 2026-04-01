

# Ristrutturazione Mission Drawer (Sidebar Destra)

## Problemi attuali

1. **Obiettivo e Proposta** sono semplici textarea senza il ContentPicker automatizzato (già disponibile e usato altrove)
2. **Qualità AI** è in basso — dovrebbe stare in alto come prima scelta strategica
3. **Preset** è in fondo, poco visibile — va spostato in alto come selettore rapido di configurazione
4. **Textarea troppo piccole** per contenuti ampi (80px e 100px min-height)

## Modifiche — `src/components/global/MissionDrawer.tsx`

### Nuovo ordine delle sezioni (dall'alto verso il basso):

1. **Header** (invariato)
2. **Preset** — spostato subito sotto l'header come selettore rapido (Select + salva/elimina) con sfondo leggero per distinguerlo
3. **Qualità AI** — spostato subito dopo il preset, sempre visibile (non collassabile), con QualitySelector size="md"
4. **Obiettivo** — textarea più grande (`min-h-[120px]`) + **ContentPicker type="goals"** sopra la textarea per selezionare rapidamente un obiettivo predefinito che popola il campo
5. **Proposta Base** — textarea più grande (`min-h-[160px]`) + **ContentPicker type="proposals"** sopra la textarea per selezionare rapidamente una proposta che popola il campo
6. **Documenti** (invariato, collapsible)
7. **Link di Riferimento** (invariato, collapsible)

### Integrazione ContentPicker

Per Obiettivo e Proposta, aggiungere `<ContentPicker>` sopra la Textarea:
- `type="goals"` per Obiettivo, `type="proposals"` per Proposta
- `onSelect` popola la textarea corrispondente (`m.setGoal` / `m.setBaseProposal`)
- `selectedText` mostra quale preset contenuto è attivo
- Il ContentPicker mostra la griglia di card con icone e categorie già implementata

### Preset in alto

Il blocco Preset (Select + Input nome + Salva/Elimina) viene spostato subito sotto l'header in un box con `bg-muted/20 rounded-lg p-3` per dare rilevanza visiva.

### Qualità AI non collassabile

Rimuovere il wrapper `Section` collapsible per Qualità AI — mostrarla direttamente con un label e il `QualitySelector` a tutta larghezza.

## File modificati

| File | Cosa |
|------|------|
| `src/components/global/MissionDrawer.tsx` | Riordino sezioni, ContentPicker per goal/proposal, textarea più grandi, preset in alto, qualità AI fissa in alto |

