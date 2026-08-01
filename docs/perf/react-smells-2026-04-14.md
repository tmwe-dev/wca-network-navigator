# React Performance Smells — 2026-04-14

## Summary

| Category | Count | Severity | Fixed? |
|----------|-------|----------|--------|
| Inline `value={{}}` in Provider | 9 | HIGH | ✅ 3/9 fixed (app-level) |
| `key={index}` on dynamic lists | 13 | MEDIUM | ❌ (mostly static/skeleton) |
| `.map().filter().map()` chains | 15 | LOW | ❌ (small arrays) |
| `useEffect` without dep array | 20 | LOW-MED | ❌ (all have deps on next line) |
| `select("*")` over-fetching | 122 | MEDIUM | ❌ (future batch) |
| Queries without `staleTime` | 20+ hooks | MEDIUM | ✅ (global default 60s) |

## Provider Re-render Cascade (FIXED)

These providers used inline `value={{...}}` causing ALL consumers to re-render on ANY parent render:

| Provider | Status |
|----------|--------|
| `ActiveOperatorProvider` | ✅ Fixed with `useMemo` |
| `ContactDrawerProvider` | ✅ Fixed with `useMemo` |
| `MissionProvider` | ✅ Fixed with `useMemo` |
| `AuthProvider` | ✅ Already memoized |
| `ChartContext.Provider` (shadcn) | ⚠️ Low impact (leaf component) |
| `FormFieldContext.Provider` (shadcn) | ⚠️ Low impact (leaf component) |
| `FormItemContext.Provider` (shadcn) | ⚠️ Low impact (leaf component) |
| `ToggleGroupContext.Provider` (shadcn) | ⚠️ Low impact (leaf component) |
| `CarouselContext.Provider` (shadcn) | ⚠️ Low impact (leaf component) |

## key={index} Occurrences

| File | Context | Risk |
|------|---------|------|
| `PartnerCanvas.tsx:135` | key_markets flags | LOW (rarely re-ordered) |
| `PartnerCanvas.tsx:143` | key_routes badges | LOW |
| `CanvasContactList.tsx:81` | contact list | MEDIUM |
| `CanvasNetworkBadges.tsx:64` | network links | LOW |
| `SystemHealthDashboard.tsx:100` | health items | LOW |
| `ActivitiesTab.tsx:96` | Skeleton placeholders | NONE |
| `AgendaCardView.tsx:78,146` | Skeleton + badges | LOW |
| `AgendaDayDetail.tsx:83` | Skeleton | NONE |
| `AgendaListView.tsx:77` | Skeleton | NONE |
| `AuroraBorealis.tsx:289` | WebGL vertices | NONE (static) |
| `CSVImport.tsx:343` | Preview rows | LOW |

## Supabase `select("*")` Over-fetching

122 occurrences of `select("*")`. Top offenders by query frequency:

| File | Table | Used Columns |
|------|-------|-------------|
| `ContactRecordInteractions.tsx` | contact_interactions (4x) | id, title, type, created_at |
| `RulesAndActionsTab.tsx` | email_address_rules, email_sender_groups (3x) | Subset |
| `SmartInboxView.tsx` | channel_messages | subject, from, date, direction |
| `MemoryDashboard.tsx` | ai_memory | content, type, importance, created_at |
| `AttivitaTab.tsx` | activities | title, status, type, partner_id |

**Recommendation**: Batch-fix `select("*")` in a dedicated PR, starting with tables that have `body_html`/`raw_payload` (large text columns).

## Queries Without staleTime

Global default `staleTime: 60_000` in `queryClient.ts` covers all hooks without explicit override. No code change needed — already configured.

---
*Generated: 2026-04-14*
