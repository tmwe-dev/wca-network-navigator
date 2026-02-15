

# Estrazione COMPLETA del profilo WCA

## Problema

La funzione `extractContactsFromPage()` in `background.js` estrae SOLO i contatti (nome, email, telefono). Ignora completamente:
- Profilo aziendale (descrizione, indirizzo, sito web)
- Telefono/fax/mobile aziendali
- Network di appartenenza e date di scadenza
- Servizi offerti e certificazioni
- Tipo di ufficio (Head Office / Branch)
- Sedi secondarie (branches)
- HTML grezzo della pagina (necessario per il parsing AI successivo)

Questo significa che i partner nel database hanno solo `company_name` e `city`, senza nessun dato utile per il riassunto AI, il rating, o la ricerca avanzata.

## Soluzione

### 1. `public/chrome-extension/background.js` -- Riscrivere `extractContactsFromPage()`

La funzione deve estrarre TUTTO il contenuto della pagina WCA. La struttura della pagina WCA usa coppie `profile_label` / `profile_val` per tutti i campi. La funzione deve:

- Scansionare TUTTE le coppie label/value nella pagina (non solo quelle dentro `contactperson_row`)
- Estrarre i campi aziendali: Address, Phone, Fax, Mobile, Emergency Phone, Email, Website, Member Since, Membership Expires, Office Type
- Estrarre la descrizione/profilo (il blocco di testo libero)
- Estrarre i network di appartenenza (lista di network con relative date)
- Estrarre i servizi offerti (lista di tag/categorie)
- Estrarre le certificazioni (IATA, ISO, ecc.)
- Estrarre le branch cities se presenti
- Catturare l'HTML grezzo dell'intera pagina (`document.body.innerHTML`)
- Continuare a estrarre i contatti come fa adesso

Il risultato restituito diventa:

```text
{
  wcaId: number,
  companyName: string,
  contacts: [...],           // come adesso
  profileHtml: string,       // HTML grezzo completo
  profile: {
    address: string,
    phone: string,
    fax: string,
    mobile: string,
    emergencyPhone: string,
    email: string,
    website: string,
    memberSince: string,
    membershipExpires: string,
    officeType: string,
    description: string,
    networks: [{ name, id, expires }],
    services: string[],
    certifications: string[],
    branchCities: string[]
  }
}
```

### 2. `public/chrome-extension/background.js` -- Aggiornare `sendContactsToServer()`

Il payload inviato a `save-wca-contacts` deve includere anche i dati del profilo, non solo i contatti.

### 3. `supabase/functions/save-wca-contacts/index.ts` -- Salvare il profilo

Dopo aver salvato i contatti, la funzione deve aggiornare la tabella `partners` con tutti i campi del profilo:
- `phone`, `fax`, `mobile`, `emergency_phone`, `email`, `website`
- `address`, `profile_description`
- `membership_expires`, `member_since`
- `office_type`
- `has_branches`, `branch_cities`
- `raw_profile_html`

E inserire/aggiornare le tabelle correlate:
- `partner_networks` (upsert per network_name)
- `partner_services` (upsert per service_category, se il valore matcha l'enum)
- `partner_certifications` (upsert per certification, se il valore matcha l'enum)

### 4. `src/hooks/useDownloadProcessor.ts` -- Passare il profilo al processore

Il `processJob` gia' riceve il risultato di `extractContacts`. Dopo aver gestito i contatti, deve anche:
- Aggiornare il partner con `profile_description`, `address`, `website`, `phone`, `fax`, `raw_profile_html`
- Aggiornare le date `membership_expires`, `member_since`
- Inserire i network in `partner_networks`

Dato che `save-wca-contacts` gia' viene chiamato dall'estensione (background.js chiama `sendContactsToServer` subito dopo l'estrazione), e il processore gestisce i contatti localmente, la soluzione piu' pulita e':
- L'estensione invia il profilo completo a `save-wca-contacts`
- `save-wca-contacts` salva TUTTO (contatti + profilo) in un'unica transazione
- Il processore (`useDownloadProcessor`) si limita a verificare il risultato e aggiornare i contatori, senza duplicare la logica di salvataggio

### 5. `src/hooks/useExtensionBridge.ts` -- Aggiornare il tipo di risposta

Aggiungere i campi del profilo a `ExtensionResponse`:

```typescript
type ExtensionResponse = {
  success: boolean;
  contacts?: Array<{...}>;
  companyName?: string;
  wcaId?: number;
  pageLoaded?: boolean;
  profile?: {
    address?: string;
    phone?: string;
    fax?: string;
    mobile?: string;
    emergencyPhone?: string;
    email?: string;
    website?: string;
    memberSince?: string;
    membershipExpires?: string;
    officeType?: string;
    description?: string;
    networks?: Array<{ name: string; id?: string; expires?: string }>;
    services?: string[];
    certifications?: string[];
    branchCities?: string[];
  };
  profileHtml?: string;
  // ... rest
};
```

## File modificati

1. `public/chrome-extension/background.js` -- Estrazione completa + invio profilo
2. `supabase/functions/save-wca-contacts/index.ts` -- Salvataggio profilo in partners + tabelle correlate
3. `src/hooks/useExtensionBridge.ts` -- Tipo aggiornato
4. `src/hooks/useDownloadProcessor.ts` -- Passare profilo e HTML al salvataggio locale (backup)

## Note importanti

- L'HTML grezzo (`raw_profile_html`) e' fondamentale per il parsing AI successivo (`parse-profile-ai`, `analyze-partner`)
- I network, servizi e certificazioni devono matchare gli enum esistenti nel database per evitare errori di inserimento
- La logica di estrazione usa le classi CSS della pagina WCA (`profile_label`, `profile_val`, `contactperson_row`) che sono stabili da anni
