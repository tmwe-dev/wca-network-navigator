

# Piano: Unificazione Tab Partner + Scarica in un Pannello Unico

## Problema

Attualmente COL 3 ha due tab separate: "Partner" (tastoni + lista) e "Scarica" (ActionPanel + Terminal + JobMonitor). L'utente deve saltare avanti e indietro. Il tasto "Scarica Profili" nei tastoni fa solo un `setActiveTab("download")` -- un passaggio in piu' inutile.

## Soluzione

Eliminare le Tabs. Il pannello destro diventa un unico flusso verticale scrollabile:

```text
┌──────────────────────────────────────────┐
│  🇹🇭 Thailand · 92 partner               │
│  Completamento: ██████████░░ 72%         │
├──────────────────────────────────────────┤
│ [📥 PROFILI] [🔍 DEEP] [🏷 ALIAS] [👤 ALIAS] │
├──────────────────────────────────────────┤
│ Profili  ██████████░░  78/92             │
│ Deep S.  ████░░░░░░░░  25/92             │
│ Email    ██████████░░  71/92             │
│ ...                                      │
├──────────────────────────────────────────┤
│ ▼ DOWNLOAD  [collapsible, aperto se     │
│   cliccato "Profili" o se job attivi]    │
│   Network: [Tutti ▾]                     │
│   Modalita': [Nuovi | Senza profilo | …] │
│   Delay: ████░░ 15s                      │
│   [⚡ Scarica 14 partner]               │
│   Terminal log...                        │
│   Active jobs...                         │
├──────────────────────────────────────────┤
│ [Cerca...] [Ordina]                      │
│ Lista partner scorrevole...              │
└──────────────────────────────────────────┘
```

## Dettaglio Tecnico

### 1. `PartnerListPanel.tsx` -- Integrazione download inline

Il componente assorbe la logica dell'`ActionPanel` direttamente al suo interno:

- **Sezione download collassabile** (`Collapsible`) posizionata tra le progress bar e la search bar
- Si apre automaticamente quando:
  - L'utente clicca il tasto "Profili" (anziche' switchare tab)
  - Ci sono job attivi per i paesi selezionati
- Contiene: selezione network, modalita' download (toggle chips anziche' dropdown), slider delay, bottone avvio, terminale compatto
- Le modalita' download diventano **3 toggle chips** inline: `Nuovi` | `Senza profilo` | `Tutti` -- piu' immediato di un dropdown
- Il terminale e il job monitor sono versioni compatte inline (max-height con scroll)

**Nuove props necessarie:**
- `onJobCreated?: (jobId: string) => void` -- per avviare il processore
- `directoryOnly?: boolean` + `onDirectoryOnlyChange?`

**Logica copiata dall'ActionPanel:**
- Query `directory-cache`, `db-partners-for-countries`, `no-profile-wca-ids`
- `handleStartScan`, `handleStartDownload`, `executeDownload`
- Directory scan con cache, cleanup stale partners, auto-download
- Stima tempo, slider delay, selezione network

### 2. `Operations.tsx` -- Rimozione Tabs

- Eliminare `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`
- Eliminare `activeTab` state
- Eliminare import di `ActionPanel`, `AdvancedTools`
- COL 3 diventa un singolo `PartnerListPanel` con tutte le props
- `ActiveJobBar` resta sopra il pannello
- `DownloadTerminal` e `JobMonitor` vengono rimossi dal livello Operations (integrati nel PartnerListPanel)

### 3. Componenti rimossi/semplificati

- `ActionPanel` non viene piu' importato in Operations (resta disponibile se usato altrove)
- `AdvancedTools` viene integrato come sezione collassabile dentro il pannello download del PartnerListPanel
- Le import di `Tabs` ecc. vengono rimosse da Operations

### 4. UX delle modalita' download

Le 3 modalita' diventano toggle chips orizzontali con contatori:

```text
[Nuovi (5)] [Senza profilo (14)] [Tutti (92)]
```

- Chip attivo evidenziato con colore
- Il chip "Solo Directory" diventa un toggle separato sopra
- Sotto i chips: slider delay + stima tempo + bottone avvio

### 5. Vista senza paese selezionato

Quando nessun paese e' selezionato, la COL 3 mostra:
- `ActiveJobBar` (se ci sono job)
- `DownloadTerminal` compatto (se ci sono job)
- `JobMonitor` (se ci sono job)
- Placeholder "Seleziona un paese" (se non ci sono job)

Questo rimane identico a oggi, nessun cambiamento.

## File modificati

1. **`src/components/operations/PartnerListPanel.tsx`** -- Integrazione completa della logica download: queries directory, scan, download, terminale compatto, toggle chips modalita'
2. **`src/pages/Operations.tsx`** -- Rimozione Tabs, semplificazione a pannello unico, rimozione import ActionPanel/AdvancedTools

## Nessuna migrazione DB

Tutto usa query e componenti esistenti. Nessun cambiamento backend.

