

# Sfondo Dorato per Contatti Gestiti da AI

## Cosa cambia

Nella lista contatti a sinistra, le card dei contatti che hanno `deep_search_at` valorizzato (= processati da AI/Deep Search) avranno uno **sfondo dorato** invece del normale sfondo.

## Modifica

### File: `src/components/contacts/ContactCard.tsx`

- Aggiungere un check: `const isAiProcessed = !!c.deep_search_at`
- Modificare le classi CSS della card:
  - Se `isAiProcessed` e NON attivo/selezionato → bordo ambra leggero + sfondo `bg-amber-500/8` (dorato tenue)
  - Se `isAiProcessed` e attivo → `border-amber-400 bg-amber-500/15 shadow-md` (dorato forte)
  - Se `isAiProcessed` e selezionato → `border-amber-400/40 bg-amber-500/10`
  - Se NON `isAiProcessed` → resta tutto come ora (bordo standard, sfondo card)
- Aggiungere una piccola icona ✨ (Sparkles) color ambra accanto al nome per rendere chiaro visivamente che è stato gestito da AI

### Risultato visivo

| Stato | Sfondo attuale | Sfondo nuovo |
|-------|---------------|-------------|
| Contatto normale | Grigio/card | Grigio/card (invariato) |
| Contatto AI | Grigio/card | **Dorato tenue** |
| Contatto AI attivo | Blu/primary | **Dorato intenso** |

Un file modificato, nessuna logica backend.

