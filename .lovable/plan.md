

## Problema identificato

In `useCreateImportFromParsedRows` (riga 520-564 di `useImportLogs.ts`), il log di importazione viene creato con `status: "pending"` ma **non viene mai aggiornato a `"completed"`** dopo che tutti i batch di contatti sono stati inseriti nel database. La UI mostra "Elaborazione..." perché lo status rimane bloccato.

## Soluzione

Aggiungere un `UPDATE` dello status a `"completed"` alla fine del ciclo di inserimento batch in `useCreateImportFromParsedRows`:

**File: `src/hooks/useImportLogs.ts`** (dopo riga 562, dopo il ciclo `for` dei batch)

```typescript
// After all batches inserted, mark as completed
await supabase
  .from("import_logs")
  .update({ status: "completed", processing_batch: Math.ceil(contacts.length / 100), total_batches: Math.ceil(contacts.length / 100) })
  .eq("id", importLog.id);
```

Questo farà sì che:
- Il badge mostri "Completato" invece di "Elaborazione..."
- La progress bar scompaia (visibile solo quando `status === "processing"`)

