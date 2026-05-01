## Obiettivo

Adottare il layout dei **Biglietti da visita** (card-azienda + sub-card dei contatti annidati) come standard unico per tutti gli elenchi: **WCA Partner**, **Contatti CRM** e **Biglietti**. Il merge "raggruppa contatti sotto stessa azienda" resta confinato alla pagina dedicata già esistente (deduplicatePartners — Plancia di Comando).

## Diagnosi dello stato attuale

| Pagina | Layout di oggi | Problema |
|---|---|---|
| WCA Partner (`/v2/explore/network`) | Riga sottile per partner. Contatti referenti visibili **solo** nel drawer destro al click. | I contatti sono nascosti: per vedere chi contattare devi aprire il drawer uno per uno. |
| Contatti CRM (`/v2/explore/contacts`) | Tabella piatta densa: # / Azienda / Contatto / Città / Origine / barra-stato. | Stessa azienda appare N volte come righe separate (es. "Sigra elena", "Sig ravelli", "Paola" tutti senza colonna azienda compilata). Caos visivo. |
| Biglietti (`/v2/explore/biglietti`) | Card-azienda grande con badge WCA + sub-card grigliata dei contatti dentro. | Layout corretto, è il modello da estendere. |

Il merge contatti/aziende rimane sulla pagina dedicata già presente nei tool della Plancia (`deduplicatePartners`).

## Cosa costruire

### 1. Componente generico `CompanyCardList`
Estraggo la logica visuale di `BCAUnifiedHub` in un componente riusabile in `src/v2/ui/molecules/CompanyCardList/`:

- **CompanyCard** — header azienda: bandiera + nome + città + badge sorgente (WCA / CRM / BCA) + counter contatti + azioni (⋯, Seleziona).
- **ContactSubCard** — riga interna: nome + ruolo + icone canale (✉️ 💬 📞) + dot stato + counter messaggi.
- **EmptyContactsSlot** — quando l'azienda non ha contatti, mostra "Nessun contatto · Aggiungi".

Contratto dati (interfaccia comune):
```ts
type CompanyEntity = {
  id: string;
  name: string;
  city?: string;
  countryCode?: string;
  source: "wca" | "crm" | "bca";
  badge?: { label: string; tone: "wca" | "neutral" }; // es. "8 anni WCA"
  contacts: ContactEntity[];
  meta?: { wcaYears?: number; status?: "active"|"holding"|"cold" };
};
type ContactEntity = {
  id: string;
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  channels: { email: boolean; whatsapp: boolean; linkedin: boolean };
  unreadCount?: number;
};
```

### 2. Adapter per ciascuna sorgente
Tre piccoli hook in `src/v2/hooks/companyList/` che producono `CompanyEntity[]` partendo dai dati esistenti, senza toccare la DAL:

- `useWcaPartnersAsCompanies()` — raggruppa partner WCA. Ogni partner = una company. Contatti = referenti già caricati nel drawer (lazy-load on-expand per non caricare 12k×N).
- `useCrmContactsAsCompanies()` — raggruppa contatti CRM per `company_name` (fallback dominio email se manca). Aziende senza nome finiscono in gruppo "Senza azienda".
- `useBcaCardsAsCompanies()` — adapter sul grouping BCA esistente (`useBcaGrouping`). Solo wrapper, zero logica nuova.

### 3. Performance per WCA Partner (12k aziende)
- **Card collassate di default**: in lista mostro solo l'header azienda; contatti caricati on-expand.
- **Virtualizzazione** con `react-window` (già nel progetto) sulla lista delle 12k card.
- Skeleton per le sub-card durante il fetch on-demand.

### 4. Sostituzione nelle pagine
- `NetworkPage.tsx` → renderizza `<CompanyCardList source="wca" />` al posto della lista riga-per-riga attuale.
- `ContactsPage.tsx` → renderizza `<CompanyCardList source="crm" />` al posto della tabella densa.
- `BCAUnifiedHub.tsx` → riusa internamente `<CompanyCardList source="bca" />` mantenendo drag-drop, bulk actions, OCR confidence (tutto già attaccato al componente esistente).

### 5. Coerenza con il resto del sistema
- Conservo i filtri esistenti (`GlobalFiltersProvider`, `BcaFiltersProvider`, sidebar paesi).
- Conservo il drawer destro per il dettaglio (apertura on-click su card).
- Conservo le azioni AI esistenti (Cockpit / Deep Search / LinkedIn / Campagna) come kebab menu sulla card.
- Nessuna modifica al merge: rimane su `/v2/command` → tool `deduplicatePartners`.

## Cosa NON fa questo piano
- Non tocca la DAL né lo schema DB.
- Non modifica il merge (resta dov'è).
- Non aggiunge una vista tabella alternativa: la card-azienda è l'unica vista.
- Non altera il drawer destro né i pannelli di dettaglio già esistenti.

## Dettagli tecnici

**File nuovi:**
- `src/v2/ui/molecules/CompanyCardList/CompanyCardList.tsx`
- `src/v2/ui/molecules/CompanyCardList/CompanyCard.tsx`
- `src/v2/ui/molecules/CompanyCardList/ContactSubCard.tsx`
- `src/v2/ui/molecules/CompanyCardList/types.ts`
- `src/v2/hooks/companyList/useWcaPartnersAsCompanies.ts`
- `src/v2/hooks/companyList/useCrmContactsAsCompanies.ts`
- `src/v2/hooks/companyList/useBcaCardsAsCompanies.ts`

**File modificati:**
- `src/v2/ui/pages/NetworkPage.tsx` — sostituzione body lista.
- `src/v2/ui/pages/ContactsPage.tsx` — sostituzione body tabella.
- `src/components/contacts/bca/BCAUnifiedHub.tsx` — refactor per usare `CompanyCardList` internamente (mantiene drag-drop esistente).

**Query keys:** centralizzate in `src/lib/queryKeys.ts` come da rule (`companyList.wca`, `companyList.crm`, `companyList.bca`).

**Vincoli rispettati:**
- DAL-only access (no `supabase.from()` diretti nei nuovi hook).
- No `any` (tipi stretti).
- V2 UI logic-less: gli hook contengono la logica, i componenti sono presentazionali.
- Centralizzazione query keys.

## Risultato atteso

Le tre pagine `/v2/explore/network`, `/v2/explore/contacts` e `/v2/explore/biglietti` mostrano lo stesso identico layout:

```text
┌─────────────────────────────────────────────────┐
│ 🇲🇾 Dahnay Logistics Sdn. Bhd.  [WCA] · 4 con. │  ← CompanyCard header
│ ┌──────────────────┐ ┌──────────────────┐       │
│ │ M. Ram Kumar     │ │ J. Varadarajan   │       │  ← ContactSubCard
│ │ Manager          │ │ Senior Manager   │       │
│ │ ✉ 💬             │ │ ✉ 💬             │       │
│ └──────────────────┘ └──────────────────┘       │
│ ┌──────────────────┐ ┌──────────────────┐       │
│ │ Mohan Raj H      │ │ V. Balaji        │       │
│ └──────────────────┘ └──────────────────┘       │
└─────────────────────────────────────────────────┘
```

Vista identica, dati diversi, performance preservata (collasso + virtualizzazione su WCA).
