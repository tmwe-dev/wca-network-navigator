

# V2 come wrapper di V1: analisi di fattibilità

## La risposta breve

**Sì, si può fare. E conviene.** I componenti V1 sono già quasi tutti compatibili perché:

1. **Stesso stack**: React 18, React Query, Supabase client, Tailwind, shadcn/ui — zero conflitti di framework
2. **Stessi dati**: I componenti V1 usano `src/data/*` (DAL) e `src/hooks/*` — funzionano identicamente sotto qualsiasi layout
3. **Dipendenze limitate**: Solo pochi componenti V1 usano context (`ContactDrawerContext`, `ActiveOperatorContext`) — questi context sono già montati in `App.tsx` e wrappano TUTTO, V1 e V2

## Cosa guadagni con V2

```text
V2 Architecture                    V1 Architecture
─────────────────                  ─────────────────
✅ Layout pulito (sidebar 56px)    ❌ Layout monolitico
✅ Auth separato (/v2/login)       ❌ Auth condiviso con redirect rotti
✅ Routing dichiarativo            ❌ Routing flat con redirect legacy
✅ Error boundaries per modulo     ❌ Error boundary globale unico
✅ Core/IO/Bridge (per nuovo)      ❌ Logica sparsa in componenti
```

Ma il vantaggio REALE è: **il layout, il routing, l'auth e la shell**. Il 90% del valore funzionale sta nei componenti V1 che già funzionano.

## Come funziona il montaggio

Esempio concreto — Cockpit:

```text
OGGI (V2 CockpitPage.tsx — 127 LOC, fa quasi niente):
  → Tabella base con 4 stat card

DOPO (V2 CockpitPage.tsx — ~30 LOC, importa V1):
  → import { useCockpitLogic } from "@/hooks/useCockpitLogic"
  → import { ContactStream } from "@/components/cockpit/ContactStream"
  → import { ChannelDropZones } from "@/components/cockpit/ChannelDropZones"
  → import { AIDraftStudio } from "@/components/cockpit/AIDraftStudio"
  → Stesse funzionalità della V1, layout V2
```

**Non serve riscrivere niente.** Le pagine V2 diventano thin wrapper che importano componenti V1 e li montano nel layout V2.

## Cosa è compatibile subito (zero modifiche)

| Modulo | Componenti V1 | Hook V1 | Compatibile? |
|--------|--------------|---------|--------------|
| Cockpit (14 comp.) | ContactStream, ChannelDropZones, AIDraftStudio... | useCockpitLogic, useCockpitContacts | ✅ Diretto |
| Outreach (16 comp.) | HoldingPatternCommandCenter, EmailInbox, WhatsApp... | useHoldingPattern, useOutreachGenerator | ✅ Diretto |
| Campaigns (Wizard+Globe) | CampaignGlobe, JobCanvas, CompanyList... | useCampaigns | ✅ Diretto |
| Settings (12+ comp.) | PromptManager, BlacklistManager, SMTPTest... | useSettings hook | ✅ Diretto |
| Agents (14 comp.) | AgentCard, AgentDetail, AgentChat... | useAgents | ✅ Diretto |
| Email Composer | ContactPicker, TemplateSelector | useEmailComposer | ✅ Diretto |
| Overlay globali | GlobalChat, MissionDrawer, FiltersDrawer | — | ⚠️ Vanno montati nel layout V2 |

## Cosa richiede adattamento minimo

1. **Overlay globali** (GlobalChat, MissionDrawer): vanno montati nell'`AuthenticatedLayout` V2, non nelle singole pagine — 10 righe di codice
2. **Navigazione interna**: Alcuni componenti V1 fanno `navigate("/v1/crm")` — vanno cercati e sostituiti con `/v2/crm` (find & replace)
3. **3 context** (`ContactDrawerContext`, `ActiveOperatorContext`, `ContactRecordDrawer`): già montati in App.tsx sopra a tutto — funzionano senza modifiche

## Piano di esecuzione

Il lavoro si divide in **5 blocchi**, ognuno completabile in una sessione:

### Blocco 1 — Cockpit + Outreach (cuore operativo)
- Sostituire CockpitPage V2 con wrapper che importa i 14 componenti V1
- Sostituire OutreachPage V2 con wrapper che importa i 16 componenti V1
- Montare overlay globali (GlobalChat, MissionDrawer) nel layout V2
- **~40 pagine V2 toccate: 2 | Componenti V1 riusati: 30**

### Blocco 2 — Campagne + Email Composer
- Sostituire CampaignsPage con wizard completo V1 (CampaignGlobe, JobCanvas)
- Sostituire EmailComposerPage con composer V1 + ContactPicker
- **Componenti V1 riusati: ~20**

### Blocco 3 — Settings + Agents + Staff
- Sostituire SettingsPage con tutti i tab funzionali V1
- Sostituire AgentsPage con AgentCard/Detail/Chat V1
- Sostituire StaffPage con briefing AI V1
- **Componenti V1 riusati: ~40**

### Blocco 4 — Network, CRM, Partners, Contacts
- Sostituire pagine V2 con componenti V1 (filtri avanzati, azioni batch, drawer dettaglio)
- **Componenti V1 riusati: ~50**

### Blocco 5 — Tutto il resto
- Import, Operations, Diagnostics, Telemetry, Prospects, Globe Home
- Pulizia navigazione (replace `/v1/` → `/v2/`)
- **Componenti V1 riusati: ~30**

## Risultato finale

- **~170 componenti V1** montati dentro **~35 pagine V2**
- Layout, auth, routing: V2 (pulito)
- Logica business, UI funzionale: V1 (già testata)
- Hook V2 skeleton: rimangono per futuro refactoring graduale, non bloccano
- Tempo stimato: **5 sessioni** vs le settimane necessarie per riscrivere tutto

