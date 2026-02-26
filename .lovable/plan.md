

# Piano: Country Workbench con "Tastoni Azione" Intelligenti

## Contesto e Obiettivo

Attualmente il Country Workbench (Livello 2 del Partner Hub) mostra filtri chip per esplorare i dati, ma non offre **azioni dirette**. L'utente deve navigare altrove (Operations, Email Composer) per operare. L'obiettivo e' trasformare il Workbench in un "mago operativo" dove grossi pulsanti guidano l'utente passo-passo nel completamento dei dati, senza pensare.

## Architettura della UI

```text
┌─────────────────────────────────────────────┐
│  ← 🇹🇭 Thailand  ·  92 partner             │
│  ━━━━━━━━━━━━━━━━ 78% completamento ━━━━━  │
├─────────────────────────────────────────────┤
│                                             │
│  ┌─────────────┐  ┌─────────────┐          │
│  │ 📥 SCARICA  │  │ 🔍 DEEP     │          │
│  │ 14 profili  │  │ SEARCH      │          │
│  │ mancanti    │  │ 67 mancanti │          │
│  └─────────────┘  └─────────────┘          │
│  ┌─────────────┐  ┌─────────────┐          │
│  │ 🏷️ GENERA   │  │ 📧 GENERA   │          │
│  │ ALIAS       │  │ ALIAS       │          │
│  │ 42 aziende  │  │ CONTATTI    │          │
│  │ senza alias │  │ 38 mancanti │          │
│  └─────────────┘  └─────────────┘          │
│                                             │
│  ── Riepilogo Dati ──────────────────────  │
│  Profili  ██████████░░  78/92              │
│  Deep S.  ████░░░░░░░░  25/92              │
│  Email    ██████████░░  71/92              │
│  Telefono █████░░░░░░░  45/92              │
│  Alias Az ██████░░░░░░  50/92              │
│  Alias Ct ████░░░░░░░░  34/92              │
│                                             │
│  ── Lista Partner (filtro attivo) ────────  │
│  [chip filtri come ora, sotto le barre]    │
│  ...lista partner scorrevole...            │
└─────────────────────────────────────────────┘
```

## Dettaglio dei "Tastoni"

Ogni tasto e' un grosso pulsante card con:
- Icona grande + titolo azione
- Contatore dei partner da elaborare (dato dinamico)
- Colore: **verde** se completato (0 mancanti), **ambra** se parziale, **rosso** se critico (>50% mancanti)
- Click diretto = avvia l'azione senza ulteriori conferme

### 1. Scarica Profili Mancanti
- Conta: partner senza `raw_profile_html`
- Azione: naviga a Operations con il paese preselezionato (come gia' fa `onDownloadProfiles`)
- Disabilitato se 0

### 2. Deep Search
- Conta: partner con profilo ma senza `enrichment_data.deep_search_at`
- Azione: seleziona automaticamente tutti quelli senza deep search, avvia `handleBulkDeepSearch` gia' esistente
- Mostra progresso inline nel tasto stesso

### 3. Genera Alias Aziende
- Conta: partner senza `company_alias`
- Azione: invoca `generate-aliases` con `countryCodes: [countryCode]`
- Mostra spinner durante l'operazione

### 4. Genera Alias Contatti
- Conta: contatti senza `contact_alias`
- Azione: stessa edge function con flag per alias contatti

## Barre di Progresso (Riepilogo Visivo)

Sotto i tastoni, 6 barre di progresso orizzontali mostrano lo stato di completamento:
- Profili scaricati (X / totale)
- Deep Search completate (X / totale)
- Email presenti (X / totale)
- Telefono presenti (X / totale)
- Alias azienda (X / totale)
- Alias contatto (X / totale)

Ogni barra e' cliccabile e attiva il filtro corrispondente sulla lista sotto (es. click su "Email" filtra per "senza email").

## Modifiche Tecniche

### 1. `CountryWorkbench.tsx` -- Ristrutturazione completa
- Aggiungere nuove props: `onDeepSearch`, `onGenerateAliases`
- Calcolare nuovi contatori: `withAlias`, `withContactAlias`, `withDeepSearch`
- Sezione tastoni sopra i filtri chip
- Sezione barre di progresso tra tastoni e lista
- I filtri chip restano ma diventano secondari (sotto le barre)

### 2. `PartnerHub.tsx` -- Nuove callback
- `handleCountryDeepSearch(countryCode)`: seleziona tutti i partner del paese senza deep search, avvia loop
- `handleGenerateAliases(countryCode)`: invoca edge function `generate-aliases` con il paese
- Passare queste callback al Workbench

### 3. Dati aggiuntivi necessari
- `company_alias` e' gia' nella tabella `partners` -- il hook `usePartners` lo deve includere nel select (verificare)
- `contact_alias` e' gia' nella tabella `partner_contacts` -- disponibile via relazione

### 4. Nessuna migrazione DB necessaria
- Tutti i campi (`company_alias`, `contact_alias`, `raw_profile_html`, `enrichment_data`) esistono gia'

## Sincronizzazione dei Contatori

I tastoni si aggiornano automaticamente tramite `queryClient.invalidateQueries(["partners"])` che gia' viene chiamato dopo deep search e alias generation. Le barre di progresso sono calcolate in un `useMemo` dai dati dei partner filtrati per paese.

## Priorita' Visiva

I tastoni sono ordinati per urgenza: quelli con piu' gap (rossi) appaiono prima. Se un tasto ha 0 mancanti, diventa verde con checkmark e non e' cliccabile.

