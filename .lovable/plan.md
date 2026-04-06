
# Tab orizzontali per gruppo nella lista partner (Network) e contatti (CRM)

## Concetto

Quando l'utente seleziona più paesi nel Network o apre più gruppi nel CRM, invece di mostrare tutto in una lista mista, si aggiunge una barra di tab orizzontali scrollabile sopra la lista. Ogni tab corrisponde a un paese/gruppo e filtra la lista mostrando solo gli elementi di quel tab.

## Network — `PartnerListPanel.tsx`

**Quando**: `countryCodes.length > 1`

Aggiungere sopra `PartnerVirtualList` una barra di tab orizzontali con:
- Un tab per ogni paese selezionato: `🇪🇸 Spain`, `🇮🇹 Italy`, ecc.
- Un tab "Tutti" all'inizio per mostrare la lista completa (default)
- Tab attivo evidenziato con stile primary
- Overflow-x scrollabile per molti paesi

Stato locale `activeCountryTab: string | null` (null = tutti). Quando un tab è attivo, i partner vengono filtrati client-side per `country_code === activeCountryTab` prima di passarli a `PartnerVirtualList`.

```text
[ Tutti | 🇪🇸 Spain (180) | 🇮🇹 Italy (220) | 🇵🇦 Panama (152) ]
──────────────────────────────────────────────────
  Partner list filtrata per il tab attivo
```

## CRM — `ContactListPanel.tsx`

**Quando**: `groups.length > 1` (più gruppi visibili nella lista)

Stessa logica: barra tab orizzontali sopra la lista dei gruppi con:
- Un tab per ogni gruppo visibile: nome del gruppo + conteggio
- Tab "Tutti" come default
- Stato `activeGroupTab: string | null`
- Quando attivo, `groups.filter(g => g.group_key === activeGroupTab)` mostra solo quel gruppo

## File coinvolti

| File | Modifica |
|------|----------|
| `src/components/operations/PartnerListPanel.tsx` | Aggiungere stato `activeCountryTab`, barra tab, filtro client-side su `filteredPartners` |
| `src/components/contacts/ContactListPanel.tsx` | Aggiungere stato `activeGroupTab`, barra tab, filtro su `groups` renderizzati |

Nessun nuovo componente necessario — i tab sono semplici button inline con stile scrollabile. Nessuna modifica DB.
