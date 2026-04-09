

# Piano: Documento 2 come Fonte di Verità + Audit Codice Recente

## Il Documento

Il "Documento 2 — Come Costruire da Zero un Software Perfetto con AI" definisce 11 sezioni con regole fondanti:

**6 Regole prima del codice:**
1. Prima dominio, poi UI
2. Prima contratti e schemi, poi prompt
3. Prima verità dati, poi AI
4. Ogni modulo = un solo scopo
5. Ogni flusso critico completabile senza intuizioni manuali
6. Ogni funzione AI sostituibile, osservabile, testabile

**5 regole di prompting enterprise:**
1. Ogni prompt ha uno scopo solo
2. Ogni prompt dichiara input/output/schema/vincoli/errori/criteri
3. Dati estratti con coordinate/evidenze di origine
4. Prompt critici testati su casi campione prima della produzione
5. Correzioni utente diventano regole governate, non memoria implicita

---

## Audit delle Ultime 3 Ore — Violazioni Rilevate

### V1. File oltre 300 righe (Regola §4 "un solo scopo")
| File | Righe | Problema |
|------|-------|----------|
| `WhatsAppInboxView.tsx` | 559 | UI + logica invio + parsing thread + drag-drop + tracking in un unico file |
| `useWhatsAppAdaptiveSync.ts` | 364 | Sync + scheduling + heartbeat + parsing mescolati |
| `useCockpitLogic.ts` | 313 | Drop handler + generazione AI + deep search + tracking tutti insieme |
| `useAIDraftActions.ts` | 242 | Send WA + Send LI + Send Email + LinkedIn search + tracking tutto in un hook |

### V2. Tracking duplicato e incoerente (Regola §3 "verità dati unica")
- `useOutreachQueue.ts` ha un `trackQueueActivity()` inline che duplica la logica di `useTrackActivity` — due fonti di verità per lo stesso concetto.
- `WhatsAppInboxView.tsx` riga 237+ fa un `supabase.from("activities").insert(...)` diretto anziché usare il hook `useTrackActivity`.

### V3. Nessun contratto tipizzato per i risultati bridge (Regola §2 "contratti prima")
- Le risposte di `sendWhatsApp`, `verifySession`, `readUnread` sono tutte `any` — nessun tipo/schema definito.
- `trackActivity.mutate()` usa stringhe libere per `activityType` e `sourceType` senza enum.

### V4. Logica AI senza schema (Regola §4 uso AI + §5 prompting)
- I prompt nelle edge function `generate-email` e `generate-outreach` non hanno schema output definito nel codice client — il risultato è trattato come stringa libera.

### V5. `catch {}` vuoti (Regola §7 checklist — "log e metriche per ogni errore")
- `useOutreachQueue.ts:26` — `catch { /* best-effort tracking */ }` nasconde errori
- `WhatsAppInboxView.tsx:252` — `catch { /* best-effort */ }` idem
- Almeno 4 `catch {}` vuoti nei file recenti

---

## Piano di Correzione

### Passo 1 — Installare il Documento come fonte di verità
- Copiare il DOCX in `docs/metodo/Documento_2_Software_Perfetto_da_Zero_con_AI.docx`
- Creare `docs/metodo/Documento_2_Software_Perfetto_da_Zero_con_AI.md` (versione leggibile)
- Aggiornare `docs/metodo/README.md` con il riferimento al Documento 2 come **regola suprema di costruzione**

### Passo 2 — Estrarre `useTrackActivity` come unica fonte di tracking
- Eliminare `trackQueueActivity()` inline da `useOutreachQueue.ts` — usare un import diretto della funzione core
- Eliminare l'insert diretto in `WhatsAppInboxView.tsx` — chiamare lo stesso pattern

### Passo 3 — Spezzare `WhatsAppInboxView.tsx` (559→3 file <200 righe)
- `WhatsAppChatList.tsx` — sidebar con lista thread e ricerca
- `WhatsAppChatThread.tsx` — area messaggi + reply + drag-drop
- `WhatsAppInboxView.tsx` — orchestratore sottile (<100 righe)

### Passo 4 — Spezzare `useAIDraftActions.ts` (242→3 hook)
- `useSendWhatsApp.ts` — solo logica invio WA
- `useSendLinkedIn.ts` — solo logica invio LI + ricerca profilo
- `useSendEmail.ts` — solo logica invio email
- `useAIDraftActions.ts` — compone i 3 hook

### Passo 5 — Tipizzare i contratti bridge
- Creare `src/types/bridge.ts` con interfacce per `WhatsAppSendResult`, `VerifySessionResult`, `ReadUnreadResult`
- Creare enum `ActivityType` e `SourceType` in `src/types/tracking.ts`

### Passo 6 — Sostituire catch vuoti con logging strutturato
- Ogni `catch {}` diventa `catch (err) { log.warn("context", { err }); }` usando `createLogger`

---

## File coinvolti

| File | Azione |
|------|--------|
| `docs/metodo/Documento_2_Software_Perfetto_da_Zero_con_AI.md` | Nuovo — versione MD del documento |
| `docs/metodo/README.md` | Aggiornato — riferimento Documento 2 |
| `src/types/bridge.ts` | Nuovo — contratti bridge tipizzati |
| `src/types/tracking.ts` | Nuovo — enum ActivityType/SourceType |
| `src/components/outreach/WhatsAppChatList.tsx` | Nuovo — estratto da WhatsAppInboxView |
| `src/components/outreach/WhatsAppChatThread.tsx` | Nuovo — estratto da WhatsAppInboxView |
| `src/components/outreach/WhatsAppInboxView.tsx` | Ridotto a orchestratore |
| `src/hooks/useSendWhatsApp.ts` | Nuovo — estratto da useAIDraftActions |
| `src/hooks/useSendLinkedIn.ts` | Nuovo — estratto da useAIDraftActions |
| `src/hooks/useSendEmail.ts` | Nuovo — estratto da useAIDraftActions |
| `src/hooks/useAIDraftActions.ts` | Ridotto a composizione |
| `src/hooks/useOutreachQueue.ts` | Fix tracking + catch |
| Tutti i file con `catch {}` | Aggiunta logging strutturato |

## Ordine di esecuzione

1. **Passo 1** — Documento in docs/metodo (fondazione)
2. **Passo 5** — Types/contratti (prerequisito per tutto)
3. **Passo 2** — Unificare tracking
4. **Passo 3** — Split WhatsAppInboxView
5. **Passo 4** — Split useAIDraftActions
6. **Passo 6** — Fix catch vuoti

