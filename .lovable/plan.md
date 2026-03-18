

## Riorganizzazione Header Rubrica Partner — Vista Paesi

### Situazione attuale
- Header: "Rubrica Partner" + badge contatore + toggle Paesi/Lista
- CountryCards ha il suo search interno + dropdown sort + totali "44 paesi / 1554 partner"
- Duplicazione: il badge nell'header mostra 1466 (filteredPartners dal query usePartners), i totali nel CountryCards mostrano numeri diversi (da useCountryStats)
- Il dropdown sort (Nome/Totale partner) occupa spazio inutilmente

### Modifiche proposte

#### 1. Header PartnerHub — ristrutturato
```text
┌───────────────────────────────────────────────────────┐
│ 🌐 Rubrica Partner                                    │
│                                                       │
│ [44 paesi │ 1554 partner]   [🔍 Cerca paese...]   [🤖]│
│  ↑ toggle view + sort       ↑ search centrale     AI  │
└───────────────────────────────────────────────────────┘
```

- **Sinistra**: Il toggle Paesi/Lista diventa anche indicatore dei totali:
  - `📍 44 Paesi` — cliccando vai a vista paesi E ordini per nome paese
  - `👥 1554 Partner` — cliccando vai a vista lista E ordini per num. partner
  - Il numero è preso da `useCountryStats` (unica fonte di verità)
  - Il tab attivo ha sfondo evidenziato
- **Centro**: Campo search (quando in vista paesi cerca paese, quando in lista cerca partner)
- **Destra**: Bottone AI assistant (già presente globalmente, ma può restare come shortcut)

#### 2. CountryCards — semplificato
- Rimuovere il search interno (spostato nell'header)
- Rimuovere il dropdown sort (gestito dal toggle nell'header)
- Rimuovere la riga totali (già nell'header)
- Il componente riceve `search` e `sortBy` come props dal parent
- Rimane solo la ScrollArea con le country cards

#### 3. File coinvolti
1. **`src/pages/PartnerHub.tsx`** — header ristrutturato, search condiviso, passa props a CountryCards
2. **`src/components/partners/CountryCards.tsx`** — rimuove header interno, riceve search/sortBy come props

#### 4. Dettagli tecnici
- Il badge contatore `1466` attuale viene rimosso (era da `filteredPartners.length` che non ha senso nella vista paesi)
- I totali vengono da `useCountryStats` che è già usato in CountryCards — va importato anche nel parent PartnerHub
- Il sort nella vista paesi alterna tra `"name"` e `"total"` (ordinamento country cards)
- Il search nella vista paesi filtra i paesi; nella vista lista filtra i partner (comportamento già presente, solo spostato)

