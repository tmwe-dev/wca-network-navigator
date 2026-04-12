

# Analisi Gap V1 → V2: Cosa Manca

## Numeri Complessivi

| Area | V1 | V2 | Gap |
|------|----|----|-----|
| **Componenti (.tsx)** | 352 file (60.542 LOC) | 80 file (7.400 LOC) | **272 file, 53.142 LOC** (~88% mancante) |
| **Hook** | 123 file (15.436 LOC) | 48 file (2.580 LOC) | **75 file, 12.856 LOC** (~83% mancante) |
| **Pagine** | 9.868 LOC | 4.020 LOC | ~59% mancante (ma le pagine V2 delegano a componenti) |

**La V2 ha circa il 12% del codice funzionale della V1.**

---

## Moduli Mancanti o Quasi Vuoti (per priorità)

### 1. GLOBO 3D — Homepage (V1: 1.226 LOC → V2: 37 LOC)
- V2 carica solo lo StandaloneGlobe senza nulla intorno
- **Manca tutto**: ActiveJobsWidget, AgentStatusPanel, OperativeBriefing, OperationsCenter, HomeAIPrompt, BriefingStatsBar
- Gap: **~1.189 LOC** (6 componenti)

### 2. CAMPAGNE + Globo Campagne (V1: 3.585 LOC → V2: 131 LOC)
- V2 ha solo tabella base con pause/resume
- **Manca tutto il wizard**: CampaignGlobe (3D con aerei, marker, selezione paesi), AuroraBorealis, TexturedEarth, CityMarkers, FlyingAirplanes, InstancedCountryMarkers
- **Manca**: CompanyList (477 LOC), JobCanvas (296 LOC), RecipientSelector, EmailPreview, CampaignQueueMonitor
- Gap: **~3.454 LOC** (15 componenti)

### 3. OVERLAY GLOBALI (V1: 2.793 LOC → V2: 0 LOC)
- **GlobalChat** (310 LOC) — Chat AI flottante, nessun equivalente V2
- **MissionDrawer** (522 LOC) — Drawer missioni globale, zero in V2
- **FiltersDrawer** (367 LOC) — Drawer filtri avanzati, zero in V2
- **EmailComposerContactPicker** (678 LOC) — Picker contatti per email, zero in V2
- **DownloadStatusPanel** (110 LOC) — Stato download, zero in V2
- Gap: **~2.793 LOC** (6 componenti)

### 4. OUTREACH/EMAIL — Invio & Code (V1: 3.750 LOC → V2: ~163 LOC pagina)
- V2 ha solo lista attività con filtri base
- **Manca completamente**:
  - HoldingPatternCommandCenter (413 LOC) — Centro controllo invio con drag&drop
  - HoldingPatternTab (261 LOC) — Tab pattern di attesa
  - CodaAITab (254 LOC) — Coda AI
  - EmailInboxView (205 LOC), EmailDetailView (259 LOC), EmailMessageList (145 LOC)
  - WhatsApp inbox/chat/thread (661 LOC totale)
  - LinkedIn inbox (410 LOC)
  - AttivitaTab (286 LOC), CampagneTab (143 LOC)
- Gap: **~3.587 LOC** (17 componenti)

### 5. COCKPIT — Drag & Drop (V1: 2.682 LOC → V2: 127 LOC)
- V2 ha solo statistiche base
- **Manca**: ChannelDropZones (drag&drop canali), CockpitContactCard (443 LOC, card con azioni), pipeline board, assegnazione agenti
- Gap: **~2.555 LOC** (14 componenti)

### 6. SETTINGS (V1: 5.229 LOC → V2: 978 LOC)
- V2 ha 14 tab shell con campi base
- **Manca ~80% logica**: SMTP test, LinkedIn session, WCA credenziali, voice preview ElevenLabs, gestione prompt (PromptManager), ContentManager, KnowledgeBaseManager, BlacklistManager, TemplateManager, OperativeGuide, DeepSearchConfig
- Gap: **~4.251 LOC** (12+ componenti mancanti)

### 7. PARTNERS (V1: 5.351 LOC → V2: drawer base)
- **Manca**: dettaglio completo partner (contatti, attività, history, enrichment), filtri avanzati, azioni batch
- Gap: **~4.500+ LOC** (24 componenti)

### 8. CONTACTS (V1: 3.807 LOC → V2: drawer base)
- **Manca**: BCA upload/matching, gruppi/tag management, import wizard completo, merge duplicati
- Gap: **~3.000+ LOC** (18 componenti)

### 9. DOWNLOAD ENGINE (V1: 3.695 LOC → V2: hook base)
- **Manca**: WCA download wizard, progress tracking, job management UI, enrichment UI
- Gap: **~3.500 LOC** (18 componenti)

### 10. EMAIL COMPOSER (V1: 710 LOC pagina + componenti → V2: 66 LOC + 464 LOC organisms)
- V2 ha editor base con variabili e preview
- **Manca**: ContactPicker completo (678 LOC dal global), template selection, allegati, invio multiplo con tracking, AI generation con KB
- Gap: **~900 LOC**

### 11. INTELLIFLOW / AGENTS (V1: 3.475 LOC → V2: ~96 LOC)
- **Manca quasi tutto**: chat thread, task list, agent config, pipeline, flow builder
- Gap: **~3.379 LOC** (26 componenti)

### 12. OPERATIONS (V1: 2.192 LOC → V2: shell)
- **Manca**: batch operations board, job runner, import/export bulk
- Gap: **~2.000+ LOC** (10 componenti)

### 13. HOOK LOGIC (V1: 15.436 LOC → V2: 2.580 LOC)
- 48 hook V2 esistono ma molti sono skeleton (30-60 LOC)
- I hook V1 hanno tutta la logica business: email send queue, campaign orchestration, download engine, enrichment pipeline, WhatsApp/LinkedIn integration
- Gap: **~12.856 LOC** (75 hook)

---

## Riepilogo Gap Totale

```text
Modulo                    V1 LOC    V2 LOC    Gap LOC
─────────────────────────────────────────────────────
Globo/Home                1.226        37     1.189
Campagne + Globo 3D      3.585       131     3.454
Overlay Globali           2.793         0     2.793
Outreach/Email/Code       3.750       163     3.587
Cockpit drag&drop         2.682       127     2.555
Settings                  5.229       978     4.251
Partners                  5.351       ~200    5.151
Contacts                  3.807       ~200    3.607
Download Engine           3.695       ~100    3.595
Email Composer              710       530       180
Agents/Intelliflow        3.475        96     3.379
Operations                2.192       ~100    2.092
Missions                  1.213       ~100    1.113
Prospects                 2.475       ~100    2.375
Acquisizione              1.169       ~80     1.089
Import                    1.689       ~100    1.589
Other (agenda,sorting..)  2.000       ~500    1.500
Hook logic               15.436     2.580    12.856
─────────────────────────────────────────────────────
TOTALE                   ~62.000    ~5.100   ~56.900
```

**In sintesi: la V2 ha il ~8% della logica funzionale della V1. Mancano circa 57.000 righe di codice distribuiti su ~320 componenti e hook.**

Le aree più critiche (in ordine di impatto operativo):
1. **Outreach/invio email** — nessuna coda, nessun holding pattern, nessun tracking
2. **Campagne** — nessun wizard, nessun globo 3D, nessuna orchestrazione
3. **Cockpit** — nessun drag&drop, nessuna assegnazione agenti
4. **Settings** — shell al 20%, nessun test SMTP/LinkedIn
5. **Overlay globali** — nessun GlobalChat, nessun MissionDrawer

