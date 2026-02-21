
# Email Composer: Pagina completa per creare e inviare email

## Cosa faremo

Creeremo un sistema completo di composizione e invio email con:

1. **Categorie di template** per organizzare i modelli email
2. **Nuova pagina "Email Composer"** accessibile dalla sidebar
3. **Editor email** con oggetto, corpo HTML, allegati e link
4. **Selezione destinatari** dal database (per paese, per partner, per selezione manuale)
5. **Invio singolo o massivo** tramite il sistema SMTP gia configurato

---

## Categorie Template

Riorganizzeremo i template (attualmente tutti sotto "altro") in categorie predefinite:

| Categoria | Descrizione |
|-----------|-------------|
| offerta_cliente | Offerta nuovo cliente |
| collaborazione_domestic | Proposta collaborazione nazionale |
| collaborazione_international | Proposta collaborazione internazionale |
| saluti_festivita | Mailing di saluto e festivita |
| comunicazioni_operative | Informazioni operative aziendali |
| altro | Altro |

Il campo `category` esiste gia nella tabella `email_templates` -- aggiorneremo solo il TemplateManager per mostrare/selezionare la categoria.

---

## Nuova tabella: `email_drafts`

Per salvare le bozze delle email composte:

| Colonna | Tipo | Note |
|---------|------|------|
| id | uuid | PK |
| subject | text | Oggetto |
| html_body | text | Corpo HTML |
| category | text | Categoria template usata |
| recipient_type | text | "country", "manual", "campaign_batch" |
| recipient_filter | jsonb | Filtro destinatari (country_codes, partner_ids, batch_id) |
| attachment_ids | jsonb | Array di ID email_templates allegati |
| link_urls | jsonb | Array di {label, url} |
| status | text | "draft", "sending", "sent" |
| sent_count | int | Quante email inviate |
| total_count | int | Quanti destinatari totali |
| created_at | timestamptz | |
| sent_at | timestamptz | |

---

## Nuova pagina: Email Composer (`/email-composer`)

Layout a due colonne:

```text
+--------------------------------------+---------------------------+
|  EDITOR EMAIL                        |  DESTINATARI              |
|                                      |                           |
|  Categoria: [dropdown]               |  Modalita: [tabs]         |
|  Oggetto:   [________________]       |  - Per Paese              |
|                                      |  - Per Partner            |
|  Corpo:                              |  - Da Campagna            |
|  [                              ]    |                           |
|  [    textarea / editor         ]    |  [lista selezionabile]    |
|  [                              ]    |                           |
|                                      |  Selezionati: 24          |
|  Allegati: [checkbox lista]          |  Con email: 20            |
|  Link:     [+ aggiungi link]         |                           |
|                                      |                           |
|  [Salva Bozza] [Anteprima] [Invia]   |                           |
+--------------------------------------+---------------------------+
```

### Pannello sinistro - Editor
- **Dropdown categoria** con le 6 categorie sopra
- **Campo oggetto** con variabili dinamiche suggerite: `{{company_name}}`, `{{contact_name}}`, `{{city}}`
- **Textarea corpo** (HTML semplice, con sostituzione variabili)
- **Allegati**: checkbox dei file caricati in Template (da `email_templates`), raggruppati per categoria
- **Link**: lista dinamica di URL con label (aggiungi/rimuovi)
- **Pulsanti**: Salva Bozza, Anteprima (mostra come apparira con dati reali), Invia

### Pannello destro - Selezione destinatari
Tre modalita via tabs:

1. **Per Paese**: multi-select dei paesi, mostra conteggio partner per paese, seleziona tutti i partner di quei paesi
2. **Per Partner**: ricerca e selezione manuale dalla rubrica (tabella `partners` + `partner_contacts`)
3. **Da Campagna**: seleziona un batch_id esistente dalla tabella `campaign_jobs` per inviare ai partner di quella campagna

In ogni caso, mostra:
- Numero totale destinatari selezionati
- Quanti hanno email valida
- Anteprima lista nomi/email

### Invio
- Il pulsante "Invia" chiama la edge function `send-email` in sequenza per ogni destinatario
- Sostituisce le variabili `{{company_name}}`, `{{contact_name}}` etc. per ogni email
- Aggiorna `email_drafts.status` e `sent_count` in tempo reale
- Logga ogni invio nella tabella `interactions`

---

## Modifiche ai file esistenti

| File | Modifica |
|------|---------|
| `src/components/layout/AppSidebar.tsx` | Aggiungere voce "Email" con icona `Send` che punta a `/email-composer` |
| `src/App.tsx` | Aggiungere route `/email-composer` |
| `src/components/settings/TemplateManager.tsx` | Aggiungere dropdown categoria al caricamento file |
| `supabase/functions/send-email/index.ts` | Supportare allegati (URL file) nell'HTML generato |

## Nuovi file

| File | Descrizione |
|------|-------------|
| `src/pages/EmailComposer.tsx` | Pagina principale editor + destinatari |
| `src/hooks/useEmailDrafts.ts` | Hook CRUD per email_drafts |

## Migrazione database

- Creare tabella `email_drafts` con RLS (auth.uid() IS NOT NULL)

---

## Dettagli tecnici

### Sostituzione variabili
Per ogni destinatario, prima dell'invio:
```
subject.replace(/\{\{company_name\}\}/g, partner.company_name)
       .replace(/\{\{contact_name\}\}/g, contact.name)
       .replace(/\{\{city\}\}/g, partner.city)
       .replace(/\{\{country\}\}/g, partner.country_name)
```
Stessa logica sul body HTML.

### Gestione link nell'email
I link vengono appesi in fondo al body HTML come lista `<ul>` con tag `<a>`.

### Allegati
Gli allegati (file dal bucket `templates`) vengono inseriti come link di download nell'HTML, non come allegati MIME (il sistema SMTP attuale non supporta allegati binari).

### Flusso invio massivo
1. Utente clicca "Invia"
2. Si crea un record `email_drafts` con status "sending"
3. Loop sui destinatari: per ognuno, chiama `send-email` con sostituzione variabili
4. Aggiorna `sent_count` ogni N invii
5. Al termine, status diventa "sent"
6. Toast con riepilogo: "24 email inviate con successo, 2 fallite"
