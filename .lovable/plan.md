

## Risultato dell'analisi riga per riga

### Cosa mostrano i log diagnostici (che ora funzionano)

Il job piu recente (74806099) mostra esattamente cosa succede per OGNI profilo:

```text
#146530 | html=19917 | name="Member not found. Please try again." | contacts=0 | loaded=true
#105053 | html=19917 | name="Member not found. Please try again." | contacts=0 | loaded=true  ← B2C Logistics
#115374 | html=19917 | name="Member not found. Please try again." | contacts=0 | loaded=true
#67309  | html=19917 | name="Member not found. Please try again." | contacts=0 | loaded=true  ← Groupair
#137781 | html=19917 | name="Member not found. Please try again." | contacts=0 | loaded=true  ← JETAM
...tutti i 21 profili: stessa pagina identica (19917 caratteri), stesso errore.
```

### Causa reale: NON e un bug del codice

Ho verificato direttamente su WCA (server-side, senza estensione):

- `https://www.wcaworld.com/directory/members/105053` (B2C Logistics) → **"Member not found. Please try again."**
- `https://www.wcaworld.com/directory/members/67309` (Groupair) → **"Member not found. Please try again."**
- `https://www.wcaworld.com/directory/members/137781` (JETAM) → **"Member not found. Please try again."**

Questi 21 profili **non esistono piu su WCA**. Le membership sono scadute o sono stati rimossi dal sito dopo la scansione della directory. La directory cache e stale (vecchia).

Il codice funziona correttamente: rileva "Member not found", verifica la sessione (che e attiva), conferma che sono genuinamente inesistenti, e li salta.

### Cosa va fatto

Il problema non e nel processore di download (che funziona). Il problema e nella **directory cache** che contiene WCA ID obsoleti. Servono due interventi:

**1. Re-scrape della directory per il Sud Africa**
- Rilanciare la scansione della directory WCA per `country_code = 'ZA'` per ottenere la lista aggiornata dei membri attivi
- Questo eliminera i 21 ID scaduti e potrebbe trovare nuovi membri

**2. Filtrare i WCA ID gia marcati come inesistenti**
- In `useDownloadProcessor.ts`, quando si crea un job di download, escludere i WCA ID presenti nella tabella `partners_no_contacts` (gia marcati come "non esiste su WCA")
- In `useDownloadJobs.ts` o nel punto dove si crea il job, filtrare questi ID prima di inserirli nel campo `wca_ids`

### File da modificare

1. **`src/hooks/useDownloadJobs.ts`** — Filtrare i WCA ID presenti in `partners_no_contacts` prima di creare un nuovo download job, cosi i profili gia confermati come inesistenti non vengono ritentati
2. **Eventuale UI** — Mostrare all'utente nella pagina operazioni quanti profili sono stati rimossi da WCA (es. "21 profili non piu presenti su WCA") per trasparenza

