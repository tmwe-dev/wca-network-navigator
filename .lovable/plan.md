
# Correzione Download: bug multi-paese e chiarezza UX

## Problemi identificati

### 1. Bug critico in Fase 2 (Phase2Config, righe 1362-1370)
Quando selezioni piu paesi, il sistema crea un job per ogni paese ma assegna a TUTTI i job la lista completa degli ID scoperti, invece di filtrare gli ID per paese. Risultato: lavoro duplicato e mapping errato.

**Prima (bug):**
- Paese IT -> riceve gli ID di IT + DE + FR
- Paese DE -> riceve gli ID di IT + DE + FR  
- Paese FR -> riceve gli ID di IT + DE + FR

**Dopo (corretto):**
- Paese IT -> riceve solo gli ID di IT
- Paese DE -> riceve solo gli ID di DE
- Paese FR -> riceve solo gli ID di FR

### 2. La Fase 1 "salta" davanti agli occhi
La scansione directory (Fase 1) esegue chiamate API sequenziali dal browser, aggiornando la lista in tempo reale. Con molti paesi selezionati, questo genera centinaia di richieste visibili. Non e un errore: e il design attuale. Tuttavia, manca una comunicazione chiara all'utente su cosa stia accadendo.

## Modifiche previste

### File: `src/pages/DownloadManagement.tsx`

| Modifica | Dettaglio |
|----------|-----------|
| **Fix bug Fase 2** | Nel `handleStart` di `Phase2Config`, raggruppare gli ID per `country_code` usando i dati dei `members` prima di creare i job. Ogni job ricevera solo gli ID del suo paese. |
| **Messaggio UX Fase 1** | Aggiungere un messaggio informativo visibile durante la scansione che spieghi: "Sto scaricando gli elenchi dai server WCA. Questo processo avviene nel browser. Al termine, il download dei profili avverra in background." |
| **Contatore paesi** | Mostrare chiaramente quale paese sta scansionando (es. "Paese 3/15: Italia") per dare contesto al progresso. |

### Dettaglio tecnico del fix Fase 2

Nella funzione `handleStart` di `Phase2Config` (riga 1357), il codice attuale:

```text
for (const country of countries) {
  await createJob.mutateAsync({
    ...
    wca_ids: idsToDownload,  // BUG: tutti gli ID per ogni paese
  });
}
```

Verra sostituito con:

```text
// Raggruppa gli ID per paese usando i dati dei members
const idsByCountry = new Map<string, number[]>();
for (const m of members) {
  if (!m.wca_id) continue;
  // Trova il country_code dal membro
  const cc = countries.find(c => c.name === m.country || c.code === m.country)?.code;
  if (!cc) continue;
  if (!idsByCountry.has(cc)) idsByCountry.set(cc, []);
  idsByCountry.get(cc)!.push(m.wca_id);
}

for (const country of countries) {
  const countryIds = idsByCountry.get(country.code) || [];
  const filteredIds = includeExisting
    ? countryIds
    : countryIds.filter(id => !existingSet.has(id));
  if (filteredIds.length === 0) continue;
  await createJob.mutateAsync({
    ...
    wca_ids: filteredIds,
  });
}
```

### Messaggio informativo durante Fase 1

Nel componente `DirectoryScanner`, aggiungere sopra la lista dei risultati un banner informativo:

```text
"Scansione directory WCA in corso dal browser.
Paese [X] di [Y]: [NomePaese]
Al termine, potrai avviare il download dei profili che proseguira in background."
```
