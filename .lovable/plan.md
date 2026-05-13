
# Riorganizzazione Navigazione V2

Solo modifiche alla navigazione. Zero cambi a logica, edge functions, DB, prompt o componenti pagina.

## Modifiche richieste

### 1. Menu principale (top nav) — `src/v2/ui/templates/navConfig.tsx`

Aggiunte 2 nuove voci pinned in alto:

| Posizione | Voce | Path | Icon | Note |
|-----------|------|------|------|------|
| 1.5 | **Missioni** | `/v2/agents/autopilot` | Target | Subito dopo Command |
| 6.5 | **Lab & Verifiche** | `/v2/lab` | FlaskConical | Subito dopo Agenda |

Le altre 13 voci canoniche restano invariate (Command, Explore, Cestinone, Cockpit, Inbox, Email, Agenda, Email Intelligence, Funnemail, Rubrica WA/LI, Intelligence, Config).

### 2. Secondary nav — `src/v2/navigation/registry.ts`

#### 2a. Estensione tipo per supportare sotto-gruppi (subfolders)

```ts
interface SecondaryNavSubGroup {
  readonly title: string;
  readonly items: readonly SecondaryNavItem[];
}
interface SecondaryNavGroup {
  readonly title: string;
  readonly items?: readonly SecondaryNavItem[];
  readonly subGroups?: readonly SecondaryNavSubGroup[];   // NEW
}
```

UI consumer (`OrphanPagesNav`, `NavMenuPopover`, `SettingsPage` Development tab) renderizzano i `subGroups` come accordion annidato dentro l'accordion del gruppo padre — stessa estetica della sidebar dello screenshot.

#### 2b. Nuovo layout dei gruppi

```text
📂 Acquisizione & Ricerca         (invariato)
   • Acquisizione Partner / Prospects / RA Explorer / RA Scraping / Research / Sorting

📂 Agenti & Missioni              (RIORGANIZZATO con sub-folders)
   ├ Agenti
   │  • AI Staff Hub              ← spostato qui (era in "AI Staff")
   │  • Agent Capabilities
   │  • Agent Tasks
   │  • Editor Persona
   ├ Missioni
   │  • Missioni Autopilot
   │  • Mission Builder
   │  • AI Arena 3D               ← spostato qui (era in "AI Staff")

📂 AI Staff                        ← RIMOSSO (svuotato)
   • KB Supervisor → spostato in "Lab & Verifiche (hub)"
   • Lab & Verifiche → ora è top-nav (resta anche qui in subgroup "Hub")

📂 Email & Comunicazione          (RIDOTTO)
   • Funnemail Sorting
   (Email Forge spostato in Lab & Verifiche)

📂 Agenda & Pipeline              (RINOMINATO da "Calendario & Campagne", ESPANSO)
   • Calendar (deep-link)         ← già qui
   • Campaign Jobs                ← già qui
   (entrambi confermati sotto Agenda come richiesto)

📂 Cockpit & Analytics            (INVARIATO)
   • AI Control Center / Analytics / Dashboard / KPI / Notifications

📂 Lab & Verifiche (hub)          (ESPANSO)
   ├ Hub
   │  • Lab & Verifiche (apri /v2/lab)
   │  • Tests / Prompts / Observability / Design (deep-link gruppi)
   ├ Test specifici
   │  • Email Forge               ← spostato qui
   │  • KB Supervisor             ← spostato qui

📂 Sistema & Admin                (invariato)
   • Admin Users / Email Download / Finder API / Finder API Catalog / Guida
```

### 3. i18n
Aggiungere chiavi mancanti in `src/i18n/`:
- `nav.missioni` → "Missioni"
- `nav.lab` → "Lab & Verifiche"

### 4. MobileBottomNav
Nessun cambio richiesto (Lab & Missioni accessibili dal menu, non dal dock mobile).

---

## File toccati

| File | Modifica |
|------|----------|
| `src/v2/ui/templates/navConfig.tsx` | +2 voci pinned (Missioni, Lab & Verifiche) |
| `src/v2/navigation/registry.ts` | Estensione tipo `subGroups` + nuovo layout gruppi |
| `src/v2/ui/templates/OrphanPagesNav.tsx` | Render ricorsivo sub-groups |
| `src/v2/ui/templates/NavMenuPopover.tsx` | Render ricorsivo sub-groups |
| `src/v2/ui/pages/SettingsPage.tsx` (tab Development) | Render ricorsivo sub-groups |
| `src/i18n/it.ts` + altre lingue | 2 chiavi nuove |

---

## Acceptance

1. In alto al menu, dopo "Command", appare **Missioni**. Cliccandolo si apre `/v2/agents/autopilot`.
2. In alto al menu, dopo "Agenda", appare **Lab & Verifiche**. Cliccandolo si apre `/v2/lab`.
3. Aprendo "Development" → "Agenti & Missioni" si vedono 2 sotto-cartelle: **Agenti** (con AI Staff Hub dentro) e **Missioni** (con AI Arena 3D + Mission Builder + Autopilot).
4. Il gruppo "AI Staff" non esiste più nel menu Development.
5. **KB Supervisor** è scomparso da AI Staff e si trova ora in "Lab & Verifiche (hub)" → "Test specifici".
6. **Email Forge** è scomparso da "Email & Comunicazione" e si trova in "Lab & Verifiche (hub)" → "Test specifici".
7. **Calendar** e **Campaign Jobs** restano nel gruppo "Agenda & Pipeline" (rinominato).
8. Nessuna rotta cambia. Nessuna pagina viene rinominata o spostata di percorso. Solo struttura del menu.

---

## Out of scope (esplicitamente non toccati)

- Pagine reali: nessun componente di pagina viene modificato
- Routing (`src/v2/routes.tsx`): nessuna rotta aggiunta/spostata
- Logica AI, edge functions, DB
- Cockpit & Analytics: invariato come richiesto
- Lab Hub interno (`labTabs.ts`): non modifico le 22 tab già lì
