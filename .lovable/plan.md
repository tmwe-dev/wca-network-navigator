

## Piano: Fix email non salvate nell'activity (non appaiono in Sorting)

### Problema
Il database conferma che tutte le attività pending hanno `email_body = NULL` e `email_subject = NULL`. L'edge function `generate-email` genera correttamente l'email e mostra il toast di successo, ma l'update successivo nel client (`useEmailGenerator.ts` righe 69-76) fallisce silenziosamente perchè non ha gestione errori.

### Causa probabile
L'update a riga 69 di `useEmailGenerator.ts` non controlla il risultato. Se l'update fallisce (per qualsiasi motivo: errore RLS, timeout, etc.), il codice continua normalmente e restituisce `result` — l'utente vede "email generata" ma nulla viene scritto nel DB.

### Modifiche

**1. `src/hooks/useEmailGenerator.ts`**
- Aggiungere gestione errori sull'update dell'activity (righe 69-76): controllare `error` dal risultato Supabase e loggarla/notificarla
- Aggiungere `as any` per sicurezza sulla tipizzazione
- Aggiungere un `console.error` se l'update fallisce per poter diagnosticare in futuro
- Aggiungere anche il salvataggio di `selected_contact_id` se disponibile dall'activity corrente (il Sorting Canvas ne ha bisogno per mostrare l'email del contatto)

**2. `src/pages/Workspace.tsx`** (nel `handleGenerateAll`)
- Dopo ogni `generate()` riuscito, invalidare la query `sorting-jobs` per aggiornare il Sorting in tempo reale

### Fix concreto su `useEmailGenerator.ts`

```typescript
// Riga 69-76 diventa:
const { error: updateError } = await supabase
  .from("activities")
  .update({
    email_subject: result.subject,
    email_body: result.body,
    scheduled_at: new Date().toISOString(),
  } as any)
  .eq("id", params.activity_id);

if (updateError) {
  console.error("Failed to save email to activity:", updateError);
  toast({ title: "Email generata ma non salvata", description: updateError.message, variant: "destructive" });
}
```

