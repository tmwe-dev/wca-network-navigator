

# Piano: Alias Azienda e Contatto con Generazione AI

## Cosa sono gli alias

Quando scrivi un'email a un cliente, non usi mai il nome completo formale. Scrivi "Buongiorno signor Rossini" e non "Buongiorno signor Filippo Rossini". Scrivi "Procter & Gamble" e non "Procter & Gamble SPA". Gli alias sono versioni naturali e colloquiali dei nomi, come li userebbe una persona reale in una comunicazione.

## Cosa viene creato

### 1. Due nuove colonne nel database

**Tabella `partners`**: nuova colonna `company_alias` (text, nullable)
- Esempio: "Approved Holdings, LLC., dba Approved" --> "Approved Holdings"
- Esempio: "World Transport Overseas d.o.o. Sarajevo" --> "World Transport"

**Tabella `partner_contacts`**: nuova colonna `contact_alias` (text, nullable)
- Esempio: "Mr. Christian Halpaus" --> "Halpaus" oppure "Christian"
- Esempio: "Ms. Kourtney Ragsdale" --> "Ragsdale"
- Esempio: "President" (senza nome reale) --> resta vuoto

### 2. Edge Function `generate-aliases`

Una nuova funzione backend che:
- Riceve un elenco di country codes
- Carica tutti i partner di quei paesi che hanno almeno un contatto con email o telefono
- Lavora in batch (es. 20 partner alla volta) per efficienza
- Invia al modello AI un prompt che dice: "Per ogni azienda e contatto, genera un alias naturale come lo userebbe un italiano in un'email professionale"
- Salva i risultati nelle nuove colonne
- Salta i partner che hanno gia' un alias (non sovrascrive)

Il prompt AI sara' strutturato per restituire output via tool calling (JSON strutturato), cosi' da evitare errori di parsing.

Modello usato: `google/gemini-2.5-flash` (veloce, economico, piu' che sufficiente per questo compito semplice).

### 3. Pulsante nell'Operations Center

Nella Country Grid, ogni card paese avra' un piccolo indicatore che mostra quanti partner hanno gia' l'alias generato. Nella tab "Partner" (pannello destro), verra' aggiunto un pulsante **"Genera Alias"** nella toolbar in alto, che lancia la generazione per i paesi selezionati.

Il pulsante:
- Mostra un contatore del progresso ("12/45 alias generati...")
- Disabilita le interazioni durante l'elaborazione
- Al termine mostra un toast con il riepilogo

---

## Dettaglio tecnico

### Migrazione database

```text
ALTER TABLE partners ADD COLUMN company_alias text;
ALTER TABLE partner_contacts ADD COLUMN contact_alias text;
```

### Edge Function `generate-aliases`

Riceve: `{ countryCodes: string[] }`

Logica:
1. Carica partner dei paesi indicati con i loro contatti (solo quelli con email o telefono)
2. Filtra quelli senza alias
3. Raggruppa in batch da 20
4. Per ogni batch, chiama l'AI con tool calling:

```text
Tool: generate_aliases
Parametri:
  aliases: array di oggetti:
    - partner_id: string
    - company_alias: string (nome azienda abbreviato, naturale)
    - contacts: array di:
      - contact_id: string
      - contact_alias: string (cognome o nome, come lo direbbe un italiano)
```

5. Salva i risultati nel DB

### File da creare

- `supabase/functions/generate-aliases/index.ts`
- Migrazione SQL per le due colonne

### File da modificare

- `src/components/operations/PartnerListPanel.tsx` -- aggiungere pulsante "Genera Alias" nella toolbar
- `src/pages/Operations.tsx` -- nessuna modifica necessaria (il pulsante e' dentro PartnerListPanel)
- `supabase/config.toml` -- aggiungere configurazione per la nuova funzione

### Flusso utente

```text
Operations Center
  |-- Seleziona uno o piu' paesi
  |-- Tab "Partner"
  |-- Click "Genera Alias" nella toolbar
  |-- Progresso visibile (toast o barra)
  |-- Alias salvati nel DB
  |-- Lista partner si aggiorna mostrando gli alias
```

### Dove appaiono gli alias

Una volta generati, gli alias saranno disponibili come campi nelle tabelle e potranno essere usati:
- Nella pagina Campaign Jobs, per personalizzare le email
- Nel composer email (futuro), come variabili dinamiche
- Ovunque serva il nome "naturale" del partner o contatto

