

# Miglioramenti alla Selezione Paesi e Fase "Solo ID"

## Cosa cambia

### 1. Paesi: informazioni dettagliate e ordinamento

Nella griglia di selezione paesi (Step 1), ogni card mostrera:
- **Flag + nome** (come ora)
- **Numero di partner nel DB** (es. "7 partner")  
- **Numero di ID nella cache** (es. "11 nella directory")
- **Stato completamento**: badge "Completo" se tutti gli ID della directory sono stati scaricati, oppure "7/11" se parziale
- **Filtro "Ordinamento"**: un selettore in alto che permette di ordinare per:
  - Nome paese (A-Z)
  - Numero partner scaricati (decrescente)
  - Paesi mai esplorati prima

Per fare questo, la query `explored-countries` verra ampliata per restituire anche il conteggio dei partner per paese e i dati dalla `directory_cache`.

### 2. Anche i paesi gia esplorati selezionabili facilmente

Un filtro aggiuntivo "Gia esplorati" (oltre al "Mai esplorati" esistente) che mostra solo i paesi con dati nel DB, utile per andare a completare download parziali o aggiornare.

### 3. Nuova azione: "Salva solo ID"

Nella **Fase 1 (DirectoryScanner)**, dopo la scansione della directory (o usando i dati dalla cache), apparira un nuovo pulsante:

**"Salva solo lista ID"** -- questo:
- Salva i risultati nella `directory_cache` (gia avviene)
- NON avvia la Fase 2 di download profili
- Mostra un messaggio di conferma: "Salvati X ID per [Paese]. Potrai scaricare i profili completi in futuro."
- Torna alla schermata iniziale

Questo permette di "preparare il terreno" per molti paesi senza consumare crediti Firecrawl, raccogliendo solo la lista degli ID dalla directory WCA.

### 4. Nella Fase 2, riconoscere i paesi con ID pre-salvati

Quando si seleziona un paese che ha gia gli ID nella `directory_cache` ma nessun partner scaricato, il sistema saltera automaticamente la Fase 1 e proporra direttamente la Fase 2 con gli ID pronti.

---

## Dettagli Tecnici

### File modificato: `src/pages/DownloadManagement.tsx`

**PickCountry** (linee ~347-476):
- Ampliare la query `explored-countries` per fare un `GROUP BY country_code` con `COUNT(*)` sulla tabella `partners`
- Aggiungere una query per `directory_cache` per sapere quanti ID sono nella cache per paese
- Aggiungere un `Select` per l'ordinamento (nome, n. partner, stato)
- Mostrare contatori su ogni card paese
- Aggiungere filtro "Gia esplorati"

**DirectoryScanner** (linee ~518-1063):
- Aggiungere pulsante **"Salva solo lista ID"** accanto a "Scarica X mancanti"
- Il pulsante salva nella cache (gia implementato) e mostra un toast di conferma
- Aggiungere callback `onSaveIdsOnly` che riporta al wizard step iniziale

**DownloadWizard** (linee ~260-343):
- Aggiungere prop e logica per gestire il ritorno allo step "choose" dopo il salvataggio ID
- Se un paese ha gia gli ID in cache, mostrare opzione per saltare la Fase 1

### Nessuna modifica al database
La tabella `directory_cache` contiene gia tutto il necessario (`members` JSONB con gli ID).

