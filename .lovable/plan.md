## Inventario attuale top bar (17 elementi in 44px)

**Sinistra:**
1. ☰ Menu hamburger (toggle sidebar)
2. ⌘ "Cerca rapida" (apre Command Palette, ⌘K)
3. ActiveProcessIndicator (badge processi background)
4. Badge "Offline" (condizionale)
5. Pulsante contestuale → CRM / → Network
6. ConnectionStatusBar (cluster: AI status, outreach queue, night pause, resume timer)
7. Slot dinamico `#campaign-header-controls`

**Destra:**
8. TokenUsageCounter (consumo token AI)
9. AIAutomationToggle (interruttore automazione)
10. Selettore lingua vocale (🌍 IT/EN/...)
11. OperatorSelector (admin only, swap operatore)
12. NotificationCenter (🔔)
13. ➕ Add Contact
14. 🗄️ DatabaseZap → settings?tab=enrichment
15. 📊 Activity → Agent Operations Dashboard
16. 🧪 FlaskConical → Test Extensions
17. ✨ Sparkles → IntelliFlow AI

## Diagnosi

- **Funzioni rare in primo piano**: Test Extensions, Enrichment shortcut, Agent Ops sono usate raramente ma occupano spazio fisso.
- **Stato vs azione mescolati**: ConnectionStatusBar mostra 4-5 cose (AI, queue, night pause, resume) che sono _stato_, accanto a icone _azione_ (➕, ✨…).
- **Doppia entrata Command Palette**: il pulsante "Cerca rapida" è ridondante con la scorciatoia ⌘K (che funziona sempre). Occupa ~140px.
- **Settings sparsi**: lingua vocale, AI automation, enrichment shortcut sono tutte preferenze → casa naturale = `/v2/settings`.
- **Navigazione contestuale CRM↔Network** è già coperta dalle tab e dalla sidebar.

## Proposta: top bar a 6 elementi

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ ☰  Breadcrumb · Dashboard › Esplora › Mappa     [stato] 🔔 👤 ⋯ ✨    │
└─────────────────────────────────────────────────────────────────────────┘
```

**Sinistra (sempre visibili):**
1. **☰ Menu** (toggle sidebar)
2. **Breadcrumb** (assorbe il GoldenHeaderBar di pagina — un solo header invece di due)
3. **StatusPill** unico, compatto, cliccabile → apre popover con: connessione, AI on/off, outreach queue, night pause, processi attivi. Sostituisce ConnectionStatusBar + ActiveProcessIndicator + badge Offline. Default: solo un pallino colorato (verde/giallo/rosso) + numero processi se >0.

**Destra (sempre visibili):**
4. **🔔 Notifiche**
5. **👤 Operatore** (mostra avatar; admin → dropdown swap; non-admin → solo profilo + logout)
6. **⋯ Strumenti** (menu dropdown — vedi sotto)
7. **✨ AI** (IntelliFlow, unico bottone "azione AI" prominente)

**Rimossi dalla barra:**
- Pulsante "Cerca rapida" → resta solo lo shortcut ⌘K (ricordato in tooltip su ☰). Risparmio ~140px.
- Selettore lingua vocale → spostato in `/settings` → tab "Voce & AI".
- AIAutomationToggle → spostato in `/settings` → tab "AI" (con stato visibile nello StatusPill).
- TokenUsageCounter → spostato in `/settings` → tab "Billing/Usage" (mostrato nello StatusPill solo quando >80% soglia).
- ➕ Add Contact → spostato come FAB nelle pagine Pipeline/Network (dove ha senso); rimosso dalla top bar globale.
- DatabaseZap (Enrichment shortcut) → dentro menu **⋯ Strumenti**.
- Activity (Agent Ops) → dentro menu **⋯ Strumenti**.
- FlaskConical (Test Extensions) → dentro menu **⋯ Strumenti** (in fondo, sotto separator "Debug").
- Pulsanti contestuali "→ CRM" / "→ Network" → rimossi (già coperti da sidebar/tab).
- Slot `#campaign-header-controls` → mantenuto invisibile per retrocompatibilità ma spostato sotto la GoldenHeaderBar di pagina, dove ha senso visivo.

**Menu ⋯ Strumenti (dropdown):**
- Agent Operations
- Enrichment Center
- Test Extensions
- (separator)
- Apri Trace Console (🩺)
- Tema chiaro/scuro

## Comportamento responsive

- **Desktop ≥1280px**: tutti e 6 visibili.
- **Tablet 768-1279px**: StatusPill resta solo pallino colorato (no testo); breadcrumb compresso (mostra ultimi 2 livelli).
- **Mobile <768px**: top bar già nascosta (`hidden md:flex`) — invariato, resta MobileBottomNav.

## Implementazione (sintesi tecnica)

1. Nuovo `LayoutHeaderCompact.tsx` che sostituisce `LayoutHeader.tsx` (vecchio preservato come `.bak.tsx` per rollback).
2. Nuovo componente `StatusPill.tsx` che aggrega: online/offline, AI automation, outreach queue, night pause, processi attivi. Popover on-click con dettagli.
3. Nuovo `HeaderToolsMenu.tsx` (DropdownMenu shadcn) con le voci "Strumenti".
4. Spostamenti in `/v2/settings`:
   - Tab "Voce & AI" → integra `VoiceLanguageSelector` + `AIAutomationToggle` + soglia token.
   - Tab "Usage" → integra `TokenUsageCounter` versione full.
5. Rimuovere il pulsante "Cerca rapida" — verificare che ⌘K resti registrato globalmente in `useCommandPalette`.
6. Spostare `Add Contact` come FAB nelle pagine Pipeline/Contacts/Network (riusa `AddContactDialog` esistente).
7. Aggiornare il selettore tema (oggi non c'è in top bar): aggiungerlo nel menu ⋯ Strumenti.
8. Mantenere `GoldenHeaderBar` come riga separata sotto la top bar (breadcrumb di pagina + actions di pagina) — alternativa: fonderli in un'unica riga 44px. **Da decidere con te.**

## Cosa NON tocco

- Sidebar sinistra
- MissionDrawer destro
- MobileBottomNav
- GoldenHeaderBar di pagina (può restare o fondersi: scelta tua)
- Logica funzionale dei singoli componenti spostati (solo posizionamento)

## Domande aperte (da chiarire prima di implementare)

1. **Breadcrumb**: preferisci una sola riga (top bar + breadcrumb fusi in 44px) o due righe (top bar globale + GoldenHeaderBar di pagina)?
2. **Add Contact**: sei d'accordo a spostarlo come FAB solo nelle pagine pertinenti, oppure preferisci tenerlo nella top bar globale?
3. **Tema chiaro/scuro**: lo vuoi nel menu ⋯ Strumenti o vicino all'avatar operatore?
