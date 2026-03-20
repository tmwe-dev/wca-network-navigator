

## Audit Uniformità Grafica della Piattaforma

### Classificazione delle Maschere per Qualità Visiva

```text
┌─────────────────────────────────────────────────────────────┐
│  TIER A — Premium (glassmorphism, animazioni, coerente)     │
├─────────────────────────────────────────────────────────────┤
│  Cockpit        │ 3 colonne, glass panels, badge origine    │
│  Operations     │ glass-panel, stat pills, gradient text    │
│  Global AI      │ Chat + Globo 3D, dark immersivo          │
│  SuperHome3D    │ Carosello 3D, prompt AI, dark-first       │
│  ProspectCenter │ Glassmorphism, stat bar, ATECO grid       │
│  PartnerHub     │ ResizablePanel, CountryCards, AI bar      │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  TIER B — Funzionale ma visivamente più semplice            │
├─────────────────────────────────────────────────────────────┤
│  Contacts       │ ResizablePanel, pulito ma nessun effetto  │
│  Workspace      │ ResizablePanel, GoalBar, nessun glass     │
│  HubOperativo   │ Card standard shadcn, no glassmorphism    │
│  EmailComposer  │ Card/Input standard, layout tradizionale  │
│  Import         │ Card standard, spazio bianco, h1 bold     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  TIER C — Disallineate o legacy                             │
├─────────────────────────────────────────────────────────────┤
│  Reminders      │ h1 "text-3xl", Card standard, testi EN,   │
│                 │ layout con space-y-6 senza contenimento   │
│  Settings       │ max-w-3xl, h1 "text-2xl", stile legacy   │
└─────────────────────────────────────────────────────────────┘
```

### Problemi Specifici di Disuniformità

| Problema | Dove | Standard (Cockpit) |
|---|---|---|
| **Titolo pagina h1 text-3xl** | Reminders | Nessun h1 visibile, titolo integrato nella barra |
| **Testi in inglese** | Reminders ("Track follow-ups", "Pending", "Completed", "Today") | Tutto in italiano |
| **Layout `space-y-6` senza bordi** | Reminders, Settings | Layout a colonne con `border-border/50` |
| **`max-w-3xl` che limita la larghezza** | Settings | Full width con pannelli |
| **Nessun glassmorphism** | Contacts, Workspace, HubOperativo, Import, EmailComposer | `glass-panel`, `float-panel`, backdrop-blur |
| **Nessuna stat bar / pills** | Contacts, Workspace, Reminders, Import | Stat pills contestuali nella top bar |
| **Theme toggle autonomo** | Operations, ProspectCenter (proprio isDark) | Tema globale dalla root |
| **Card shadcn nude** | HubOperativo, Import, Reminders | Card con `bg-card/70 backdrop-blur` |
| **Nessuna AI bar / assistant** | Contacts, Reminders, Settings, Import (ha ImportAssistant ma separato) | AI integrata nella top bar o pannello laterale |

### Le Maschere Più Eleganti

1. **Cockpit** — Lo standard di riferimento. Tre colonne, drag-and-drop, glassmorphism, badge cromatici, typewriter effect
2. **Operations** — Stat pills interattive, CountryGrid con effetti hover, glass-panel nella top bar, DownloadTerminal
3. **Global AI** — Immersivo: chat + globo 3D side-by-side, dark puro
4. **ProspectCenter** — Gradient backgrounds animati, stat bar arrotondata, search con styling custom

### Le Maschere Più Deboli

1. **Reminders** — La più disallineata. Testi in inglese, titolo gigante, nessun effetto glass, layout piatto con Card standard
2. **Settings** — Max-width stretto, layout tradizionale, nessun effetto premium
3. **Import** — Funzionale ma visivamente piatto, usa Card/Button standard senza glass
4. **HubOperativo** — Card standard, nessun effetto, layout a lista semplice

### La Piattaforma È Uniforme?

**No.** Esistono almeno 3 livelli grafici distinti. Le maschere del Tier A (Cockpit, Operations, Global) sono coerenti tra loro e seguono il design system premium. Le maschere del Tier B e C non adottano glassmorphism, stat pills, o AI bar integrata, risultando visivamente più piatte e datate.

### Piano di Armonizzazione

Per portare tutte le maschere al livello del Cockpit servirebbe:

**Priorità 1 — Reminders (la più critica)**
- Tradurre tutti i testi in italiano
- Rimuovere h1 text-3xl, adottare top bar con glass-panel
- Applicare glassmorphism alle Card del calendario
- Aggiungere stat pills (reminder pendenti, completati, scaduti)

**Priorità 2 — Settings**
- Rimuovere max-w-3xl, adottare layout full-width con pannello laterale
- Applicare glass panels ai contenitori delle sezioni

**Priorità 3 — Import / EmailComposer / HubOperativo**
- Sostituire Card standard con float-panel o glass-panel
- Aggiungere top bar con stat pills contestuali
- Allineare lo stile degli input (rounded-xl, bg-white/5)

**Priorità 4 — Contacts / Workspace**
- Applicare glassmorphism ai pannelli ResizablePanel
- Aggiungere stat bar sopra la lista contatti

Questo intervento richiederebbe la modifica di circa 6-8 file pagina e relativi componenti. Vuoi procedere con una priorità specifica?

