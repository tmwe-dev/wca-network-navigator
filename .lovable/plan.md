
# Fix: Il download salta troppi profili quando la sessione WCA scade

## Causa radice

Il sistema di recovery della sessione ha un punto cieco:

- Il counter `consecutiveEmpty` si incrementa solo per profili **caricati ma vuoti** (nessun contatto, nessun profilo)
- I profili che danno `pageLoaded: false` (saltati con Zero Retry) **non contano** per il recovery
- Risultato: se la sessione scade e l'estensione non riesce a caricare le pagine WCA, i profili vengono saltati uno dopo l'altro senza che il sistema tenti il re-login

In `useDownloadProcessor.ts` (righe 156-166):
```ts
// Page didn't load — skip (Zero Retry policy)
if (result.pageLoaded === false) {
  await appendLog(jobId, "SKIP", `Profilo #${wcaId} non caricato — saltato`);
  contactsMissing++;
  processedSet.add(wcaId);
  // ... aggiorna DB
  continue;  // ← va avanti SENZA incrementare consecutiveEmpty
}
```

E il recovery (righe 184-214) viene DOPO il salvataggio, quindi non viene mai raggiunto dai profili saltati con `pageLoaded: false`.

## Fix da applicare

Aggiungere un secondo counter `consecutiveSkipped` che traccia i profili con `pageLoaded === false` consecutivi. Se supera la soglia (es. 3), tenta il re-login prima di procedere, esattamente come fa già per i profili vuoti.

### Logica nuova nel blocco `pageLoaded === false`:

```ts
if (result.pageLoaded === false) {
  await appendLog(jobId, "SKIP", `Profilo #${wcaId} non caricato — saltato`);
  contactsMissing++;
  consecutiveSkipped++;  // ← NUOVO

  // Se troppi salti consecutivi → probabile sessione scaduta
  if (consecutiveSkipped >= 3) {
    await appendLog(jobId, "WARN", "⚠️ 3 profili non caricati consecutivi — verifica sessione WCA...");
    const recheck = await verifyWcaSession(jobId, availableRef.current, checkAvailableRef.current);
    if (!recheck) {
      await supabase.from("download_jobs").update({
        status: "paused",
        error_message: "⚠️ Sessione WCA scaduta — troppi profili non caricati."
      }).eq("id", jobId);
      return;
    }
    consecutiveSkipped = 0;  // reset dopo re-login riuscito
  }

  processedSet.add(wcaId);
  await supabase.from("download_jobs").update({ ... }).eq("id", jobId);
  continue;
}
```

Quando un profilo viene caricato correttamente (anche vuoto), il `consecutiveSkipped` si resetta.

## File da modificare

| File | Modifica |
|------|---------|
| `src/hooks/useDownloadProcessor.ts` | Aggiungere counter `consecutiveSkipped`, logica di verifica sessione nel blocco `pageLoaded === false` |

## Dettagli tecnici

- Aggiungere `let consecutiveSkipped = 0;` subito dove c'è `let consecutiveEmpty = 0;`
- Nel blocco `pageLoaded === false`: incrementare `consecutiveSkipped` e, se >= 3, chiamare `verifyWcaSession` e mettere in pausa il job se fallisce, altrimenti resetterlo
- Nei casi di successo (fine del blocco extraction, dopo il salvataggio): aggiungere `consecutiveSkipped = 0;`
- Zero impatto sulla Zero Retry Policy: un profilo saltato resta saltato — la verifica sessione serve solo per capire se riprendere con sessione valida, non per riprovare il profilo
