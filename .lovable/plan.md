

# Audit Completo — Comunicazione, AI, Estensioni e Bottoni

## Inventario Completo degli Elementi

### EMAIL — 7 punti di lancio
| # | Componente | Azione | Metodo |
|---|-----------|--------|--------|
| 1 | `ContactActionMenu` (Cockpit ⋮) | "Invia email ora" | `navigate("/email-composer")` |
| 2 | `PartnerContactActionMenu` (Network ⋮) | "Invia email" | `onSendEmail` callback o navigate |
| 3 | `ContactRecordActions` (Drawer) | Bottone Email | `useDirectContactActions().handleSendEmail` → navigate |
| 4 | `PartnerDetailCompact` (Network inline) | Click su email | `handleSendEmail` → navigate |
| 5 | `BusinessCardsView` (BCA inline) | Icona Mail su card | `useDirectContactActions().handleSendEmail` |
| 6 | `SendEmailDialog` (Operations) | Dialog modale + `send-email` EF | `supabase.functions.invoke("send-email")` |
| 7 | `EmailCanvas` / `useAIDraftActions` (Workspace) | Invio email diretta | `supabase.functions.invoke("send-email")` |

### WHATSAPP — 5 punti di lancio
| # | Componente | Metodo |
|---|-----------|--------|
| 1 | `ContactActionMenu` (Cockpit ⋮) | ⚠️ `window.open("wa.me/...")` — NON usa extension bridge |
| 2 | `PartnerContactActionMenu` (Network ⋮) | ⚠️ Fallback `window.open("wa.me/...")` se nessun callback |
| 3 | `ContactRecordActions` (Drawer) | ✅ `useDirectContactActions().handleSendWhatsApp` → extension bridge |
| 4 | `PartnerDetailCompact` (Network inline) | ✅ `sendWhatsApp` via extension bridge |
| 5 | `useOutreachQueue` (Coda automatica) | ✅ `wa.sendWhatsApp` via extension bridge |

### LINKEDIN — 3 punti di lancio
| # | Componente | Metodo |
|---|-----------|--------|
| 1 | `ContactRecordActions` (Drawer) | `LinkedInDMDialog` → `sendDirectMessage` via extension bridge |
| 2 | `useOutreachQueue` (Coda automatica) | `li.sendDirectMessage` via extension bridge |
| 3 | `useLinkedInLookup` (Ricerca profili) | `pcBridge.googleSearch` via Partner Connect |

### DEEP SEARCH — 3 punti di lancio
| # | Componente | Metodo |
|---|-----------|--------|
| 1 | `useDeepSearchRunner` (Partner/globale) | ✅ `localSearch.searchPartner/searchContact` via Partner Connect |
| 2 | `useContactActions.handleDeepSearch` (CRM Contatti) | ⛔ CHIAMA `deep-search-contact` DEPRECATA |
| 3 | `UnifiedBulkActionBar` (Tutte le viste) | Delega a runner del contesto |

### AI — 6 punti di interazione
| # | Componente | Edge Function |
|---|-----------|--------------|
| 1 | `useAiAssistantChat` (Drawer AI) | `ai-assistant` (streaming) |
| 2 | `HomeAIPrompt` (Home) | `ai-assistant` o `agent-execute` |
| 3 | `ContactAIBar` (CRM) | `contacts-assistant` |
| 4 | Email Composer / Oracle | `generate-email`, `improve-email` |
| 5 | `useOutreachGenerator` | `generate-outreach` |
| 6 | `KnowledgeBaseManager` | `improve-email` (per miglioramento KB) |

### ALIAS — 3 punti di lancio
| # | Componente | Edge Function |
|---|-----------|--------------|
| 1 | `ContactDetailPanel` (CRM dettaglio) | `generate-aliases` |
| 2 | `useContactActions.handleGroupAlias` (CRM bulk) | `generate-aliases` |
| 3 | `Operations` / `FilterActionBar` (Network) | `generate-aliases` |

### WCA MATCH / BCA — 2 punti
| # | Componente | Metodo |
|---|-----------|--------|
| 1 | `ContactListPanel` bulk | `supabase.rpc("match_contacts_to_wca")` |
| 2 | `BusinessCardsView` sync | `supabase.functions.invoke("sync-business-cards")` |

---

## BUG CRITICI TROVATI

