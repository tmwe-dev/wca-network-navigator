
# Nuova Tab "Profilo AI" nelle Impostazioni

## Obiettivo

Creare una sezione nelle impostazioni dove l'utente inserisce le informazioni che l'AI utilizzera per generare comunicazioni personalizzate: profilo aziendale, stile comunicativo, alias e knowledge base.

## Struttura della Tab

La nuova tab "Profilo AI" conterra 4 sezioni (card):

### 1. Identita e Alias
- **Nome azienda** (text input) - il nome completo
- **Alias aziendale** (text input) - la firma/brand da usare nelle comunicazioni (obbligatorio)
- **Nome referente** (text input) - chi firma le email
- **Alias referente** (text input) - come vuole essere chiamato
- **Ruolo** (text input) - es. "Business Development Manager"
- **Email firma** e **Telefono firma** - per la signature nelle email

### 2. Knowledge Base Aziendale
Un'area di testo grande dove l'utente descrive liberamente:
- Cosa fa l'azienda (servizi, specializzazioni)
- Zone geografiche coperte
- Punti di forza, certificazioni, flotta
- Anni di esperienza, numeri chiave
- Qualsiasi informazione che l'AI deve conoscere per scrivere proposte credibili

### 3. Stile di Comunicazione
- **Tono** (select): Formale / Professionale / Amichevole / Diretto
- **Lingua preferita** (select): Italiano / Inglese / Entrambe
- **Istruzioni aggiuntive** (textarea): regole specifiche es. "Usa sempre Lei", "Includi sempre riferimento ai network WCA", "Non citare mai i prezzi nella prima email"

### 4. Contesto Settoriale
- **Settore principale** (select): Freight Forwarding / Logistica / Trasporti / Spedizioni / Altro
- **Network di appartenenza** (multi-input o textarea): WCA, altri network
- **Note aggiuntive** (textarea): info extra sul mercato, posizionamento

## Implementazione Tecnica

### Storage
Tutti i dati vengono salvati nella tabella `app_settings` gia esistente, usando chiavi specifiche:
- `ai_company_name`, `ai_company_alias`, `ai_contact_name`, `ai_contact_alias`, `ai_contact_role`, `ai_email_signature`, `ai_phone_signature`
- `ai_knowledge_base` (testo lungo)
- `ai_tone`, `ai_language`, `ai_style_instructions`
- `ai_sector`, `ai_networks`, `ai_sector_notes`

Non servono nuove tabelle o migrazioni.

### File da creare
**`src/components/settings/AIProfileSettings.tsx`** - Componente dedicato per la tab, con le 4 card. Usa `useAppSettings` e `useUpdateSetting` esistenti. Un singolo pulsante "Salva tutto" in fondo che salva tutte le chiavi in batch.

### File da modificare
**`src/pages/Settings.tsx`** - Aggiungere:
- Import del nuovo componente
- Una nuova `TabsTrigger` con icona `Brain` (da lucide-react) e label "Profilo AI"
- Il corrispondente `TabsContent` che renderizza `<AIProfileSettings />`

### Struttura del componente

```text
AIProfileSettings
  props: settings (from useAppSettings), updateSetting (from useUpdateSetting)
  
  state locale per ogni campo (inizializzato da settings)
  
  Card 1: Identita e Alias
    - 6 input fields in grid 2 colonne
    
  Card 2: Knowledge Base
    - Textarea grande (min 200px height)
    - Hint: "Descrivi la tua azienda..."
    
  Card 3: Stile Comunicazione
    - Select tono (4 opzioni)
    - Select lingua (3 opzioni)  
    - Textarea istruzioni
    
  Card 4: Contesto Settoriale
    - Select settore
    - Input network
    - Textarea note
    
  Button "Salva Profilo AI" → salva tutte le chiavi in sequenza
```

Questo profilo sara poi utilizzato dall'AI (edge functions come `ai-assistant`, `deep-search-partner`, o future funzioni di generazione email) per personalizzare ogni comunicazione in base al destinatario.
