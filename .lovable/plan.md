

# Drop Zone piu' grandi + WhatsApp invio diretto via Twilio

## 1. Drop Zone — raddoppio dimensioni

In `src/components/cockpit/ChannelDropZones.tsx`:
- Cambiare `max-w-[140px]` → `max-w-[240px]`
- Padding da `p-3` → `p-5`
- Icone da `w-8 h-8` / `w-4 h-4` → `w-12 h-12` / `w-6 h-6`
- Label da `text-sm` → `text-base`
- Gap da `gap-2` → `gap-3`

Risultato: caselle circa il doppio in larghezza e altezza, target di drop molto piu' comodo.

## 2. WhatsApp — invio diretto senza aprire browser

**Problema attuale**: il bottone "Apri WhatsApp" apre `wa.me` in una nuova tab. L'utente vuole che il messaggio parta direttamente.

**Soluzione**: usare **Twilio** via connector per inviare il messaggio WhatsApp dal backend.

### Prerequisiti
- Collegare il connector Twilio al progetto (richiede account Twilio con WhatsApp Business abilitato e numero Twilio configurato come sender WhatsApp)
- L'utente dovra' configurare il proprio numero Twilio WhatsApp

### Implementazione

**Nuova Edge Function `send-whatsapp/index.ts`**:
- Riceve `{ to, body }` dal frontend
- Valida input con Zod
- Chiama Twilio API via connector gateway (`/Messages.json`) con `From: whatsapp:+<numero_twilio>`, `To: whatsapp:+<numero_dest>`, `Body: <testo>`
- Restituisce `{ success, sid }` o errore

**Modifica `AIDraftStudio.tsx`**:
- Il bottone WhatsApp cambia da "Apri WhatsApp" → "Invia WhatsApp"
- Rimuove `window.open(wa.me/...)` e chiama `supabase.functions.invoke("send-whatsapp", ...)`
- Mostra loader durante l'invio e toast di conferma/errore
- Fallback: se Twilio non configurato, mantiene il link `wa.me` con avviso

## Domanda critica prima di procedere

Per inviare WhatsApp tramite Twilio serve:
1. Un account Twilio con WhatsApp Business API abilitato
2. Un numero Twilio registrato come sender WhatsApp
3. Il connector Twilio collegato al progetto

Senza Twilio, l'alternativa resta il link `wa.me` (che apre WhatsApp Web/app). Vuoi procedere con l'integrazione Twilio, oppure preferisci che il link `wa.me` funzioni in modo piu' trasparente (es. copia automatica del messaggio + apertura link)?

## File coinvolti

| File | Modifica |
|------|----------|
| `src/components/cockpit/ChannelDropZones.tsx` | Raddoppio dimensioni caselle |
| `src/components/cockpit/AIDraftStudio.tsx` | Bottone invio WhatsApp diretto |
| `supabase/functions/send-whatsapp/index.ts` | Nuova funzione (solo se Twilio) |

