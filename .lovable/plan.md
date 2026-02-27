

## Piano: Barra azioni contestuale ai filtri MissingChip

### Problema
Quando l'utente clicca su un MissingChip (es. "Senza Alias Az."), la lista si filtra correttamente ma non appaiono pulsanti d'azione per operare sui risultati filtrati. L'utente deve aprire manualmente il wizard per trovare i comandi.

### Soluzione
Aggiungere una **barra azioni contestuale** che appare automaticamente sotto i filtri quando un MissingChip è attivo. I pulsanti cambiano in base al filtro selezionato:

```text
Filtro attivo          → Azioni mostrate
─────────────────────────────────────────────
Senza Profilo          → [Scarica Profili (N)]
Senza Email            → [Scarica Profili (N)]  (re-download per completare)
Senza Telefono         → [Scarica Profili (N)]
Senza Deep             → [Avvia Deep Search (N)]
Senza Alias Az.        → [Genera Alias Azienda (N)]
Senza Alias Ct.        → [Genera Alias Contatto (N)]
```

### File modificato
- **`src/components/operations/PartnerListPanel.tsx`**
  - Nuovo componente `FilterActionBar` che riceve il `progressFilter` attivo e il conteggio dei partner filtrati
  - Posizionato tra la riga dei filtri e la search bar (sotto i MissingChip)
  - Per "profiles/email/phone": pulsante download che imposta `downloadMode` appropriato e apre il wizard, oppure avvia direttamente il download dei partner filtrati senza profilo
  - Per "deep": pulsante che chiama `onDeepSearch` con gli ID dei partner filtrati
  - Per "alias_co/alias_ct": pulsante che chiama `onGenerateAliases` con il tipo appropriato
  - Stile: barra compatta con sfondo colorato (simile ai pulsanti del wizard), icona + label + conteggio

### Dettaglio implementazione

Inserire dopo riga 421 (sotto il conteggio partner) un blocco condizionale:

```typescript
{progressFilter && (
  <FilterActionBar
    filter={progressFilter}
    count={filteredPartners.length}
    isDark={isDark}
    onDownload={() => { setDownloadMode("no_profile"); setWizardOpen(true); }}
    onDeepSearch={() => {
      const ids = filteredPartners.map((p: any) => p.id);
      if (ids.length > 0) onDeepSearch?.(ids);
    }}
    onGenerateAlias={(type) => onGenerateAliases?.(countryCodes, type)}
    deepSearchRunning={deepSearchRunning}
    aliasGenerating={aliasGenerating}
  />
)}
```

Il componente `FilterActionBar` renderizza il pulsante appropriato in base al filtro attivo, con icona, label e conteggio dei partner da processare.

