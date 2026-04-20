
## Diagnosi: 2 menu V2 con voci diverse

Nella V2 oggi convivono **due sistemi di navigazione separati**, ciascuno con la propria lista di voci hardcoded:

### Menu 1 — `FloatingDock` (dock verticale a sinistra, sempre visibile)
File: `src/components/layout/FloatingDock.tsx`  
**10 voci**: Home, Command, Agenti, Email, Comunicazioni, Contatti, Template, Automazioni, Audit, Impostazioni

### Menu 2 — `LayoutSidebarNav` (pannello hamburger, si apre cliccando ☰)
File: `src/v2/ui/templates/LayoutSidebarNav.tsx`  
**~20 voci** organizzate in 6 gruppi: Command, Overview (Dashboard, Network, Globe, CRM), Comunicazione (Outreach, Inreach, Agenda, Campagne, Approvazioni, AI Arena), Intelligence (Email Intelligence, Email Forge, Research), AI Operations (Agenti, Missioni, AI Staff, AI Control), Sistema (Impostazioni, Guida)

### Perché succede
- Le **due liste sono fisicamente diverse e non condividono sorgente dati**.
- Il `FloatingDock` punta a rotte semplificate (`/v2/agents`, `/v2/templates`, `/v2/automations`, `/v2/audit`) di cui alcune **non esistono** nel router V2 (es. `/v2/templates`, `/v2/automations`, `/v2/audit` non sono mappate → portano a 404 o a fallback).
- Il `LayoutSidebarNav` è la **navigazione canonica** (allineata alle rotte reali in `src/v2/routes.tsx`).
- In produzione vedi le voci dell'hamburger perché è quello realmente collegato al router; il dock laterale invece propone label "marketing" inventate (Template/Automazioni/Audit) che non corrispondono al sistema.

### Diagramma

```text
AuthenticatedLayout
├── FloatingDock (dock a sx) ────► lista A (10 voci, alcune broken)
└── LayoutSidebarNav (hamburger) ──► lista B (20 voci, canonica)
                                     ▲
                                     └── allineata a src/v2/routes.tsx
```

## Piano di consolidamento

Obiettivo: **una sola sorgente di verità** per la navigazione V2, così che dock + hamburger + mobile bottom nav mostrino **identiche etichette e portino a rotte esistenti**.

### Step 1 — Sorgente unica
Creare `src/v2/ui/templates/navConfig.ts` che esporta `navGroupsDef` (oggi dentro `LayoutSidebarNav`). Questa diventa l'unica lista canonica.

### Step 2 — Rifare `FloatingDock` come "Top picks" del menu canonico
Il dock laterale mostra **8 scorciatoie** prese dal `navGroupsDef` (non più voci inventate), selezionate con flag `pinned: true` nel config. Esempio: Dashboard, Command, Network, CRM, Outreach, Inreach, Agenti, Impostazioni. Tutte rotte reali, label uguali a quelle dell'hamburger.

### Step 3 — Rimuovere voci "fantasma"
Elimino dal dock le voci che non esistono nelle rotte V2: Template, Automazioni, Audit, Comunicazioni (era duplicato di Outreach), Email (duplicato).

### Step 4 — Allineamento mobile
`MobileBottomNav` continua a mostrare le 4 voci principali + Mission, ma le pesca anch'esso da `navConfig.ts` (oggi è hardcoded a parte).

### Step 5 — Verifica
Eseguire mentalmente il check: ogni `path` nel config esiste in `src/v2/routes.tsx`. I tre menu (dock, hamburger, bottom nav mobile) mostrano label coerenti e vanno alle stesse pagine.

## File toccati

- **Nuovo**: `src/v2/ui/templates/navConfig.ts` (sorgente unica con flag `pinned`).
- **Edit**: `src/components/layout/FloatingDock.tsx` → legge da `navConfig`, mostra solo `pinned`, label tradotte come l'hamburger.
- **Edit**: `src/v2/ui/templates/LayoutSidebarNav.tsx` → importa `navGroupsDef` da `navConfig`.
- **Edit**: `src/components/mobile/MobileBottomNav.tsx` → legge da `navConfig`.

## Esito atteso

Dopo l'intervento, dock laterale e hamburger mostreranno **le stesse etichette per le stesse destinazioni**, e ogni voce del dock porterà a una pagina realmente esistente. La differenza che hai visto sparirà sia in preview sia in produzione (dopo Publish).
