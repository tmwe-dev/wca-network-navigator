

## Fix: Email non salvate nell'activity

### Modifiche

**1. `src/hooks/useEmailGenerator.ts` (righe 68-76)**

Sostituire il blocco update senza error handling con:

```typescript
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
  toast({
    title: "Email generata ma non salvata",
    description: updateError.message,
    variant: "destructive",
  });
}
```

**2. `src/pages/Workspace.tsx`**

- Aggiungere import: `import { useQueryClient } from "@tanstack/react-query";`
- Nel componente, aggiungere: `const queryClient = useQueryClient();`
- In `handleGenerateAll`, dopo il ciclo for (riga 137, dopo `setBatchGenerating(false)`), aggiungere:
  ```typescript
  queryClient.invalidateQueries({ queryKey: ["sorting-jobs"] });
  ```

