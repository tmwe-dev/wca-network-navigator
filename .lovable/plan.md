

# Allineamento card contatti a colonne + conteggio nei chip filtro

## Problemi dallo screenshot

1. **Città e Paese sotto il nome azienda** a sinistra (riga 2) — devono stare sotto le rispettive colonne header (Città, Paese)
2. **Origine nel badge** non allineata sotto la colonna "Origine" — è nella riga 1 a destra
3. **Email** disallineata — non sotto una colonna dedicata
4. **Chip filtro attivo** (es. "AEROSPAZIALE ✕") non mostra il conteggio dei risultati filtrati
5. **"Cliente" appare come nome contatto** quando non c'è un nome — non deve mostrare niente se non c'è nome reale

## Soluzione: layout a griglia con colonne allineate all'header

Le colonne dell'header e le righe della card devono avere le stesse larghezze fisse. Ogni valore va nella colonna corrispondente.

### Layout card (2 righe, stesse colonne dell'header)

```text
HEADER:   [#/□  🏳]  [Azienda ↕      ]  [Contatto ↕    ]  [Città ↕  ]  [Paese ↕  ]  [Origine ↕  ]
RIGA 1:   #33 □  🇮🇹   CHECK SOLUTION srl  Lorena · CEO      Milano       Italy        AEROSPAZIALE
RIGA 2:              (indicatori)          mario@email.com   (lead st.)   (interaz.)   (azioni)
```

Struttura a `grid` con `grid-template-columns` identiche tra header e card:
- Col 1: `42px` — index + checkbox
- Col 2: `20px` — bandiera
- Col 3: `1fr` (min 140px) — Azienda (riga 1) / indicatori (riga 2)
- Col 4: `1fr` (min 120px) — Contatto (riga 1) / Email con icona (riga 2)
- Col 5: `90px` — Città (riga 1) / lead status (riga 2)
- Col 6: `80px` — Paese (riga 1) / interazioni (riga 2)
- Col 7: `90px` — Origine badge (riga 1) / azioni (riga 2)

### Chip filtro con conteggio

Il chip "AEROSPAZIALE ✕" diventa **"AEROSPAZIALE (84) ✕"** — mostrando `totalCount` dal query corrente.

### Fix "Cliente" come nome contatto

Se `c.name` non esiste, non mostrare nulla (trattino `—`), non "Cliente".

## File coinvolti

| File | Modifica |
|------|----------|
| `src/components/contacts/ContactCard.tsx` | Ristrutturare layout: spostare città, paese, origine nelle colonne corrette usando grid con stesse larghezze dell'header; riga 2 con email sotto "Contatto", lead status sotto "Città"; rimuovere "Cliente" fallback |
| `src/components/contacts/ContactListPanel.tsx` | Header ordinabile con grid identiche alla card; chip filtro con `(totalCount)` incluso; grid-template-columns condiviso come costante |

Nessuna migrazione DB.

