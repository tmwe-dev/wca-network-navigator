

# Nuova Tab "Circuito di Attesa" in Outreach

## Cosa serve

Una quinta tab in Outreach che mostri tutti i contatti/partner che sono entrati nel ciclo di vita commerciale (status != "new") con:
- Indicatore visivo del livello nel circuito (usando `HoldingPatternIndicator` gia' esistente)
- History completa: attivita', email inviate, interazioni, note
- Possibilita' di cambiare status direttamente
- Raggruppamento per livello (Contattato, In corso, Trattativa)

## Struttura

```text
[Cockpit] [Workspace] [In Uscita] [Attività] [Circuito]
```

Il tab "Circuito" mostra una vista master-detail:
- **Lista sinistra**: partner/contatti raggruppati per lead_status (Contattato → In corso → Trattativa), con contatore per gruppo, HoldingPatternIndicator compatto, nome azienda, ultimo contatto
- **Pannello destro** (al click): timeline cronologica completa con tutte le attivita', interazioni, email inviate — ogni entry con data, tipo (icona), dettaglio

## Sorgenti dati

I contatti nel circuito vengono da 3 tabelle:
- `partners` dove `lead_status NOT IN ('new', 'lost', 'converted')` — join con `interactions` e `activities`
- `prospects` con stessa logica — join con `prospect_interactions`
- `imported_contacts` con stessa logica — join con `contact_interactions`

La timeline unifica:
- `activities` (filtrate per partner_id/source_id)
- `interactions` (per partner)
- `email_campaign_queue` (status = 'sent', per partner_id)

## Dettagli tecnici

### Nuovo hook `useHoldingPattern.ts`
- Query che recupera partner con `lead_status IN ('contacted','in_progress','negotiation')` + conteggio attivita' per ciascuno
- Per il dettaglio: query separata che unifica activities + interactions + email_campaign_queue in una timeline ordinata per data

### Nuovo componente `HoldingPatternTab.tsx`
- Layout split: lista scrollabile a sinistra (40%), dettaglio a destra (60%)
- Lista raggruppata per status con accordion
- Ogni item: nome azienda, paese (flag), HoldingPatternIndicator compatto, data ultimo contatto
- Click apre il dettaglio con timeline verticale
- Possibilita' di cambiare lead_status dal pannello dettaglio

### Timeline nel dettaglio
Ogni entry mostra:
- Icona tipo (Mail, Phone, MessageSquare, FileText, etc.)
- Titolo + descrizione
- Data/ora
- Badge status (completata, pending, etc.)

## File coinvolti

| File | Azione |
|------|--------|
| `src/hooks/useHoldingPattern.ts` | **Nuovo** — query partner nel circuito + timeline dettaglio |
| `src/components/outreach/HoldingPatternTab.tsx` | **Nuovo** — vista master-detail con timeline |
| `src/pages/Outreach.tsx` | Aggiungere quinta tab "Circuito" |

Nessuna modifica al database — i dati esistono gia' nelle tabelle `partners`, `activities`, `interactions`, `email_campaign_queue`.

