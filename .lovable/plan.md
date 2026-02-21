
# Deep Search di Gruppo dal Partner Hub

## Situazione attuale

La Deep Search funziona solo su singoli partner, tramite il pulsante nel dettaglio (PartnerDetailFull / PartnerDetailCompact). Nel Partner Hub esiste gia la selezione multipla con checkbox e una BulkActionBar che mostra solo "Assegna Attivita".

## Cosa faremo

Aggiungeremo un pulsante **"Deep Search"** nella barra delle azioni di gruppo (BulkActionBar) che lancia la deep search in sequenza su tutti i partner selezionati, mostrando il progresso in tempo reale.

L'utente potra:
1. Filtrare per paese (o qualsiasi altro filtro)
2. Selezionare i partner con le checkbox
3. Cliccare "Deep Search" nella barra in basso
4. Vedere il progresso (es. "3/12 completati")

## Modifiche

### 1. `src/components/partners/BulkActionBar.tsx`

- Aggiungere pulsante **"Deep Search"** con icona `Sparkles`
- Aggiungere prop `onDeepSearch` e `deepSearching` per gestire stato
- Mostrare progresso durante l'esecuzione (es. "Deep Search 3/12...")
- Pulsante disabilitato durante l'esecuzione

### 2. `src/pages/PartnerHub.tsx`

- Aggiungere stato `deepSearching`, `deepSearchProgress`
- Implementare handler `handleBulkDeepSearch`:
  - Loop sequenziale sui partner selezionati
  - Per ognuno chiama `supabase.functions.invoke("deep-search-partner", { body: { partnerId } })`
  - Aggiorna il progresso ad ogni step
  - Toast finale con riepilogo successi/errori
  - Invalida la query dei partner alla fine per aggiornare i dati
- Aggiungere pulsante "Seleziona tutti" nella toolbar per selezionare rapidamente tutti i partner filtrati (es. tutti quelli di un paese)
- Passare le nuove props alla BulkActionBar

### 3. Aggiungere "Seleziona tutti visibili"

Nella barra filtri del Partner Hub, aggiungere un piccolo pulsante/checkbox "Seleziona tutti" che seleziona tutti i partner attualmente visibili nella lista filtrata, cosi da non dover cliccare uno per uno quando si filtra per paese.

## Layout BulkActionBar aggiornata

```text
┌──────────────────────────────────────────────────────────────────┐
│  12 selezionati   [Assegna Attivita]  [Deep Search]  [Email]  X │
└──────────────────────────────────────────────────────────────────┘

Durante l'esecuzione:
┌──────────────────────────────────────────────────────────────────┐
│  12 selezionati   [Assegna Attivita]  [Deep Search 3/12...]   X │
└──────────────────────────────────────────────────────────────────┘
```

## Dettagli tecnici

**Handler Deep Search batch:**
```typescript
const handleBulkDeepSearch = async () => {
  const ids = Array.from(selectedIds);
  setDeepSearching(true);
  let success = 0, failed = 0;

  for (let i = 0; i < ids.length; i++) {
    setDeepSearchProgress({ current: i + 1, total: ids.length });
    try {
      const { error } = await supabase.functions.invoke("deep-search-partner", {
        body: { partnerId: ids[i] }
      });
      if (error) throw error;
      success++;
    } catch {
      failed++;
    }
  }

  setDeepSearching(false);
  queryClient.invalidateQueries({ queryKey: ["partners"] });
  toast.success(`Deep Search completata: ${success} ok, ${failed} errori`);
};
```

**Seleziona tutti:**
```typescript
const handleSelectAll = () => {
  if (selectedIds.size === filteredPartners.length) {
    setSelectedIds(new Set());
  } else {
    setSelectedIds(new Set(filteredPartners.map((p: any) => p.id)));
  }
};
```

## File da modificare

| File | Modifica |
|------|---------|
| `src/components/partners/BulkActionBar.tsx` | Aggiungere pulsante Deep Search con progresso + pulsante Email |
| `src/pages/PartnerHub.tsx` | Handler bulk deep search, checkbox "Seleziona tutti", stati progresso |

Nessuna modifica al backend: la edge function `deep-search-partner` resta invariata, viene semplicemente chiamata in sequenza per ogni partner.
