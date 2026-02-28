

## Analisi del Problema

Due bug correlati causano il comportamento osservato:

### Bug 1: Il conteggio UI non corrisponde alla logica del backend
- L'indicatore **"Senza Alias Contatto: 78 mancanti"** conta TUTTI i partner dove nessun contatto ha `contact_alias`
- Ma la edge function `generate-aliases` processa solo contatti che hanno `email || direct_phone || mobile`
- Risultato: molti dei 78 partner hanno contatti senza info di contatto, quindi il backend li salta e restituisce "0 da elaborare"

### Bug 2: La edge function esclude contatti senza email/telefono dalla generazione alias
- Gli alias contatto (cognome) sono utili anche per la visualizzazione UI, non solo per le email
- Escludere i contatti senza email/telefono è troppo restrittivo

## Piano di Implementazione

### 1. Edge function: rimuovere il filtro restrittivo sui contatti (`generate-aliases/index.ts`)

Nella sezione che filtra i partner eligibili (riga ~36), cambiare il criterio per i contatti:
- **Prima**: `!c.contact_alias && (c.email || c.direct_phone || c.mobile)` 
- **Dopo**: `!c.contact_alias` (genera alias per TUTTI i contatti senza alias, indipendentemente dall'avere email/telefono)

Stesso cambiamento nella costruzione del `partnerList` per il batch AI (riga ~55):
- **Prima**: `.filter((c: any) => !c.contact_alias && (c.email || c.direct_phone || c.mobile))`
- **Dopo**: `.filter((c: any) => !c.contact_alias)`

### 2. UI: allineare il conteggio `withAliasCt` (`PartnerListPanel.tsx`)

Il conteggio attuale è già corretto (conta partner con almeno un contatto con alias) - non necessita modifiche dato che sistemiamo il backend.

### File da modificare
- `supabase/functions/generate-aliases/index.ts` — rimuovere filtro `email || phone || mobile` dai contatti

