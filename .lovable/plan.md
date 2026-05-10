# Fix Polling Loop & Auth Re-render

## Cosa ho trovato (verificato sul codice)

1. **`src/providers/AuthProvider.tsx:84`** — `setSession(currentSession)` viene chiamato a OGNI evento `onAuthStateChange` (incluso `TOKEN_REFRESHED` ogni ~50min e visibility change). Il riferimento cambia anche quando l'access_token è identico → tutti i consumer del context si ri-renderizzano → React Query rimonta i `refetchInterval`.

2. **`src/hooks/useOperationsCenter.ts:82,98,118`** — 3 query polling ogni **15s** su `agent_tasks`, `email_campaign_queue`, `activities`. **MA** alle righe 122-128 è già attivo `postgres_changes` Realtime sulle stesse 3 tabelle. Polling ridondante puro.

3. **`src/hooks/useUnreadCounts.ts:61`** — 5 HEAD count su `channel_messages` + `partners` + `activities` ogni **60s** + `refetchOnWindowFocus: true`. Accettabile come fallback ma duplica il lavoro che farebbe Realtime.

4. **`src/hooks/useTodayActivities.ts:53`** — polling 30s su `activities`. Sovrapposto a useOperationsCenter.

5. **`src/hooks/useActiveProcesses.ts:90`** — polling 10s.

## Modifiche proposte

### A. AuthProvider — emit stabile (1 file, 5 righe)
`src/providers/AuthProvider.tsx`: in `applyValidatedSession`, prima di `setSession` confronta per `access_token`:
```ts
setSession(prev =>
  prev?.access_token === currentSession.access_token ? prev : currentSession
);
setUser(prev =>
  prev?.id === currentSession.user.id ? prev : currentSession.user
);
```
Stesso trattamento per `setUnauthenticated` (no-op se già `null`). Elimina i re-render a cascata da `TOKEN_REFRESHED`.

### B. useOperationsCenter — togliere polling (Realtime già attivo)
`src/hooks/useOperationsCenter.ts`: sostituire `refetchInterval: 15_000` → `refetchInterval: false` sulle 3 query. La sottoscrizione Realtime esistente (righe 122-128) gestisce gli aggiornamenti. Mantengo `staleTime: 10_000` come safety net.

### C. useUnreadCounts — alzare intervallo + Realtime invalidation
`src/hooks/useUnreadCounts.ts`:
- `refetchInterval: 120_000` (era 60s)
- `refetchOnWindowFocus: false`
- Aggiungere `useEffect` con `supabase.channel().on('postgres_changes', { table: 'channel_messages', event: 'INSERT' }, () => queryClient.invalidateQueries({ queryKey: queryKeys.channelMessages.unreadCounts }))`. Stesso per `activities`.

### D. useTodayActivities — alzare intervallo
`src/hooks/useTodayActivities.ts`: `refetchInterval: 90_000` (era 30s). Realtime opzionale (già coperto da useOperationsCenter quando montata).

### E. useActiveProcesses — alzare intervallo
`refetchInterval: 30_000` (era 10s). Da verificare uso (se è una pagina di monitoring live, può restare 10s — ne discutiamo prima di toccare).

### F. Iframe `allow="vr ambient-light-sensor battery"` — fuori scope
Cosmetico. Se vuoi lo cerco e lo pulisco in un follow-up separato (atomicità: fix polling ≠ fix policy iframe).

## Cosa NON tocco
- Logica DAL, query keys, schema, RLS.
- `useCampaignJobs` / `useEmailCampaignQueue` (già `false` o condizionale).
- Le query effettive (solo metadata di useQuery).
- Il file `src/integrations/supabase/client.ts`.

## Verifica post-fix
1. Aprire DevTools → Network → filter `channel_messages`. Idle 2 min → attese: ≤1 burst iniziale + invalidazioni Realtime su INSERT reale.
2. Verificare che il badge unread continui ad aggiornarsi quando arriva una mail (test manuale o INSERT manuale).
3. `useOperationsCenter` continua a refreshare alla creazione di nuove `agent_tasks` (Realtime).

## Domanda aperta
Su **E** (`useActiveProcesses`), prima di toccare voglio sapere se la pagina che lo usa è un monitor "live" dove 10s è una scelta UX deliberata. Se sì, lo lascio.
