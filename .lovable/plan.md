

# Flusso diretto: Partner Hub → Workspace in 2 click

## Problema attuale

Il flusso attuale per generare email AI dal Partner Hub richiede 4-5 passaggi:
1. Selezionare i partner nel Hub (checkbox)
2. Cliccare "Assegna Attivita" nella barra azioni
3. Compilare il dialog (tipo: "Invia Email", titolo, ecc.)
4. Navigare manualmente al Workspace
5. Generare le email

## Soluzione

Aggiungere un pulsante **"Workspace"** nella `BulkActionBar` che in un solo click:
- Crea automaticamente le attivita `send_email` per ogni partner selezionato (con titolo auto-generato)
- Naviga direttamente a `/workspace`

Il flusso diventa:
1. Selezionare i partner (checkbox) -- click 1
2. Cliccare "Workspace" nella barra -- click 2 (crea attivita + naviga)

## File modificati

| File | Modifica |
|------|----------|
| `src/components/partners/BulkActionBar.tsx` | Aggiungere pulsante "Workspace" con icona `Sparkles` |
| `src/pages/PartnerHub.tsx` | Implementare `handleSendToWorkspace`: crea attivita send_email in batch e naviga a `/workspace` |

### Dettagli tecnici

**BulkActionBar.tsx**: Nuova prop `onSendToWorkspace` e pulsante corrispondente posizionato dopo "Deep Search":

```
onSendToWorkspace?: () => void;
sendingToWorkspace?: boolean;
```

**PartnerHub.tsx**: Nuova funzione `handleSendToWorkspace`:
1. Prende gli ID selezionati
2. Chiama `useCreateActivities` con attivita di tipo `send_email` per ogni partner (titolo: "Outreach email")
3. Mostra toast di conferma
4. Naviga a `/workspace`

Nessuna modifica al Workspace: questo gia mostra tutte le attivita `send_email` non completate, quindi le nuove appariranno automaticamente.
