

## Diagnosi: le email generate non appaiono nel Sorting

### Causa root

Ho verificato i dati nel database. Le 3 email sono state generate correttamente e salvate sulle attivita. Il problema e che quelle attivita hanno **status = "cancelled"** (erano state scartate in precedenza dal Sorting).

- **Workspace** mostra le attivita con `status !== "completed"` -- include anche quelle cancellate
- **Sorting** filtra solo `status === "pending"` -- esclude le cancellate
- Risultato: l'utente vede e genera email su attivita cancellate nel Workspace, ma queste non compaiono mai nel Sorting

### Piano di fix (2 interventi)

**1. Workspace: escludere le attivita cancellate dalla lista**

In `src/pages/Workspace.tsx`, il filtro alla riga 59 va aggiornato:
```
a.status !== "completed" && a.status !== "cancelled"
```
Cosi l'utente non lavora su attivita gia scartate.

**2. useEmailGenerator: ripristinare lo status a "pending" al salvataggio**

In `src/hooks/useEmailGenerator.ts`, quando si salva l'email generata sull'attivita (riga 71-75), aggiungere `status: "pending"` nell'update. Cosi anche se un'attivita fosse in uno stato anomalo, la generazione email la riporta automaticamente nel flusso di Sorting:
```typescript
.update({
  email_subject: result.subject,
  email_body: result.body,
  scheduled_at: new Date().toISOString(),
  status: "pending",  // <-- ripristina nello stato corretto
})
```

### Risultato atteso

- Le attivita cancellate non appaiono piu nel Workspace
- Generare un'email riporta sempre l'attivita nello stato "pending"
- Le email generate compaiono immediatamente nel Sorting

