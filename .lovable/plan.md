

# Percentuale Download Grande nella Card Paese

## Situazione attuale

La percentuale di completamento download (`dlPct = pCount / cCount`) esiste gia' nel codice (riga 245) ma viene mostrata piccola nel sottotitolo come testo `text-xs font-mono` insieme ad altri dati (es. "15/20 · 75%"). Non e' visivamente prominente.

## Modifica proposta

Aggiungere un **grande indicatore percentuale** sul lato destro di ogni card paese, ben visibile e separato dalle altre statistiche:

- **Posizione**: A destra, prima del badge directory e delle statistiche email/telefono
- **Dimensione**: `text-2xl font-extrabold` -- il dato piu' grande della card
- **Colore dinamico**: 
  - Verde (100%) -- download completo
  - Giallo/Ambra (1-99%) -- download parziale
  - Rosso (0%) -- nessun download
  - Grigio per paesi senza dati directory (nessuna percentuale mostrata)
- **Formato**: Numero grande con simbolo "%" piu' piccolo a fianco (es. **75**%)
- **Sfondo**: Mini-badge con bordo colorato per risaltare (come il badge directory gia' esistente)

### Logica

```
Se il paese ha dati nella directory (cCount > 0):
  dlPct = Math.round((pCount / cCount) * 100)
  Mostra: "75%" grande a destra
Altrimenti:
  Non mostra la percentuale (il paese non e' stato ancora scansionato)
```

### Layout card aggiornato

```
[Stripe] [Flag] [Nome + stato]          [%%] [Dir badge] [Email] [Phone] [Users] [✓]
```

La percentuale diventa il primo dato numerico che si legge a colpo d'occhio.

## File modificato

1. **`src/components/download/CountryGrid.tsx`** -- Aggiunta badge percentuale grande nella sezione "Right side stats" di ogni card, con colore dinamico basato su `dlPct`
