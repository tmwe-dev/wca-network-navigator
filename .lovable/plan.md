## Risposta sintetica (KB letta)

**Perché manca il tasto Deep Search sul singolo in Network**
La maschera Network (`/v2/explore/network`) usa `EntityListWithDetail` → `PartnerDetailInline` → `PartnerDetailFull`. Nessuno di questi componenti monta un trigger Deep Search. L'unico entry-point oggi è il **BulkActionsPanel** (selezione 2+), che spara `network-trigger-deep-search-batch` (legacy `useDeepSearchLocal`).
Sul singolo partner, oggi, Deep Search è raggiungibile solo da Email Forge → tab Sherlock (via `useSherlock`) o dal vecchio `PartnerDetailCompact` (che però non viene montato in Network V2).

**Memoria del livello eseguito**
Sì: la tabella `sherlock_investigations` salva `partner_id`, `contact_id`, `level` (1=Scout, 2=Detective, 3=Sherlock), `status`, `completed_at`. Quindi il sistema *può* ricordare il massimo livello eseguito per ogni partner/contatto — ma oggi **nessuna card o dettaglio lo legge**. Le card mostrano solo il badge legacy `enrichment.deep_search_at` (data dell'ultimo enrichment via estensione, senza livello).

**Icone livello**
Non esistono ancora icone dedicate per Scout/Detective/Sherlock nelle card. Solo il logo Sparkles generico nel bar bulk.

---

## Piano

### 1. Tasto Deep Search sul singolo partner in Network
- In `PartnerDetailInline` aggiungere, accanto a "Chiudi", un menu "Deep Search ▾" con tre voci: **Scout** (gratis), **Detective** (medio), **Sherlock** (completo).
- Click → apre un dialog leggero (`SherlockLauncherDialog`) che instanzia `useSherlock({ partnerId, level })` e mostra avanzamento step + risultato (riusa il pannello già esistente in `SherlockCanvas` come componente condiviso, da estrarre in `src/v2/ui/organisms/sherlock/SherlockRunPanel.tsx`).
- Stesso menu va aggiunto anche dentro `PartnerDetailFull` (header) per coerenza con altre pagine che lo riusano (Cockpit, drawer AI).

### 2. Icone livello Deep Search nelle card
- Creare `src/v2/ui/atoms/SherlockLevelBadge.tsx`:
  - Livello 1 → icona `Search` colore muted ("Scout")
  - Livello 2 → icona `ScanSearch` colore primary ("Detective")
  - Livello 3 → icona `Telescope` colore warning ("Sherlock")
  - Tooltip: `Deep Search livello X — completato il <data>`
- Mostrare il badge:
  - `PartnerCard.tsx`, `PartnerListItem.tsx`, `PartnerDetailHeader.tsx`
  - `CompanyCardList` (vista Network) accanto allo score
  - `BusinessCardsViewV2` accanto allo StatusBadge match
  - Drawer contatto (`ContactDrawer` se presente) per `contact_id`

### 3. DAL + hook lettura livello
- Estendere `src/data/sherlockPlaybooks.ts` (o nuovo `src/data/sherlockInvestigations.ts`) con:
  - `getMaxSherlockLevelByPartner(partnerIds: string[]): Map<id, {level, completed_at}>`
  - `getMaxSherlockLevelByContact(contactIds: string[]): Map<id, {level, completed_at}>`
  - Query: `select partner_id, max(level) as level, max(completed_at) as completed_at from sherlock_investigations where status='completed' group by partner_id`
- Hook `useSherlockLevels(ids, scope)` con react-query, key in `queryKeys.v2.sherlockLevels(scope, ids)`.
- Le liste (CompanyCardList, PartnerListItem) chiamano l'hook in batch sui visibili.

### 4. Cleanup coerente
- Il vecchio badge `deep_search_at` (legacy enrichment) resta ma viene **affiancato** (non sostituito) dal nuovo `SherlockLevelBadge`: rappresentano cose diverse (enrichment estensione vs investigazione Sherlock).
- Aggiungere voce in `mem/architecture/sherlock-as-unified-deep-search.md` per documentare che le card mostrano il livello via `sherlock_investigations`.

### 5. QA
- Lanciare Sherlock Scout su un partner → riaprire Network → verificare badge "Scout" sulla card e nel dettaglio.
- Upgrade a Detective sullo stesso partner → badge passa a "Detective" (max).
- Verificare che il dialog si chiuda senza interrompere `useSherlock` se l'utente lo riapre.

### Dettagli tecnici
- File nuovi: `SherlockLevelBadge.tsx`, `SherlockRunPanel.tsx`, `SherlockLauncherDialog.tsx`, `useSherlockLevels.ts`, `data/sherlockInvestigations.ts`.
- File modificati: `PartnerDetailInline.tsx`, `PartnerDetailFull.tsx`, `PartnerCard.tsx`, `PartnerListItem.tsx`, `PartnerDetailHeader.tsx`, `CompanyCardList.tsx`, `BusinessCardsViewV2.tsx`, `lib/queryKeys.ts`.
- Nessuna migrazione DB necessaria: `sherlock_investigations` ha già tutti i campi.
- Rispetta KB: niente nuovi caller a `useDeepSearchLocal`, tutto passa da `useSherlock`.

Confermi di procedere con tutto il piano (singolo + badge livello + lettura DB), oppure vuoi un sottoinsieme (es. solo il tasto sul singolo, badge in fase 2)?