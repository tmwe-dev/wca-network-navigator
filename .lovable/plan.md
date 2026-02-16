

# Refactoring: Sistema di Gestione Job Download

## Problema Centrale

Nel database ci sono **193 job cancellati** (192 incompleti). L'interfaccia mostra "RIAVVIA (46)" perche la query carica solo gli ultimi 50 job. Non esiste alcun modo per eliminare i job cancellati -- il pulsante "Elimina tutti" cancella solo quelli in coda (`pending`/`paused`).

Risultato: i 46 job fantasma restano li per sempre, il pulsante RIAVVIA li rimette tutti in coda creando caos.

---

## Piano di Intervento

### 1. Pulizia immediata del database
Eliminare tutti i 193 job cancellati dal database. Sono job obsoleti che non hanno piu valore operativo.

### 2. Aggiungere "Pulisci completati/cancellati" al JobMonitor
**File**: `src/hooks/useDownloadJobs.ts`

Creare un nuovo hook `usePurgeOldJobs` che elimina in blocco i job con stato `cancelled` e `completed`. Questo sostituisce la logica attuale dove i job cancellati si accumulano senza fine.

### 3. Rifattorizzare il pulsante RIAVVIA nella barra superiore
**File**: `src/pages/Operations.tsx`

Il pulsante "RIAVVIA (46)" nella top bar e pericoloso: rimette in coda decine di job alla cieca.

Soluzione:
- Rimuovere il pulsante RIAVVIA dalla barra superiore
- Spostare la possibilita di ripresa nel JobMonitor, dove ogni singolo job cancellato puo essere riavviato individualmente (gia presente come pulsante "Riavvia" nella FeaturedJobCard)
- Aggiungere un pulsante "Pulisci tutto" nella sezione Completati del JobMonitor che elimina cancellati + completati

### 4. Rifattorizzare "Elimina tutti" per coprire TUTTI gli stati non-running
**File**: `src/hooks/useDownloadJobs.ts`

Modificare `useDeleteQueuedJobs` per eliminare job con stato `pending`, `paused`, `cancelled` e `completed`. L'unico stato protetto e `running` (job in esecuzione).

### 5. Migliorare la sezione Completati nel JobMonitor
**File**: `src/components/download/JobMonitor.tsx`

- Raggruppare i job cancellati nella sezione "Completati" (rinominata "Cronologia")
- Aggiungere un contatore chiaro: "5 completati, 46 cancellati"
- Aggiungere pulsante "Pulisci cronologia" che elimina tutti i non-attivi

### 6. Rimuovere il codice di resume massivo
**File**: `src/hooks/useDownloadJobs.ts`

La funzione `useResumeAllJobs` viene semplificata o rimossa. La ripresa avviene solo job-per-job dal pannello JobMonitor, evitando di creare decine di job pending simultaneamente.

---

## Dettagli Tecnici

### Nuovo hook: usePurgeOldJobs

```text
export function usePurgeOldJobs() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await supabase
        .from("download_jobs")
        .select("id")
        .in("status", ["cancelled", "completed"]);
      if (!data || data.length === 0) return 0;
      const { error } = await supabase
        .from("download_jobs")
        .delete()
        .in("status", ["cancelled", "completed"]);
      if (error) throw error;
      return data.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["download-jobs"] });
      toast({ title: "Cronologia pulita", description: `${count} job rimossi` });
    },
  });
}
```

### Modifica Operations.tsx (barra superiore)

Rimuovere il blocco del pulsante "RIAVVIA ({cancelledIncompleteJobs.length})" e la logica correlata (`cancelledIncompleteJobs`, `resumeAllMutation`, `resetStop` nel click handler).

### Modifica useDeleteQueuedJobs

Il filtro `.in("status", ["paused", "pending"])` diventa `.in("status", ["paused", "pending", "cancelled", "completed"])` per pulire tutto tranne i job attivi.

### Modifica JobMonitor

- Rinominare "Completati" in "Cronologia"
- Mostrare sia completati che cancellati nella stessa sezione
- Aggiungere pulsante "Pulisci" con icona Trash2
- Per i job cancellati incompleti, mantenere il pulsante "Riavvia" individuale nella QueueRow

### Pulizia DB una tantum

Verra eseguita una migrazione SQL per eliminare i 193 job cancellati attualmente nel database, dando subito un'interfaccia pulita.

---

## Risultato Atteso

- Nessun job fantasma nell'interfaccia
- Pulsante "Pulisci cronologia" per rimuovere vecchi job in qualsiasi momento
- Ripresa singola dei job cancellati (non massiva)
- Pulsante "Elimina tutti" che pulisce veramente tutto
- STOP immediato confermato funzionante (gia implementato con AbortController)

