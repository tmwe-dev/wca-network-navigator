

# Fix ordinamento Network + verifica pulsante Sincronizza WCA

## Problemi trovati

### 1. Ordinamento non funziona correttamente
Il dropdown "Ordine: Nome/Rating/Contatti" cambia il valore di `networkSort` nel contesto, ma ci sono due problemi:

- **Server-side**: `usePartnersPaginated.ts` (riga 85) fa SEMPRE `.order("company_name")` ignorando il sort selezionato. Quindi quando carichi pagina 2, 3 ecc. i dati arrivano sempre ordinati per nome.
- **"Contatti"**: il sort client-side (riga 126-131) accede a `partner_contacts` che NON viene caricato nella query paginata (nessun join). Quindi `getPartnerContactQuality` riceve `undefined` e il sort non fa nulla.
- **"Rating"**: funziona solo client-side sulla pagina corrente, ma i dati dal server arrivano per nome — risultato inconsistente con infinite scroll.

### 2. Pulsante "Sincronizza WCA" in alto a destra
Il pulsante emette un evento `sync-wca-trigger`. Il listener per questo evento è registrato SOLO in `src/pages/Operations.tsx`. Se l'utente è sulla pagina `/network` (o qualsiasi altra pagina diversa da Operations), **nessuno ascolta l'evento** e non succede nulla.

Il sync usa la edge function `sync-wca-partners` che è il sistema SSE corretto (non vecchie query). È sicuro.

## Piano di intervento

### A. Fix ordinamento — push sort al server
**File: `src/hooks/usePartnersPaginated.ts`**
- Accettare un parametro `sort` nei filtri
- Mappare il sort nella query Supabase:
  - `"name"` → `.order("company_name")`
  - `"rating"` → `.order("rating", { ascending: false }).order("company_name")`
  - `"contacts"` → rimuovere questa opzione (i contatti non sono nella query) oppure sostituirla con un sort più utile come `"country"` o `"recent"` (per `member_since`)

**File: `src/components/operations/PartnerListPanel.tsx`**
- Passare `activeSort` ai filtri di `usePartnersPaginated`
- Rimuovere il sort client-side nel `filteredPartners` useMemo (righe 121-134) — il server lo fa già
- Aggiornare le opzioni del dropdown: sostituire "Contatti" con "Più recenti" (ordina per `member_since DESC`)

### B. Fix Sincronizza WCA — listener globale
**File: `src/components/layout/AppLayout.tsx`** (o nuovo hook globale)
- Spostare il listener `sync-wca-trigger` dall'Operations page a un livello globale (AppLayout) così funziona da qualsiasi pagina
- Copiare la logica del handler SSE da Operations.tsx in un hook riutilizzabile `useWcaSync` e usarlo sia in AppLayout che in Operations

### File coinvolti

| File | Intervento |
|------|-----------|
| `src/hooks/usePartnersPaginated.ts` | Aggiungere parametro `sort`, mappare in `.order()` |
| `src/components/operations/PartnerListPanel.tsx` | Passare sort al hook, rimuovere sort client-side, fix opzioni dropdown |
| `src/hooks/useWcaSync.ts` | Nuovo hook: logica sync SSE estratta da Operations |
| `src/components/layout/AppLayout.tsx` | Registrare listener `sync-wca-trigger` globale via hook |
| `src/pages/Operations.tsx` | Usare il nuovo hook al posto della logica inline |

