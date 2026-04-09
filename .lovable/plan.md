
# Audit Completo: Percorsi AI, Invio, Tracking e Uniformità del Sistema

## 🔍 ANALISI — Percorsi di Generazione AI

### Due edge function distinte per generare messaggi:

| Edge Function | Usata da | Canali | Parametri chiave |
|---|---|---|---|
| `generate-email` | Email Composer (Oracolo) | Solo email | `oracle_type`, `oracle_tone`, `use_kb`, `standalone`, `recipient_countries` |
| `generate-outreach` | Cockpit (drag & drop) | Email, WhatsApp, LinkedIn | `channel`, `contact_name`, `company_name`, `country_code`, `linkedin_profile`, `goal`, `quality` |

**⚠️ PROBLEMA**: Due motori AI con prompt e parametri diversi per lo stesso scopo. Il Cockpit usa `generate-outreach` (con intelligence LinkedIn, contesto contatto). L'Email Composer usa `generate-email` (con Oracle type/tone, KB). Non si parlano.

**Raccomandazione**: Unificare progressivamente in un unico endpoint `generate-outreach` esteso, che accetti anche i parametri Oracle. Nel frattempo, assicurarsi che entrambi leggano la KB e il contesto allo stesso modo.

---

## 🔍 ANALISI — Percorsi di Invio

### Email (3 percorsi diversi):

| Percorso | Dove si attiva | Edge Function | Tracking | Holding Pattern |
|---|---|---|---|---|
| **Cockpit** → `useAIDraftActions.handleSend` | Cockpit draft studio | `send-email` | ✅ `trackActivity` | ✅ via trackActivity |
| **SendEmailDialog** | Network, Partner detail | `send-email` | ✅ `trackActivity` | ✅ via trackActivity |
| **Email Composer** (EmailCanvas) | Standalone composer | `send-email` | ❓ Da verificare | ❓ Da verificare |
| **Outreach Queue** | Azioni autonome agenti AI | `send-email` | ❌ Nessuno | ❌ Nessuno |

### WhatsApp (3 percorsi):

| Percorso | Dove | Metodo | Tracking | Holding Pattern |
|---|---|---|---|---|
| **Cockpit** → `useAIDraftActions.handleSendWhatsApp` | Cockpit | `waBridge.sendWhatsApp` | ❌ **MANCANTE** | ❌ **MANCANTE** |
| **useDirectContactActions** | BCA, Contacts, Partner, Drawer | `waBridge.sendWhatsApp` | ✅ `activities` insert | ❌ Non aggiorna lead_status |
| **WhatsAppInboxView** (reply inline) | Inreach | `sendWhatsAppUnified` | ❌ **MANCANTE** | ❌ **MANCANTE** |
| **Outreach Queue** | Agenti AI | `waBridge.sendWhatsApp` | ❌ Nessuno | ❌ Nessuno |

### LinkedIn (2 percorsi):

| Percorso | Dove | Metodo | Tracking | Holding Pattern |
|---|---|---|---|---|
| **Cockpit** → `useAIDraftActions.handleSendLinkedIn` | Cockpit | `liBridge.sendDirectMessage` | ❌ **MANCANTE** | ❌ **MANCANTE** |
| **Outreach Queue** | Agenti AI | `liBridge.sendDirectMessage` | ❌ Nessuno | ❌ Nessuno |

---

## 🔍 ANALISI — Tracking Attività

Il sistema `useTrackActivity` è l'unico che fa **tutto correttamente**:
1. Inserisce in `activities`
2. Escala `lead_status` da `new` → `contacted`
3. Inserisce in `contact_interactions`
4. Incrementa `interaction_count`

**Ma è usato SOLO da**:
- `useAIDraftActions.handleSend` (email nel Cockpit)
- `SendEmailDialog` (email dal Network)

**NON è usato da**: WhatsApp Cockpit, LinkedIn Cockpit, WhatsApp Inreach reply, Outreach Queue, Direct Contact Actions (usa `activities` insert diretto senza `contact_interactions` o lead_status).

