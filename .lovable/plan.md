
# Refactoring Sistema Email — Piano di Ristrutturazione

## Analisi Attuale

| File | Righe | Limite | Stato |
|------|-------|--------|-------|
| `check-inbox/index.ts` | **1.138** | ~200 | ⛔ 5.7x il limite — ma è edge function (1 solo file obbligatorio) |
| `EmailDetailView.tsx` | **344** | 200 | ⚠️ 1.7x — va spezzato |
| `useChannelMessages.ts` | **258** | 200 | ⚠️ 1.3x — va spezzato |
| `EmailInboxView.tsx` | 147 | 200 | ✅ OK |
| `EmailMessageList.tsx` | 77 | 200 | ✅ OK |

## Cosa faremo

### 1. Frontend — Spezzare `EmailDetailView.tsx` (344→~4 file da ~80-100 righe)
- **`EmailHtmlFrame.tsx`** — iframe sandboxed + blockRemoteImages (righe 56-145)
- **`AttachmentThumbnail.tsx`** — thumbnail allegati (righe 147-182)  
- **`EmailTechnicalHeaders.tsx`** — dettagli tecnici espandibili (righe 278-301)
- **`EmailDetailView.tsx`** — solo orchestrazione (~120 righe)
- **`emailUtils.ts`** — funzioni condivise (`decodeRfc2047`, `formatBytes`, `getAttachmentIcon`, `blockRemoteImages`)

### 2. Hook — Spezzare `useChannelMessages.ts` (258→3 file da ~80 righe)
- **`useChannelMessages.ts`** — solo query + realtime (~80 righe)
- **`useEmailSync.ts`** — `useCheckInbox` + `useContinuousSync` (~120 righe)
- **`useEmailActions.ts`** — `useMarkAsRead` + `useUnreadCount` + `useMessageAttachments` (~60 righe)

### 3. Edge Function — `check-inbox/index.ts` (1.138 righe)
⚠️ Le edge function richiedono tutto in un unico `index.ts`. **Non possiamo spezzarlo in file separati.**
Tuttavia possiamo:
- Rimuovere i **certificati CA inline** (~145 righe di PEM) e caricarli da environment/config
- Meglio: documentare chiaramente le sezioni con commenti strutturali

### Risultato atteso
- **EmailDetailView**: 344 → ~120 righe
- **useChannelMessages**: 258 → ~80 righe  
- **5 nuovi file** tutti sotto le 120 righe
- Manutenibilità drasticamente migliorata
