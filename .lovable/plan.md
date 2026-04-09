
# Piano: Riscrittura Completa Sezione Arricchimento

## Problemi identificati dallo screenshot
1. Lista piatta e brutta — nessun bordo colorato per origine, nessuna bandiera, nessun checkbox
2. Nessuna selezione (singola o bulk) — impossibile operare su singoli record
3. Nessuna azione contestuale per record (Deep Search, LinkedIn lookup, etc.)
4. I filtri sono nella sidebar Settings (VerticalTabNav filterSlot) ma mancano tab per fonte come in CRM
5. Manca header con "Seleziona tutti" e ordinamento inline
6. Le stat cards in alto occupano troppo spazio

## Soluzione

Ricostruire EnrichmentSettings usando gli stessi pattern visivi di ContactCard/BusinessCardsHub:
- Bordo sinistro colorato per origine (blu/viola WCA, verde contatti, ambra email, teal cockpit)
- Checkbox per selezione singola e bulk
- Bandiera paese grande
- Tab orizzontali per fonte (Tutti, WCA, Contatti, Email, Cockpit) con conteggi
- Header con "Seleziona tutti" + ordinamento
- UnifiedBulkActionBar per azioni di massa
- Azioni rapide per record singolo (Deep Search, LinkedIn, Logo)

## Dettaglio tecnico

### 1. EnrichmentSettings.tsx — Riscrittura completa

**Tab orizzontali** in alto per fonte (sostituiscono il filtro sidebar):
```
[Tutti (2357)] [WCA (1200)] [Contatti (800)] [Email (235)] [Cockpit (122)]
```

**Stats compatte** — riga orizzontale inline sotto i tab (non cards grandi)

**Header lista** con:
- Checkbox "Seleziona tutti"
- Colonne: Nome | Dominio | Paese | Fonte | Stato
- Click per ordinare

**Righe** stile ContactCard:
- Bordo sinistro 3px colorato per origine
- Checkbox di selezione
- Bandiera paese (emoji, testo grande)
- Nome azienda in grassetto
- Dominio sotto
- Badge fonte (WCA/Contatti/Email/Cockpit)
- Icone stato (LinkedIn ✓, Logo ✓)
- Menu azioni (⋮) per singolo record

**Bulk action bar** quando ci sono selezioni:
- LinkedIn Batch (contatti)
- Logo Batch (WCA)
- Deep Search
- Esporta

### 2. Settings.tsx — Rimuovere filterSlot per enrichment

I filtri per fonte ora sono tab interni alla pagina, non nella sidebar. Rimuovere lo state dei filtri enrichment da Settings.tsx e spostarlo dentro EnrichmentSettings.

### 3. EnrichmentFilters.tsx — Semplificare

Resta nella sidebar solo: ricerca + filtro stato dati (con/senza logo, linkedin, dominio) + ordinamento. I filtri "Fonte" si spostano nei tab interni.

## File coinvolti

| File | Azione |
|------|--------|
| `src/components/settings/EnrichmentSettings.tsx` | Riscrittura: tab fonte, header selezionabile, righe con bordo/bandiera/checkbox, bulk bar, azioni singole |
| `src/pages/Settings.tsx` | Semplificare: rimuovere stato filtri enrichment da qui, passare meno props |
| `src/components/settings/enrichment/EnrichmentFilters.tsx` | Rimuovere sezione "Fonte" (ora nei tab interni), mantenere solo stato dati + ordinamento |
| `src/components/settings/enrichment/EnrichmentBatchActions.tsx` | Integrare nella bulk action bar o eliminare (logica spostata nel componente principale) |

## Ordine di esecuzione

1. Riscrivere EnrichmentSettings con tab, selezione, righe styled
2. Aggiornare Settings.tsx per rimuovere stato filtri ridondante
3. Aggiornare EnrichmentFilters sidebar (solo stato dati)
4. Integrare bulk actions nella nuova UI
