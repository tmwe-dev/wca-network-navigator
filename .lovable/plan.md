

# Piano: Correzioni Workspace - Selezione multipla, Signature, Alias, Validazione contatti e Canvas migliorato

## Problemi identificati

1. **Nessuna validazione contatto**: l'AI genera email anche senza un contatto reale con email, inviando al "general manager"
2. **Alias non utilizzati**: vengono usati nomi completi con cognome invece degli alias generati
3. **Nessuna firma (signature)**: manca completamente il blocco firma in fondo alla mail. Serve anche un campo nel profilo per configurare la firma HTML/testo
4. **Nessuna selezione multipla**: non si possono scegliere singoli contatti dalla lista per il batch -- o tutti o nessuno
5. **Filtri mancanti**: spariti i filtri di validazione (senza email, senza contatto, ecc.)
6. **Canvas poco curato**: lo spazio verticale non e sfruttato, l'email non "sembra una mail"

---

## Modifiche previste

### 1. Selezione multipla nella ContactListPanel

- Aggiungere checkbox su ogni riga della lista contatti
- Stato `selectedIds: Set<string>` gestito nel Workspace
- Header della lista con: "Seleziona tutti" / "Deseleziona" + conteggio selezionati
- Il pulsante "Genera Tutte" nell'header genera solo per i selezionati (non tutti)
- Filtri rapidi come chip: "Senza email", "Senza contatto", "Senza alias"

### 2. Firma email (Signature)

**Nuovo campo in app_settings**: `ai_email_signature_block` -- blocco di testo libero che viene allegato in fondo a ogni email generata.

**Nel profilo AI (AIProfileSettings.tsx)**: aggiungere un campo Textarea "Firma Email" nella Card Identita, sotto i campi telefono/email, con placeholder che mostra un esempio di firma tipo:

```text
Best regards,
Marco Rossi
Business Development Manager
Global Freight Solutions Srl
Tel: +39 02 1234567
Email: marco@gfs.it
```

**Nella Edge Function**: il blocco firma viene inserito automaticamente dopo il corpo dell'email. Se il campo e vuoto, la firma viene costruita automaticamente dai campi ai_contact_alias, ai_contact_role, ai_company_alias, ai_email_signature, ai_phone_signature.

### 3. Validazione contatto e uso degli alias nella Edge Function

**Regole di validazione**:
- Se il contatto selezionato non ha email, segnalare il problema nel risultato (non generare email vuote)
- Se non c'e contatto selezionato, usare l'email generale del partner ma segnalarlo

**Uso alias**:
- Il prompt AI deve usare `contact_alias` (se presente) come nome del destinatario, non il nome completo
- Il prompt deve usare `company_alias` (se presente) come nome dell'azienda destinataria
- Istruzione esplicita: "Usa SEMPRE l'alias come nome nelle comunicazioni, mai il nome completo con cognome"

### 4. Canvas email migliorato

Redesign del componente EmailCanvas per sembrare una vera email:

- **Header email-style**: barra superiore con icone Da/A/Oggetto in stile client di posta
- **Da**: mostra il mittente (dai settings: ai_contact_alias @ ai_company_alias)
- **A**: mostra il destinatario con email
- **Oggetto**: riga dedicata con sfondo leggermente diverso
- **Corpo**: area con padding generoso, font leggibile, leading ampio
- **Firma**: blocco separato visivamente con bordo superiore sottile e colore piu tenue
- **Navigazione**: frecce prev/next spostate in una barra compatta sopra l'email
- **Azioni**: barra in basso con Modifica/Copia/Invia disposti meglio

Layout verticale ottimizzato:
- Partner info bar piu compatta (1 riga)
- Canvas email occupa tutto lo spazio rimanente
- Padding e spaziature ridotte dove possibile, generose nel corpo email

### 5. Filtri nella ContactListPanel

Aggiungere una riga di chip-filtro sopra la lista:
- "Tutti" (default)
- "Con email" -- solo contatti con email
- "Senza email" -- evidenzia problematici
- "Con alias" -- solo quelli con alias

---

## Dettagli tecnici - File modificati

| File | Azione |
|------|--------|
| `src/pages/Workspace.tsx` | Aggiunge stato `selectedIds`, passa a ContactListPanel, modifica handleGenerateAll per generare solo i selezionati |
| `src/components/workspace/ContactListPanel.tsx` | Checkbox per selezione multipla, filtri rapidi, props `selectedIds`/`onToggle`/`onSelectAll` |
| `src/components/workspace/EmailCanvas.tsx` | Redesign completo in stile email client con header Da/A/Oggetto, firma visibile, layout verticale ottimizzato |
| `src/components/settings/AIProfileSettings.tsx` | Aggiunge campo "Firma Email" (ai_email_signature_block) nella Card Identita |
| `supabase/functions/generate-email/index.ts` | Validazione contatto, uso alias nelle istruzioni, aggiunta firma automatica in fondo, regola "no cognome" |
| `src/hooks/useActivities.ts` | Nessuna modifica necessaria (i dati gia ci sono) |

### Flusso corretto dopo le modifiche

1. L'utente seleziona con checkbox i contatti dalla lista (o usa "Seleziona tutti")
2. Puo filtrare per "Con email" per escludere quelli problematici
3. Clicca "Genera Selezionate" (il pulsante mostra il conteggio)
4. L'AI per ogni contatto:
   - Verifica che ci sia un'email valida, altrimenti salta con warning
   - Usa gli alias (non nomi completi) nel saluto
   - Aggiunge la firma configurata nel profilo
5. Le email generate appaiono nel canvas navigabile con frecce
6. Ogni email mostra Da/A/Oggetto in stile mail client

