

## Piano: Nuova tab "Contenuti" nelle Impostazioni

### Obiettivo
Creare una sezione centralizzata nelle Impostazioni per gestire tutti i contenuti utilizzati nelle comunicazioni: goal, proposte, documenti e link di riferimento. Attualmente questi dati vivono solo nei preset del Workspace (`workspace_presets`) e nei documenti (`workspace_documents`), ma non esiste un punto unico per esplorarli e gestirli.

### Modifiche

#### 1. Nuovo componente `src/components/settings/ContentManager.tsx`
Componente con 4 sotto-sezioni (accordion o tabs interni):

**A) Goal e Proposte** — Lista di tutti i preset salvati (`useWorkspacePresets`):
- Mostra nome, goal e proposta di ogni preset in card espandibili
- Permette di modificare goal/proposta inline e salvare
- Permette di aggiungere un nuovo preset direttamente da qui
- Permette di eliminare preset

**B) Documenti** — Lista di tutti i documenti caricati (`useWorkspaceDocuments` + query diretta su `workspace_documents`):
- Mostra nome file, dimensione, data di caricamento
- Permette upload di nuovi documenti
- Permette eliminazione
- Link per scaricare/visualizzare il file

**C) Link di riferimento** — Aggregazione dei link da tutti i preset:
- Mostra tutti i link unici con favicon e hostname
- Permette di aggiungere/rimuovere link dal preset attivo

#### 2. `src/pages/Settings.tsx`
- Importare `ContentManager`
- Aggiungere tab "Contenuti" con icona `BookOpen` tra "Template" e "Profilo AI"
- Aggiungere `<TabsContent value="contenuti">` con il componente

#### 3. Query documenti completa
Il `useWorkspaceDocuments` attuale tiene i documenti solo in state locale. Il `ContentManager` fara una query diretta a `workspace_documents` per caricare tutti i documenti salvati nel database, non solo quelli della sessione corrente.

### File da creare/modificare
1. **Creare** `src/components/settings/ContentManager.tsx` — componente principale
2. **Modificare** `src/pages/Settings.tsx` — aggiungere tab + import