---

## 🔍 ANALISI — Verifica Autenticazione pre-invio

| Canale | Cockpit | Inreach | Direct Actions |
|---|---|---|---|
| Email | ✅ (sempre disponibile) | ✅ | ✅ |
| WhatsApp | ❌ Controlla solo `isAvailable`, non `isAuthenticated` | ❌ | ❌ Solo `isAvailable` |
| LinkedIn | ✅ `ensureAuthenticated()` | N/A | N/A |

---

## 🔍 ANALISI — Drop Zone e feedback pre-drop

Le drop zone nel Cockpit non verificano:
- Se il contatto ha un numero di telefono (per WhatsApp)
- Se il contatto ha un URL LinkedIn (per LinkedIn)
- Se il contatto ha un'email (per email)

Il feedback viene dato solo DOPO il drop, non prima.

---

## 📋 PIANO DI CORREZIONE

### Fase 1: Uniformare il Tracking (impatto massimo, rischio minimo)

**1.1** — Aggiungere `trackActivity` a `useAIDraftActions.handleSendWhatsApp` e `handleSendLinkedIn`
**1.2** — Aggiungere `trackActivity` a `WhatsAppInboxView` (reply inline)
**1.3** — Aggiungere `trackActivity` a `useOutreachQueue` (dopo invio riuscito)
**1.4** — Sostituire il `activities` insert diretto in `useDirectContactActions` con `trackActivity` per avere tutto il flusso (contact_interactions, lead_status, holding pattern)

### Fase 2: Verifica Autenticazione

**2.1** — Nel Cockpit: controllare `isAuthenticated` prima di `handleSendWhatsApp` (già implementato l'heartbeat, manca il check nel send)
**2.2** — In `useDirectContactActions`: controllare `isAuthenticated` prima di inviare WA
**2.3** — Nella toolbar WhatsApp: già fatto ✅

### Fase 3: Feedback Drop Zone

**3.1** — Mostrare indicatori sulle drop zone (icona barrata se manca il dato necessario)
**3.2** — Toast informativo pre-drop se il contatto non ha il campo richiesto

### Fase 4: Uniformare Generazione AI

**4.1** — Mappare i parametri Oracle (`oracle_type`, `oracle_tone`) anche nel payload di `generate-outreach` come alias
**4.2** — Garantire che entrambe le edge function leggano la KB con lo stesso Tiered Injection
**4.3** — Aggiungere il `context` (dalla Missione/Job) a entrambi gli endpoint
**4.4** — Creare una funzione wrapper unificata `useUnifiedGenerate` che scelga l'endpoint giusto ma esponga la stessa interfaccia

### Fase 5: Outreach Queue completa

**5.1** — Dopo ogni invio dall'Outreach Queue, chiamare `trackActivity` equivalente (server-side o client-side)
**5.2** — Verificare autenticazione WA/LI prima di processare gli item dalla queue

---

## File coinvolti

| File | Fase | Azione |
|---|---|---|
| `src/hooks/useAIDraftActions.ts` | 1.1, 2.1 | +trackActivity per WA/LI, +check isAuthenticated |
| `src/components/outreach/WhatsAppInboxView.tsx` | 1.2 | +trackActivity dopo reply |
| `src/hooks/useOutreachQueue.ts` | 1.3, 5.1 | +trackActivity post-invio |
| `src/hooks/useDirectContactActions.ts` | 1.4, 2.2 | Sostituire activities insert con trackActivity, +isAuthenticated |
| `src/components/cockpit/ChannelDropZones.tsx` | 3.1 | Feedback pre-drop visivo |
| `src/hooks/useOutreachGenerator.ts` | 4.4 | Wrapper unificato |

## Ordine di esecuzione

1. **Fase 1** (tracking) — immediato, max impatto
2. **Fase 2** (auth check) — veloce, previene errori
3. **Fase 3** (drop zone) — UX improvement
4. **Fase 4** (AI unificata) — più complessa, pianificabile
5. **Fase 5** (queue) — dipende da fase 1
