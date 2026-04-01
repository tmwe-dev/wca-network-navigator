

# Fix Visibilità Dati AI nelle Card del Cockpit

## Problemi identificati

1. **Il pannello espandibile si apre SOLO per contatti con `deepSearchAt`** — se fai Deep Search o LinkedIn Lookup su un contatto "manuale" e i dati non si salvano ancora, non hai modo di espandere la card
2. **Solo il pulsante ✨ togla l'espansione** — il click sulla card non fa nulla
3. **I dati LinkedIn "live" (dal flusso in corso) non vengono mostrati** nel pannello espanso — `enrichmentState.linkedinProfile` viene ignorato
4. **I dati enrichment vengono caricati solo per `imported_contacts`** — i `partner_contacts` non passano `enrichmentData` né `deepSearchAt` dal DB
5. **Pulsanti Deep Search e Alias nel footer sono fake** — mostrano solo un toast, creano confusione
6. **Menu 3 puntini sovrapposto ai badge** — posizionamento `absolute top-2 right-2` si scontra con Manuale/P6

## Modifiche

### 1. `CockpitContactCard.tsx` — Card espandibile ovunque + dati live

- **Click sulla card** togla `isExpanded` (esclusi checkbox, drag handle, pulsanti)
- Il pulsante ✨/chevron diventa visibile **sempre** (non solo se `isAiProcessed`), cambia icona: se ci sono dati → ✨, altrimenti → ChevronDown generico
- **Rimuovere le icone duplicate nel footer** (Search e Sparkles hover) — le azioni restano solo nel pannello espanso
- Nel pannello espanso, aggiungere sezione **"Dati LinkedIn Live"** se `enrichmentState?.linkedinProfile` esiste: mostra nome, headline, location, connectionStatus in un mini-riquadro blu
- Se `hasEnrichmentData` → mostra `ContactEnrichmentCard` (come ora)
- Se nessun dato → mostra pulsanti Deep Search + LinkedIn Lookup (come ora)
- Aggiungere `pr-8` al container interno per lasciare spazio al menu 3 puntini

### 2. `ContactStream.tsx` — Menu non sovrapposto

- Spostare il wrapper del `ContactActionMenu` da `absolute top-2 right-2` a `absolute bottom-2 right-2` con sfondo semi-trasparente (`bg-card/90 rounded-md`)
- Passare `enrichmentState` correttamente alla card (già fatto, ma verificare che `activeContactId` matchi)

### 3. `useCockpitContacts.ts` — Enrichment per partner_contacts

- Nella query dei partner, aggiungere `enrichment_data, enriched_at, ai_parsed_at` dalla tabella `partners`
- Mappare `deepSearchAt` e `enrichmentData` anche per `partner_contact` e `business_card` (se disponibili)
- Aggiungere `company_alias, contact_alias` nella select di `imported_contacts` e mapparli nell'interfaccia

### 4. `Cockpit.tsx` — Passare enrichmentState a ContactStream

- Verificare che `enrichmentState` (con `linkedinProfile`) venga correttamente propagato alla card attiva, anche durante LinkedIn Lookup singolo e Deep Search singolo

## File modificati

| File | Cosa |
|------|------|
| `src/components/cockpit/CockpitContactCard.tsx` | Card cliccabile, dati live LinkedIn, rimozione footer fake, padding per menu |
| `src/components/cockpit/ContactStream.tsx` | Menu spostato in basso, nessuna sovrapposizione |
| `src/hooks/useCockpitContacts.ts` | Enrichment data per tutti i source_type, alias visibili |

