## Obiettivo
Riordinare il menu V2 secondo le indicazioni: Command come prima voce (nuova "Home"), Esplora seconda, Home attuale nascosta, "Pipeline CRM" rinominata "Pipeline". Email Intelligence resta voce indipendente per ora (decisione rimandata insieme a Intelligence).

## Nuovo ordine menu

```text
1. Command          (era #2 — diventa la nuova landing, etichetta resta "Command")
2. Esplora          (era #4 — sale in alto)
3. Pipeline         (era "Pipeline CRM" — rinominata)
4. Comunica
5. Email Intelligence
6. Intelligence
7. Config
```

Voce **Home** (path `/v2`, icona Dashboard) → **nascosta dal menu** (non rimossa: la rotta `/v2` resta funzionante per backward-compat e deep-link).

## Modifiche

### 1) `src/v2/ui/templates/navConfig.tsx`
- Rimuovere la riga `nav.home` da `navItemsDef` (la rotta `/v2` resta nel router, solo non più in sidebar).
- Riordinare le voci con i nuovi `pinOrder`:
  - Command → 1
  - Esplora → 2
  - Pipeline → 3
  - Comunica → 4
  - Email Intelligence → 5
  - Intelligence → 6
  - Config → 7
- Cambiare la `labelKey` di Pipeline da `nav.crm_pipeline` a `nav.pipeline` (nuova chiave i18n).
- Aggiornare il commento di intestazione (Phase 1) da "6 destinations" a "7 destinations" e rimuovere il riferimento a Home.
- In `mobileBottomNavPaths`, sostituire `"/v2"` con `"/v2/command"` come prima voce mobile.

### 2) `src/i18n/index.ts` (e file lingua collegati, se presenti)
- Aggiungere nuova chiave `nav.pipeline` con valore "Pipeline" (IT) / "Pipeline" (EN).
- Mantenere `nav.home` e `nav.crm_pipeline` definite (usate altrove o per rollback rapido).

### 3) Verifiche dipendenze (solo lettura, nessun edit previsto se non emergono regressioni)
- `MobileBottomNav.tsx`: deriva da `mobileBottomNavPaths` → si aggiorna automaticamente con la modifica al config.
- `FloatingDock.tsx`: usa `pinnedNavItems` (derivato da `navItemsDef`) → si adegua automaticamente.
- `CommandPalette.tsx`: ha lista propria `NAV_ITEMS` (Dashboard incluso) → **lasciato invariato** per ora; la palette è uno strumento di accesso rapido e può ancora navigare a `/v2`. Da rivalutare se l'utente vuole rimuoverla anche da lì.
- Smoke test `e2e/smoke/08-v2-navigation.spec.ts`: include `/v2` come rotta da verificare. Resta valido perché la rotta non viene rimossa dal router.

## Cosa NON viene toccato
- Router (`src/v2/routes.tsx`): la rotta `/v2` (DashboardPage) resta registrata. Nessun redirect aggiunto.
- Email Intelligence: resta voce di primo livello in attesa della discussione su Intelligence.
- Pagina Command: nessuna modifica ai contenuti, solo cambio di posizione in sidebar.

## Domande aperte (post-implementazione)
- Vuoi anche che `/v2` rediriga automaticamente a `/v2/command` (così chi atterra sulla root va direttamente alla nuova "home")? Posso aggiungerlo se confermi.
- Email Intelligence dentro Comunica come tab? Da decidere insieme al riordino di Intelligence.
