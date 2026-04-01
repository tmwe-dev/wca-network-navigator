

# Applicare Tooltips Ricchi e Sfondo Dorato AI a Tutto il Programma

## Problema

Le modifiche (tooltips informativi sulle icone/badge e sfondo dorato per contatti gestiti da AI) sono state applicate solo a `ContactCard.tsx` nella pagina Contatti. Le card del **Cockpit** e dell'**Agenda** non hanno ricevuto nessuna di queste migliorie.

## Componenti da aggiornare

### 1. `src/components/cockpit/CockpitContactCard.tsx`

**Sfondo dorato AI:**
- La card attualmente non ha accesso a `deep_search_at` o `enrichment_data` — il suo `Contact` interface non li include
- Aggiungere `deepSearchAt?: string` e `enrichmentData?: any` all'interface `Contact`
- Applicare lo stesso trattamento amber/dorato quando `deepSearchAt` e presente (sfondo `bg-amber-500/[0.08]`, bordo `border-amber-400/30`, icona Sparkles dorata)
- Mostrare headline LinkedIn dall'`enrichmentData` sotto il ruolo

**Tooltips ricchi:**
- Sostituire tutti i `title="..."` con componenti `Tooltip` di Radix
- Icone canale (Mail, LinkedIn, WhatsApp, SMS): tooltip che spiega se il dato e disponibile e mostra il valore (es. "Email: john@example.com" o "Email non disponibile")
- Badge priorita: tooltip "Priorita X — [urgente/alta/media/bassa]"
- Badge origine (WCA/BCA/Import): tooltip con `originDetail` completo
- Badge "Fatto": tooltip con spiegazione
- Badge LinkedIn status: tooltip con stato connessione

### 2. `src/components/cockpit/CockpitContactListItem.tsx`

- Aggiungere `deepSearchAt?: string` all'interface
- Sfondo dorato se AI-processed (riga con `bg-amber-500/[0.08]`)
- Piccola icona Sparkles dorata accanto al nome
- Tooltips sulle icone canale e badge origine/priorita

### 3. `src/components/agenda/AgendaCardView.tsx`

- Le card partner gia mostrano icone (Mail, Phone, Globe) e badge (lead_status, networks)
- Aggiungere tooltips informativi: badge lead_status con spiegazione, icone con valori reali (email/telefono effettivi), networks con lista completa
- Se il partner ha `enrichment_data` con deep search, applicare bordo dorato

### 4. Dati necessari dal Cockpit parent

Il componente `ContactStream.tsx` (o chi passa i dati alle card) deve includere `deep_search_at` e `enrichment_data` nei dati passati. Verificare che la query che alimenta il Cockpit li carichi gia, altrimenti aggiungerli al select.

## Dettagli tecnici

- Riutilizzare lo stesso pattern `InfoTooltip` gia creato in `ContactCard.tsx`, estraendolo in un componente condiviso (`src/components/ui/InfoTooltip.tsx`) per evitare duplicazione
- Wrappare tutto in `TooltipProvider` dove non e gia presente
- Nessuna modifica backend, solo UI

## File modificati

| File | Cosa cambia |
|------|-------------|
| `src/components/ui/InfoTooltip.tsx` | **Nuovo** — componente tooltip riutilizzabile estratto da ContactCard |
| `src/components/cockpit/CockpitContactCard.tsx` | Tooltips + sfondo dorato AI + headline preview |
| `src/components/cockpit/CockpitContactListItem.tsx` | Tooltips + indicatore dorato AI |
| `src/components/agenda/AgendaCardView.tsx` | Tooltips su icone e badge |
| `src/components/cockpit/ContactStream.tsx` | Passare `deep_search_at` e `enrichment_data` alle card (se non gia fatto) |
| `src/components/contacts/ContactCard.tsx` | Refactor per usare InfoTooltip condiviso |

