

## Piano: Cockpit con dati reali dal database

### Problema
Il Cockpit usa `DEMO_CONTACTS` hardcoded. Nel database ci sono 3 fonti reali di contatti:
- **partner_contacts** (da WCA) — con `partner_id` per risalire ad azienda/paese
- **imported_contacts** (da file import) — con `import_log_id` per risalire al gruppo/file
- **prospect_contacts** (da Report Aziende) — con `prospect_id` per risalire all'azienda

### Soluzione
Creare un hook `useCockpitContacts` che aggrega le 3 fonti in un formato unificato `CockpitContact`, eliminando completamente `DEMO_CONTACTS`.

### Nuovo hook: `src/hooks/useCockpitContacts.ts`

Tre query parallele con React Query:
1. `partner_contacts` JOIN `partners` → origin `"wca"`, originDetail = network name
2. `imported_contacts` JOIN `import_logs` → origin `"import"`, originDetail = file_name o group_name
3. `prospect_contacts` JOIN `prospects` → origin `"report_aziende"`, originDetail = "Report Aziende"

Normalizza ogni record in:
```ts
interface CockpitContact {
  id: string;
  name: string;
  company: string;
  role: string;
  country: string;
  language: string;
  lastContact: string;
  priority: number;
  channels: string[];
  email: string;
  origin: ContactOrigin;
  originDetail: string;
}
```

Canali determinati dalla presenza di email/phone/mobile. Priorità calcolata da completezza dati + recency. Language dedotto dal country_code.

### File da modificare

1. **`src/hooks/useCockpitContacts.ts`** (nuovo) — hook con 3 query aggregate, merge e normalizzazione
2. **`src/pages/Cockpit.tsx`** — rimuovere `DEMO_CONTACTS` e `DEMO_CONTACTS_MAP`, usare il nuovo hook; passare i contatti reali a `ContactStream` e `useSelection`
3. **`src/components/cockpit/ContactStream.tsx`** — ricevere i contatti come prop invece di importare `DEMO_CONTACTS`
4. **`src/components/cockpit/TopCommandBar.tsx`** — nessuna modifica (già riceve contatti come prop)

### Empty state
Quando non ci sono contatti nel database, mostrare un empty state con invito a importare dati o scaricare da WCA.

### Dettagli tecnici
- Le query usano `.limit(500)` per performance
- L'ordinamento priorità: contatti con email+phone > solo email > solo phone > niente
- Mapping country → language: IT→italiano, FR→français, DE→deutsch, ES→español, default→english

