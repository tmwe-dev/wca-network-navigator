

## Fix: `extractContactsRef.current is not a function`

### Root Cause
Line 173 in `useDownloadProcessor.ts` calls `extractContactsRef.current(wcaId)` without checking if it's actually a function. The ref is initialized on line 56 and synced on line 57, but if the auto-start interval triggers `startJob` before the component has fully rendered with the `extractContacts` callback from `useExtensionBridge`, the ref's `.current` may be `undefined` or stale.

### Fix in `src/hooks/useDownloadProcessor.ts`

Add a guard at line 173 before calling `extractContactsRef.current`:

```typescript
// Before the extraction call, verify the function exists
if (typeof extractContactsRef.current !== 'function') {
  markRequestSent();
  await appendLog(jobId, "ERROR", `Errore #${wcaId}: Extension bridge non inizializzato — saltato`);
  contactsMissing++;
  processedSet.add(wcaId);
  // update job progress and continue to next profile
  await supabase.from("download_jobs").update({
    current_index: processedSet.size, processed_ids: [...processedSet] as any,
    last_processed_wca_id: wcaId, last_contact_result: "skipped", contacts_missing_count: contactsMissing,
  }).eq("id", jobId);
  continue;
}
const result = await Promise.race([extractContactsRef.current(wcaId), timeout40s]);
```

This prevents the crash and skips the profile gracefully instead of throwing an unhandled error that corrupts every subsequent profile in the loop.

### File

| File | Change |
|------|--------|
| `src/hooks/useDownloadProcessor.ts` | Add `typeof` guard before `extractContactsRef.current()` call |

