
Problema individuato (perché non riesci a scaricare il singolo profilo Albania):
1. Il pulsante “Scarica Profili (1)” che vedi nel filtro “Senza Email” non avvia il download: apre solo il wizard e imposta `downloadMode="no_profile"`.
2. In Albania i profili mancanti sono 0 nel database (`raw_profile_html` mancante: 0 su 11), quindi lo Step 1 (download profili) viene marcato completato e il bottone reale di download non appare.
3. C’è una discrepanza dati: directory WCA AL ha 12 membri, DB AL ne ha 11 (manca `wca_id=140543`), ma il wizard decide lo step usando `stats.total/withProfile` (solo DB), quindi può nascondere Step 1 anche quando c’è ancora qualcosa da scaricare.
4. Il count “(1)” nel bottone del filtro email indica “1 partner filtrato”, non “1 partner effettivamente scaricabile”.

Piano di correzione (implementazione):
1. In `src/components/operations/PartnerListPanel.tsx`, separare i conteggi:
   - `filteredCount` (UI filtro)
   - `downloadableCount` reale (WCA IDs scaricabili).
2. Correggere la logica di `wizardStep`:
   - Step 1 deve restare attivo se esiste almeno un ID scaricabile (`missingIds` o `noProfileIds` o target filtrato), non solo da `stats.withProfile`.
3. Rendere l’azione del filtro “email/phone/profiles” operativa:
   - click su “Scarica Profili (N)” deve creare direttamente un job con i `wca_id` dei partner filtrati (se presenti), invece di aprire solo il wizard.
4. Aggiornare etichette UI per evitare ambiguità:
   - se è solo apertura wizard: “Apri wizard download”
   - se avvia job: “Scarica profili filtrati (N)”.
5. Aggiungere guardrail:
   - se `filteredPartners` non hanno `wca_id`, mostrare toast chiaro (“Nessun partner filtrato scaricabile”).
6. Verifica finale:
   - Albania + filtro “Senza Email”: click deve avviare davvero il job del singolo partner.
   - Albania senza filtro: Step 1 visibile quando c’è differenza directory vs DB.
   - conferma che la query `download_jobs` riceva insert al click.

Dettagli tecnici (sintesi):
- File coinvolto: `src/components/operations/PartnerListPanel.tsx`.
- Punto critico attuale:
  - `FilterActionBar.email/phone -> onDownload` non avvia job.
  - `wizardStep` dipende da `stats.total - stats.withProfile` (DB-only), non dalla differenza directory↔DB.
- Correzione chiave:
  - introdurre una sorgente unica “downloadability” per step gating + CTA action.
