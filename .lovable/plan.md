

## Piano: Layout a 3 Colonne per Network

### Situazione attuale
La pagina Network usa un layout a 2 colonne: paesi a sinistra (280px fisso), lista partner a destra. Il dettaglio partner è un **overlay assoluto** che copre completamente la lista partner — l'utente perde il contesto della lista.

### Cambio richiesto
Passare a un layout a **3 colonne affiancate**: Paesi | Lista Partner | Dettaglio Partner. Quando si seleziona un partner dalla lista, il dettaglio appare nella terza colonna senza nascondere la lista.

### Design

```text
┌──────────┬─────────────────────┬─────────────────────┐
│  Paesi   │   Lista Partner     │  Dettaglio Partner   │
│  (220px) │   (flex, min)       │  (flex, ~40%)        │
│          │                     │                      │
│  scroll  │   scroll            │  scroll              │
│          │   click → evidenzia │  PartnerDetailCompact│
└──────────┴─────────────────────┴─────────────────────┘
```

- **Senza selezione partner**: 2 colonne (paesi + lista) — la terza non appare
- **Con selezione partner**: 3 colonne — la lista si comprime ma resta visibile e navigabile
- **Colonna paesi**: ridotta da 280px a 220px quando il dettaglio è aperto, per recuperare spazio
- **Mobile**: invariato (colonna singola con overlay)

### File da modificare

**`src/pages/Operations.tsx`** — unico file:

1. Rimuovere l'overlay `absolute inset-0` del dettaglio partner (righe 304-321)
2. Sostituire con una **terza colonna** nel flex layout principale:
   - Colonna paesi: `w-[220px]` (o `w-[280px]` se no detail)
   - Colonna lista: `flex-1 min-w-0`
   - Colonna dettaglio: `w-[380px]` condizionale, visibile solo quando `selectedPartnerId && selectedPartner`
3. Aggiungere animazione `animate-in slide-in-from-right` sulla terza colonna
4. La lista partner (colonna 2) mantiene l'evidenziazione del partner selezionato tramite `selectedPartnerId` già passato a `PartnerListPanel`

Nessun altro file da toccare — `PartnerDetailCompact` e `PartnerListPanel` restano invariati.

