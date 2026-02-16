

# Rifattorizzazione Partner Hub

## Obiettivo

Spezzare il monolite `PartnerHub.tsx` (1337 righe) e eliminare la duplicazione con `PartnerListPanel.tsx` (541 righe) estraendo componenti e utilita' condivise.

## Struttura Finale dei File

```text
src/
  lib/
    partnerUtils.ts              (NUOVO - utilita' condivise)
  components/
    partners/
      shared/
        ServiceIcons.ts          (NUOVO - SERVICE_ICONS, getServiceIcon, TRANSPORT_SERVICES, SPECIALTY_SERVICES)
        NetworkLogos.ts          (NUOVO - NETWORK_LOGOS, getNetworkLogo)
        MiniStars.tsx            (NUOVO - componente stelle)
        TrophyRow.tsx            (NUOVO - componente trofeo anni)
        CardSocialIcons.tsx      (NUOVO - icone social inline)
        PartnerSorting.ts        (NUOVO - sortPartners, SortOption, getBranchCountries)
      PartnerDetailFull.tsx      (NUOVO - dettaglio dal PartnerHub, layout a 2 colonne)
      PartnerDetailCompact.tsx   (NUOVO - dettaglio dal PartnerListPanel, layout compatto con isDark)
      PartnerListItem.tsx        (NUOVO - singola riga partner nella lista)
      ...file esistenti invariati
  pages/
    PartnerHub.tsx               (RIDOTTO - solo layout + stato + composizione)
  components/
    operations/
      PartnerListPanel.tsx       (RIDOTTO - importa da shared, usa PartnerDetailCompact)
```

## Dettaglio Cambiamenti

### 1. Creare `src/components/partners/shared/ServiceIcons.ts`

Estrarre da entrambi i file:
- `SERVICE_ICONS` (mappa categoria -> componente Lucide)
- `PARTNER_TYPE_ICONS` (solo da Hub)
- `getServiceIcon(category)` 
- `TRANSPORT_SERVICES` e `SPECIALTY_SERVICES` (costanti array)

### 2. Creare `src/components/partners/shared/NetworkLogos.ts`

Estrarre da PartnerHub:
- `NETWORK_LOGOS` (mappa nome -> path logo)
- `getNetworkLogo(name)` (funzione di lookup fuzzy)

### 3. Creare `src/components/partners/shared/MiniStars.tsx`

Componente con prop `rating` e `size` opzionale (default `"w-3 h-3"`). Unifica le due versioni: quella di Hub (con prop `size`) e quella di PartnerListPanel (size fisso).

### 4. Creare `src/components/partners/shared/TrophyRow.tsx`

Componente semplice `TrophyRow({ years })` — esiste solo in Hub ma serve tenerlo separato per riusabilita'.

### 5. Creare `src/components/partners/shared/CardSocialIcons.tsx`

Spostare `CardSocialIcons` da PartnerHub. Questo componente fa una query DB per ogni partner visibile (problema N+1 noto, verra' marcato con un TODO per ottimizzazione futura).

### 6. Creare `src/lib/partnerUtils.ts`

Funzioni pure condivise:
- `getBranchCountries(partner)` — duplicata identica in entrambi i file
- `sortPartners(partners, sortBy)` — attualmente solo in Hub, ma utile ovunque
- Type `SortOption`

### 7. Creare `src/components/partners/PartnerDetailFull.tsx`

Estrarre la funzione `PartnerDetail` da PartnerHub (righe 739-1337, ~600 righe). Questo e' il dettaglio ricco con:
- Layout a 2 colonne
- Network logos
- KPI grid
- Timeline e Reminders
- Mini Globe
- Mercati e routing con bandiere

Props: `{ partner, onToggleFavorite }`

### 8. Creare `src/components/partners/PartnerDetailCompact.tsx`

Estrarre la funzione `PartnerDetail` da PartnerListPanel (righe 348-531, ~180 righe). Questo e' il dettaglio compatto per Operations con:
- Pulsante "back"
- Supporto `isDark` / tema
- Layout a singola colonna

Props: `{ partner, onBack, onToggleFavorite, isDark }`

### 9. Ridurre `PartnerHub.tsx`

Il file rimane con:
- Stato del componente (search, filters, selectedId, viewMode, etc.)
- Logica filtri client-side
- Layout `ResizablePanelGroup`
- Lista partner (potrebbe diventare un componente separato in futuro, ma per ora resta inline per non frammentare troppo)
- Importa `PartnerDetailFull` per il pannello destro

Stima: da 1337 righe a circa 500-600 righe.

### 10. Ridurre `PartnerListPanel.tsx`

Rimuovere:
- `SERVICE_ICONS`, `getServiceIcon`, `MiniStars`, `TRANSPORT_SERVICES`, `getBranchCountries` — sostituiti con import da shared
- `PartnerDetail` inline — sostituito con import di `PartnerDetailCompact`

Stima: da 541 righe a circa 250-300 righe.

## Ordine di Esecuzione

1. Creare tutti i file shared (ServiceIcons, NetworkLogos, MiniStars, TrophyRow, CardSocialIcons, partnerUtils) — nessuna dipendenza tra loro
2. Creare PartnerDetailFull e PartnerDetailCompact — dipendono dai file shared
3. Aggiornare PartnerHub.tsx — rimuovere codice estratto, aggiungere import
4. Aggiornare PartnerListPanel.tsx — rimuovere codice estratto, aggiungere import

## Rischi e Mitigazioni

- **Nessuna modifica funzionale**: il refactoring e' puramente strutturale, non cambia comportamenti o stili
- **PartnerDetailFull vs Compact divergono intenzionalmente**: non vengono unificati perche' servono contesti diversi (Hub ha layout ricco, Operations ha layout compatto con tema scuro)
- **CardSocialIcons N+1**: viene marcato con `// TODO: batch fetch` ma non risolto in questo refactoring per limitare lo scope

