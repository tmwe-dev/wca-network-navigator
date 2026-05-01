## Obiettivo

Una sola riga sotto i tab principali in **Esplora → WCA Partner / Contatti CRM / Biglietti**. Tutti i filtri vivono **solo nella sidebar sinistra**. Là fuori si mostrano **solo badge riassuntivi dei filtri attivi** (esattamente come oggi compaiono "✈️ Fuori circuito" e "Tutti") + **ordinamenti** + **azioni**.

## Diagnosi attuale (Contatti CRM)

Oggi sotto i tab compaiono 3 strisce:

```text
1. "11349 contatti  ✈ Fuori circuito  Tutti  WCA✓  Solo CRM       Segmenti  +Nuovo"   ← header
2. "Paese ▾   Tutti(11381)  🇦🇫 AF(1)  🇦🇱 AL(1)  🇦🇴 AO(6) …"                       ← bandierine paesi
3. "Azienda ⇅   Contatto ⇅   Città ⇅   Origine ⇅"                                       ← header colonne
```

La striscia 2 (bandierine paesi e dropdown Raggruppa-per) è la più rumorosa. La sidebar ha già "Paesi", "Raggruppa per", "Match WCA", "Circuito", "Stato", "Origine", "Canale", "Qualità" — quindi è ridondanza pura.

## Nuovo standard "Toolbar Unica con Badge dei Filtri"

Una sola riga, identica per CRM, WCA Partner e Biglietti:

```text
┌────────────────────────────────────────────────────────────────────────────────────┐
│ 11.349 contatti  ✈ Fuori circuito ×   🇮🇹 Italy ×   WCA ✓ ×        Ordina ▾  +Nuovo│
└────────────────────────────────────────────────────────────────────────────────────┘
```

Composizione, da sinistra a destra:

1. **Contatore totale** (es. "11.349 contatti", "39 partner · 1 paese", "372 biglietti · 302 aziende"). Cliccando apre la sidebar filtri.
2. **Badge dei filtri attivi**, lo stile è **già quello di "✈ Fuori circuito" / "Tutti"** (pillola colorata) — viene riusato per tutto:
   - Circuito → "✈ Fuori circuito" / "✈ In circuito"
   - Match WCA → "WCA ✓" / "Solo CRM"
   - Paesi selezionati → "🇮🇹 Italy", "🇩🇪 Germany" (max 3 mostrati, poi "+N")
   - Origine → "Origine: WCA, Import"
   - Stato → "Stato: Lead"
   - Qualità → "Qualità: Alta"
   - Canale → "Canale: Email"
   - Raggruppa-per (se ≠ default) → "Raggruppa: Origine"
   - Cerca → "🔍 keyword"
   
   Ogni badge ha la **×** per rimuovere il filtro al volo. Senza filtri attivi compare solo il badge neutro "Tutti".

3. **Bottone Ordina ▾** (popover): sostituisce gli header colonne come fonte primaria — opzioni Azienda / Contatto / Città / Origine / Più recenti, con asc/desc. L'header colonne sotto la lista resta visibile ma puramente come etichette (cliccabile come scorciatoia, ma non più obbligatorio).

4. **Azioni contestuali** (variano per pagina):
   - CRM: `Segmenti`, `+ Nuovo`
   - Partner: `Sincronizza`, `Deep Search`
   - Biglietti: `Timeline`, `Sincronizza`, `+ Nuovo`

**Tutto il resto sparisce dalla pagina**: bandierine orizzontali, dropdown "Paese / Origine / Stato / Mese", chip "Tutti / Matchati / Non matchati", toggle "WCA✓ / Solo CRM" come bottoni separati, dropdown "Raggruppa per". Si gestiscono **esclusivamente** dalla sidebar (icona ◧ a sinistra), che resta la SSOT dei filtri.

## Estensione cross-pagina

| Pagina           | Stato oggi              | Allineamento                                  |
|------------------|-------------------------|-----------------------------------------------|
| Biglietti        | Già pulita (riferimento)| aggiungere chip filtri attivi                 |
| WCA Partner      | Manca toolbar standard  | aggiungere toolbar + chip + Ordina            |
| Contatti CRM     | 3 righe ridondanti      | collassare in 1 riga, bandierine → sidebar    |

Il pannello "Qualità Portfolio BCA" diventa un componente riusabile **collassato di default**, disponibile come seconda riga opzionale anche su CRM e Partner con metriche pertinenti.

## File toccati (orientativo)

- `src/components/contacts/ContactListPanel.tsx` — collassa righe 2 e 3 nella nuova toolbar; rimuove bandierine, dropdown raggruppa-per, chip WCA-match.
- `src/components/operations/OperationsView.tsx` (lista partner usata in NetworkPage) — aggiunge stessa toolbar.
- Nuovo componente condiviso `src/components/shared/entity-toolbar/UnifiedListToolbar.tsx` — render di contatore + badge filtri attivi (riusa lo stile pillola esistente di "✈ Fuori circuito") + sort popover + slot azioni.
- Nuovo helper `src/components/shared/entity-toolbar/useActiveFilterChips.ts` — legge `useGlobalFilters` e produce l'array `{key,label,onRemove}` per i chip.
- Nessuna modifica a `filters-drawer/`: resta la SSOT.
- Nessuna modifica a hook di business logic, DAL o edge functions.

## Risultato atteso

- **Una** riga toolbar in tutte e 3 le pagine Esplora.
- I badge mostrano sempre cosa è filtrato (no perdita di contesto), ognuno con × per resettare quel singolo filtro.
- Tutti i filtri si scelgono dalla sidebar.
- L'header colonne sotto la lista perde il ruolo di "barra ordinamenti" (resta come label).
