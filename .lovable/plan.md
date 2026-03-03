

## Piano: Processi Attivi in Alto a Sinistra (sempre visibili)

### Problema attuale
L'`ActiveProcessIndicator` e posizionato a **destra** nell'header, e traccia solo i download jobs. Non traccia Deep Search, sorting/alias, o email queue. L'utente vuole visibilita immediata e costante a **sinistra**, vicino al menu.

### Modifiche

**1. Espandere `useActiveProcesses` per tracciare tutti i processi**
- **Deep Search**: leggere lo stato dal `DeepSearchContext` (running, current partner, progress count)
- **Download jobs**: gia implementato
- **Email queue**: query globale su `email_campaign_queue` con status `pending` o `sending` (senza richiedere un draftId specifico)
- Aggiungere contatore totale e progresso per ogni tipo

**2. Spostare `ActiveProcessIndicator` a sinistra nell'header**
- In `AppLayout.tsx`: spostare il componente dal blocco destro al blocco sinistro, subito dopo il bottone menu hamburger
- Il dropdown si apre verso il basso-sinistra invece che destra

**3. Migliorare il componente visivo**
- Quando ci sono processi attivi: mostrare un chip animato con pallino pulsante verde, icona del processo principale, contatore
- Aggiungere una mini progress bar orizzontale sotto il chip che mostra il progresso complessivo
- Il dropdown espanso mostra tutti i processi raggruppati per tipo con dettagli
- Quando non ci sono processi: mostrare comunque un'icona discreta (grigia, senza pulsazione) con "Nessun processo" al tooltip, cosi l'utente sa sempre dove guardare

### File coinvolti

| File | Modifica |
|------|----------|
| `src/hooks/useActiveProcesses.ts` | Aggiungere deep search e email queue come sorgenti |
| `src/components/layout/ActiveProcessIndicator.tsx` | Spostare dropdown a sinistra, migliorare UI, mostrare sempre |
| `src/components/layout/AppLayout.tsx` | Spostare `ActiveProcessIndicator` nel blocco sinistro dopo il menu |