### 🔴 BUG 1 — `handleDeepSearch` in CRM chiama Edge Function DEPRECATA
**File**: `src/hooks/useContactActions.ts` riga 43
**Problema**: `supabase.functions.invoke("deep-search-contact")` chiama una funzione che ritorna HTTP 410 (Gone) con messaggio "DEPRECATED". La Deep Search per contatti in CRM è **completamente non funzionante**.
**Fix**: Usare `useDeepSearchRunner` con `mode: "contact"` come fa già il resto del sistema (Cockpit, Network, BCA).

### 🔴 BUG 2 — `activity_type: "whatsapp_message"` non esiste nell'enum
**File**: `src/components/partners/PartnerDetailCompact.tsx` riga 110 e `src/hooks/useDirectContactActions.ts` riga 70
**Problema**: L'enum `activity_type` nel DB ha solo: `send_email`, `phone_call`, `add_to_campaign`, `meeting`, `follow_up`, `other`. Il tipo `"whatsapp_message"` non esiste → l'insert usa `as any` per bypassare TypeScript ma il DB potrebbe rifiutare l'insert o accettarlo solo perché non c'è un check constraint stretto. In `useDirectContactActions.ts` viene usato `"phone_call" as any` come workaround — incoerente.
**Fix**: Aggiungere `whatsapp_message` e `linkedin_message` all'enum `activity_type` via migrazione, oppure uniformare usando `"phone_call"` ovunque (meno preciso).

### 🟡 BUG 3 — WhatsApp nel Cockpit usa `window.open` invece dell'extension bridge
**File**: `src/components/cockpit/ContactActionMenu.tsx` riga 123-130
**Problema**: Il pulsante WhatsApp nel menu ⋮ del Cockpit apre `wa.me/` nel browser invece di usare l'extension bridge. Non crea attività, non entra nel circuito di attesa. Tutti gli altri punti (Drawer, Network, BCA) usano correttamente il bridge.
**Fix**: Sostituire con `useDirectContactActions().handleSendWhatsApp`.

### 🟡 BUG 4 — `PartnerContactActionMenu` fallback WhatsApp usa `window.open`
**File**: `src/components/partners/PartnerContactActionMenu.tsx` riga 93-101
**Problema**: Se non viene passato `onSendWhatsApp` come prop, il fallback è `window.open("wa.me/...")` — stesso problema del BUG 3. In pratica il prop viene sempre passato da `PartnerDetailCompact`, ma il fallback è fragile.

### 🟢 NOTA — `ContactActionMenu` email non passa `partnerId`
**File**: `src/components/cockpit/ContactActionMenu.tsx` riga 111-121
**Osservazione**: Il `prefilledRecipient` non include `partnerId` o `contactId`, perdendo il link al record. Gli altri punti (Drawer, Network) li passano correttamente.

---

## PIANO DI FIX

### Step 1 — Migrazione DB: aggiungere tipi attività mancanti
```sql
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'whatsapp_message';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'linkedin_message';
```

### Step 2 — Fix Deep Search contatti in CRM
In `useContactActions.ts`, sostituire la chiamata alla EF deprecata con l'uso di `useDeepSearchRunner` (contesto `DeepSearchContext`), oppure importare direttamente `useDeepSearchLocal` per eseguire la ricerca client-side.

### Step 3 — Uniformare WhatsApp nel Cockpit
In `ContactActionMenu.tsx`, importare e usare `useDirectContactActions().handleSendWhatsApp` al posto di `window.open`.

### Step 4 — Aggiungere `partnerId`/`contactId` al menu Cockpit
Passare i riferimenti nel `prefilledRecipient` per mantenere il link al record.

### Step 5 — Cleanup `as any` sui tipi attività
Dopo la migrazione enum, rimuovere tutti i cast `as any` su `activity_type` e `whatsapp_message`.

---

## File da modificare

| File | Modifica |
|------|----------|
| Migrazione SQL | `ALTER TYPE activity_type ADD VALUE 'whatsapp_message'` + `'linkedin_message'` |
| `src/hooks/useContactActions.ts` | Sostituire chiamata `deep-search-contact` con runner client-side |
| `src/components/cockpit/ContactActionMenu.tsx` | WhatsApp via extension bridge + aggiungere IDs al recipient email |
| `src/components/partners/PartnerContactActionMenu.tsx` | Fallback WhatsApp via bridge invece di `window.open` |
| `src/components/partners/PartnerDetailCompact.tsx` | Rimuovere `as any` su `activity_type` dopo migrazione |
| `src/hooks/useDirectContactActions.ts` | Usare `"whatsapp_message"` invece di `"phone_call" as any` |

Totale: 1 migrazione + 5 file da modificare. Nessun file nuovo.

