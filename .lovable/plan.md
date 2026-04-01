

# Pannello Dati AI Visibile e Cliccabile nelle Card del Cockpit

## Problema

Quando lanci LinkedIn Lookup o Deep Search dal Cockpit, non vedi nessun feedback di progresso e dopo il completamento non puoi accedere ai dati estratti. L'unico modo attuale è passare il mouse sopra una piccola icona ✨ che mostra un tooltip con poche righe — inutilizzabile.

## Soluzione

Rendere la card del Cockpit **cliccabile** per espandere un pannello inline che mostra tutti i dati AI estratti, riutilizzando il componente `ContactEnrichmentCard` già esistente (profilo professionale, profilo aziendale, link social, seniority, lingue, specialties, awards, news).

## Modifiche

### 1. `CockpitContactCard.tsx` — Card espandibile al click

- Aggiungere stato `isExpanded` locale
- Click sulla card (non su checkbox/drag/buttons) togla `isExpanded`
- Quando espansa, sotto il contenuto attuale mostrare il `ContactEnrichmentCard` con `enrichmentData` e `deepSearchAt`
- Se non ci sono dati enrichment: mostrare un messaggio "Nessun dato AI — lancia Deep Search o LinkedIn Lookup"
- L'icona ✨ diventa un **pulsante** cliccabile (non solo tooltip) che espande/chiude il pannello
- Aggiungere una piccola icona chevron ▾/▴ accanto alla ✨ per indicare che è espandibile

### 2. `ContactStream.tsx` — Passare callback per LinkedIn Lookup singolo

- Aggiungere prop `onSingleLinkedInLookup` per permettere il lookup dal pannello espanso della card
- Il pannello espanso mostra pulsanti "🔍 Deep Search" e "🔗 LinkedIn Lookup" se i dati mancano

### 3. `CockpitContactCard.tsx` — Aggiungere prop `onLinkedInLookup`

- Nuovo callback opzionale per lanciare il lookup dalla card
- Nel pannello espanso: pulsanti azione per Deep Search e LinkedIn Lookup

## File coinvolti

| File | Modifica |
|------|----------|
| `src/components/cockpit/CockpitContactCard.tsx` | Stato espandibile, render `ContactEnrichmentCard`, pulsanti azione inline |
| `src/components/cockpit/ContactStream.tsx` | Passare `onSingleLinkedInLookup` alla card |
| `src/pages/Cockpit.tsx` | Collegare `onSingleLinkedInLookup` al hook esistente |

## Risultato

- Click su ✨ o sulla card → si espande il pannello con tutti i dati AI
- Profilo professionale, aziendale, link social, awards tutto visibile
- Se dati assenti → pulsanti per lanciare Deep Search o LinkedIn Lookup direttamente dalla card
- Nessun componente nuovo — riuso di `ContactEnrichmentCard` già pronto

