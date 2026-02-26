

# Piano: Tastoni Azione e Barre di Progresso nel Pannello Operations

## Problema

La pagina Operations (COL 3, tab "Partner") usa il componente `PartnerListPanel` che mostra solo statistiche compatte e una lista partner. Manca completamente l'approccio "wizard con tastoni" gia' implementato nel `CountryWorkbench` del Partner Hub. L'utente vuole la stessa esperienza operativa: grossi pulsanti azione + barre di progresso + filtri intelligenti.

## Cosa cambia

### `PartnerListPanel.tsx` -- Ristrutturazione completa

Aggiungere sopra la lista partner:

**4 Tastoni Azione** (stessa logica del CountryWorkbench, adattati al tema dark/light di Operations):
1. **Scarica Profili** -- conta partner senza `raw_profile_html`, click naviga a tab "download" con modalita' `no_profile` preselezionata
2. **Deep Search** -- conta partner con profilo ma senza `enrichment_data.deep_search_at`, click avvia deep search massiva
3. **Genera Alias Aziende** -- conta partner senza `company_alias`, click invoca edge function
4. **Genera Alias Contatti** -- conta partner senza `contact_alias` nei contatti, click invoca edge function

Colori: verde (0 mancanti), ambra (parziale), rosso (>50% mancanti). Compatibili col tema dark di Operations.

**6 Barre di Progresso** cliccabili (sotto i tastoni):
- Profili, Deep Search, Email, Telefono, Alias Azienda, Alias Contatto
- Click su una barra filtra la lista sotto per mostrare solo i partner mancanti di quel dato

**Barra completamento globale** nell'header con percentuale.

### Nuove Props

`PartnerListPanel` riceve nuove callback:
- `onSwitchToDownload?: () => void` -- per passare al tab download quando si clicca "Scarica Profili"
- `onDeepSearch?: (partnerIds: string[]) => void` -- deep search massiva
- `onGenerateAliases?: (countryCodes: string[], type: "company" | "contact") => void` -- generazione alias

### `Operations.tsx` -- Nuove callback e collegamento

- Implementare `handleDeepSearch` (loop sequenziale come in PartnerHub)
- Implementare `handleGenerateAliases` (invoke edge function)
- Passare `onSwitchToDownload={() => setActiveTab("download")}` al PartnerListPanel
- Collegare le callback al pannello

### Calcolo Stats

Tutti i dati necessari sono gia' disponibili dal hook `usePartners` che include `raw_profile_html`, `enrichment_data`, `company_alias`, e `partner_contacts` con `contact_alias`. I conteggi vengono calcolati con `useMemo` sui partner filtrati per paese.

### Layout Finale (COL 3, tab Partner)

```text
┌──────────────────────────────────────────┐
│  Completamento: ██████████░░ 72%         │
├──────────────────────────────────────────┤
│ [📥 PROFILI] [🔍 DEEP]  [🏷 ALIAS] [👤 ALIAS] │
│  14 mancanti  67 manc.   42 manc.  38 manc. │
├──────────────────────────────────────────┤
│ Profili  ██████████░░  78/92             │
│ Deep S.  ████░░░░░░░░  25/92             │
│ Email    ██████████░░  71/92             │
│ Telefono █████░░░░░░░  45/92             │
│ Alias Az ██████░░░░░░  50/92             │
│ Alias Ct ████░░░░░░░░  34/92             │
├──────────────────────────────────────────┤
│ [Cerca...] [Ordina] [Filtro attivo]      │
│ Lista partner scorrevole...              │
└──────────────────────────────────────────┘
```

### Nessuna migrazione DB

Tutti i campi esistono gia'. Nessun cambiamento backend.

## File modificati

1. `src/components/operations/PartnerListPanel.tsx` -- Aggiunta tastoni, barre progresso, filtri da barra, logica deep search/alias inline
2. `src/pages/Operations.tsx` -- Nuove callback `handleDeepSearch`, `handleGenerateAliases`, props aggiuntive a PartnerListPanel

