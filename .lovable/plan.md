

## Ristrutturazione Navigazione: Due Aree di Business + Header Actions

### Concetto

Dividere il sistema in **due aree distinte** nel sidebar, spostare Email e Agenda nell'header come azioni rapide, e spostare Import dentro Settings.

```text
── HEADER BAR (sempre visibile) ─────────────
   [Menu] [ActiveProcess]          [Credits] [Email] [Agenda] [AI] [Search]

── SIDEBAR ──────────────────────────────────

   ── Panoramica ───────────
      Super Home        /
      Global            /global

   ── WCA Network ──────────    (icona Globe)
      Download WCA      /operations
      Rubrica Partner   /partner-hub

   ── Commerciale ──────────    (icona Briefcase)
      Contatti CRM      /contacts
      Cockpit           /cockpit

   ── Attivita ─────────────    (icona Zap)
      Campagne          /campaigns
      Operations        /hub

   ── Sistema ──────────────
      Impostazioni      /settings    (Import spostato qui dentro)
      Diagnostica       /diagnostics
      Guida             /guida

   ── Footer ───────────────
      WCA Online/Offline
      Dark/Light Mode
```

### Modifiche

**1. Sidebar (`AppSidebar.tsx`)**
- Rinominare "Acquisition" → "Download WCA" con icona `Download`
- Rinominare "Contatti" → "Contatti CRM" con icona `UserCheck`  
- Rimuovere "Email" e "Agenda" dal sidebar
- Rimuovere "Import" dal sidebar (va dentro Settings)
- Creare sezione "WCA Network" (Download WCA + Rubrica Partner)
- Creare sezione "Commerciale" (Contatti CRM + Cockpit)
- Creare sezione "Attivita" (Campagne + Operations)
- Fix icone: nessuna duplicazione, ogni voce ha un'icona unica

**2. Header (`AppLayout.tsx`)**
- Aggiungere bottone Email (icona `Send`) → naviga a `/email-composer`
- Aggiungere bottone Agenda (icona `Calendar`) → naviga a `/reminders`
- Posizionati accanto a Credits e AI, sempre accessibili

**3. Import dentro Settings**
- Non serve modificare il routing, solo la navigazione
- L'utente accede a Import da Settings (tab o link interno) — per ora basta rimuoverlo dal sidebar; la pagina `/import` resta raggiungibile

### File da modificare
1. `src/components/layout/AppSidebar.tsx` — ristrutturazione sezioni e nomi
2. `src/components/layout/AppLayout.tsx` — aggiunta bottoni Email e Agenda nell'header

