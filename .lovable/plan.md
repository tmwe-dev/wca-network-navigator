
## Diagnosi confermata
Il problema non è nei dati di Transport Management, ma nel criterio sbagliato usato dal Lab.

Ho verificato che:
- in `public.partners`, **Transport Management srl** esiste ed è valorizzato:
  - `profile_description` presente, lunghezza `2343`
  - `raw_profile_html = null`
  - `raw_profile_markdown = null`
- la pagina Network mostra infatti correttamente il blocco **Profilo Aziendale**, che legge `profile_description`
- invece il Lab/Deep Search controlla ancora i campi legacy:
  - `src/hooks/useDeepSearchRunner.ts` blocca la deep search se manca `raw_profile_html`
  - `src/v2/ui/pages/email-forge/tabs/DeepSearchTab.tsx` mostra “Profilo WCA mancante” se mancano `raw_profile_html/raw_profile_markdown`

Quindi l’errore nasce perché:
```text
Network: profilo = profile_description (corretto)
Email Forge / Deep Search: profilo = raw_profile_html/raw_profile_markdown (sbagliato, legacy)
```

## Obiettivo
Allineare Email Forge e Deep Search alla realtà del sistema:
- il profilo sincronizzato valido è `profile_description`
- i campi `raw_profile_*` sono solo fallback legacy
- eliminare ogni riferimento a “Download Center” / “scaricare profili”

## Piano di intervento

### 1) Correggere la sorgente di verità del profilo
Aggiorno il check profilo in modo uniforme:
- `hasProfile = !!(profile_description || raw_profile_html || raw_profile_markdown)`

Questo va applicato in:
- `src/hooks/useDeepSearchRunner.ts`
- `src/v2/ui/pages/email-forge/tabs/DeepSearchTab.tsx`

### 2) Sbloccare la Deep Search sui partner già sincronizzati
Nel runner:
- smetto di considerare “senza profilo” i partner che hanno `profile_description`
- la deep search partirà normalmente per record come Transport Management

### 3) Riscrivere il messaggio UI
Nel tab Deep Search:
- rimuovo il banner che dice di andare al Download Center
- sostituisco il testo con uno stato più corretto, ad esempio:
  - “Profilo sincronizzato disponibile” quando c’è `profile_description`
  - “Profilo testuale assente” solo se mancano sia `profile_description` sia i fallback legacy

### 4) Rimuovere la CTA concettualmente sbagliata
Tolgo:
- testo “Scarica prima i profili dal Download Center”
- bottone “Apri Download Center”
- logica di navigazione a `/v2/settings?tab=download`

Questo è coerente anche con la regola di progetto che vieta di proporre workflow di download WCA.

### 5) Rendere il tab più trasparente
Nel pannello Deep Search mostro chiaramente quali fonti sono presenti:
- `profile_description`
- `raw_profile_html`
- `raw_profile_markdown`
- `enrichment_data`
- timestamp deep search / parsing

Così si capisce subito cosa sta leggendo il sistema, senza falsi negativi.

### 6) Facoltativo ma consigliato: centralizzare il criterio
Per evitare nuove divergenze, estraggo una piccola helper condivisa tipo:
- `hasPartnerProfile(...)`

e la riuso dove oggi esistono check simili, così Network, Lab e future viste non si disallineano più.

## File da toccare
- `src/hooks/useDeepSearchRunner.ts`
- `src/v2/ui/pages/email-forge/tabs/DeepSearchTab.tsx`
- opzionale helper condivisa in un modulo comune profilo/partner

## Risultato atteso
Dopo la modifica:
- Transport Management non verrà più segnalato come “senza profilo WCA”
- la Deep Search non verrà bloccata inutilmente
- il Lab parlerà di **profilo sincronizzato** invece che di download
- il comportamento sarà coerente con ciò che già vedi in Network
