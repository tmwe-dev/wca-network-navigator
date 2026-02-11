

# Archivio Partner Senza Contatti

## Obiettivo

Quando un partner viene scaricato ma risulta senza contatti personali (email/telefono), il sistema lo archivia automaticamente in una tabella dedicata. Questo crea un registro consultabile di tutti i partner "vuoti" che potranno essere rivisitati in futuro (ad esempio quando la sessione e' piu' stabile o i dati vengono aggiornati su WCA).

## Come funziona

1. Durante l'acquisizione, se un partner non ha contatti, viene salvato in una nuova tabella `partners_no_contacts`
2. Nella pagina Acquisizione Partner appare una sezione/tab "Archivio Senza Contatti" per consultare l'elenco
3. Dall'archivio si puo' selezionare uno o piu' partner e avviare un retry mirato

## Modifiche

### 1. Nuova tabella `partners_no_contacts`

Creazione via migrazione SQL:

| Colonna | Tipo | Descrizione |
|---------|------|-------------|
| id | uuid (PK) | ID univoco |
| wca_id | integer | ID WCA del partner |
| partner_id | uuid | Riferimento al partner nel DB (se esiste) |
| company_name | text | Nome azienda |
| country_code | text | Codice paese |
| city | text | Citta' |
| networks | jsonb | Network di appartenenza al momento dello scraping |
| scraped_at | timestamptz | Quando e' stato scaricato |
| retry_count | integer | Quante volte e' stato ritentato (default 0) |
| last_retry_at | timestamptz | Ultimo tentativo di retry |
| resolved | boolean | Se il partner e' stato risolto (contatti trovati al retry) |
| created_at | timestamptz | Data creazione |

RLS: accesso pubblico (come le altre tabelle del progetto).

### 2. Salvataggio automatico nel loop di acquisizione

**File**: `src/pages/AcquisizionePartner.tsx`

Dopo la riga che rileva `!hasAnyContact` (riga 355), aggiungere un upsert nella tabella `partners_no_contacts`:

```text
if (!hasAnyContact && partnerId) {
  await supabase.from("partners_no_contacts").upsert({
    wca_id: item.wca_id,
    partner_id: partnerId,
    company_name: canvas.company_name,
    country_code: canvas.country_code,
    city: canvas.city,
    networks: canvas.networks,
    scraped_at: new Date().toISOString(),
  }, { onConflict: "wca_id" });
}
```

### 3. Componente Archivio

**Nuovo file**: `src/components/acquisition/NoContactsArchive.tsx`

Un pannello che mostra:
- Lista dei partner senza contatti con flag paese, nome, citta', data di scraping
- Contatore totale e per paese
- Pulsante "Riprova selezionati" per rimetterli in coda di acquisizione
- Badge "Ritentato X volte" per chi e' gia' stato riprovato
- Filtro per paese e per data

### 4. Integrazione nella pagina Acquisizione

**File**: `src/pages/AcquisizionePartner.tsx`

Aggiungere un pulsante/tab "Archivio Vuoti" accanto al Bin dei partner acquisiti. Cliccandolo si apre il pannello archivio. Un badge numerico mostra quanti partner senza contatti ci sono in totale.

### 5. Retry dall'archivio

Quando l'utente seleziona partner dall'archivio e preme "Riprova":
- I partner selezionati vengono aggiunti alla coda (`queue`) come item pending
- Il campo `retry_count` viene incrementato
- Se al retry i contatti vengono trovati, il record viene marcato `resolved = true`

## File modificati

| File | Modifica |
|------|----------|
| Migrazione SQL | Nuova tabella `partners_no_contacts` |
| `src/pages/AcquisizionePartner.tsx` | Upsert nel loop quando partner e' senza contatti, pulsante archivio, logica retry |
| `src/components/acquisition/NoContactsArchive.tsx` | Nuovo componente per visualizzare e gestire l'archivio |

