

## Analisi del Sudafrica (ZA)

### Dati nel database

| Metrica | Valore |
|---------|--------|
| Partner nel DB | 69 |
| Con profilo HTML | 69 (100%) |
| Senza profilo HTML | 0 |
| Con email (diretta o contatto) | 47 |
| **Senza email** | **22** |
| Directory cache | 70 membri |
| In `partners_no_contacts` | 10 |

### Il problema

Il sistema dice "tutti scaricati" perche tutti i 69 partner hanno `raw_profile_html` popolato. I tre filtri di download sono:

1. **"new"** → `missingIds` = partner nella directory ma non nel DB → **0** (tutti gia inseriti)
2. **"no_profile"** → partner nel DB senza `raw_profile_html` → **0** (tutti hanno il profilo)
3. **"all"** → ri-scarica tutto → funziona ma e uno spreco

**22 partner hanno il profilo HTML salvato ma zero email/telefono estratti.** Il download li considera "completati" perche il profilo esiste, anche se l'estrazione dei contatti e fallita o la pagina WCA non conteneva dati di contatto.

Di questi 22, **10 sono gia marcati in `partners_no_contacts`** — il sistema ha gia verificato che la pagina WCA genuinamente non contiene contatti per quei membri (membership scadute, profili incompleti su WCA).

I restanti **12 senza email** potrebbero essere:
- Genuinamente senza contatti su WCA
- Estrazione fallita durante il primo download (sessione scaduta, rate-limit)

### Soluzione proposta

Aggiungere una **quarta modalita di download: `"no_email"`** che seleziona i partner con profilo ma senza email, escludendo quelli gia marcati come inesistenti in `partners_no_contacts`.

#### File da modificare

1. **`src/hooks/useDirectoryDownload.ts`**
   - Aggiungere tipo `"no_email"` al `DownloadMode`
   - Nuova query per recuperare i `wca_id` di partner con profilo ma senza email (e non in `partners_no_contacts`)
   - Nel calcolo `idsToDownload`, gestire il caso `no_email`
   - Auto-switch: se `no_profile` ha 0 risultati ma ci sono partner senza email, passare a `no_email`

2. **`src/components/operations/PartnerListPanel.tsx`**
   - Aggiungere opzione "Senza Email" nel selettore modalita download
   - Mostrare il conteggio dei partner senza email

### Dettaglio tecnico

```text
Query per no_email mode:
  SELECT wca_id FROM partners
  WHERE country_code = 'ZA'
    AND raw_profile_html IS NOT NULL
    AND email IS NULL
    AND wca_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM partner_contacts pc 
      WHERE pc.partner_id = partners.id AND pc.email IS NOT NULL
    )
    AND wca_id NOT IN (
      SELECT wca_id FROM partners_no_contacts 
      WHERE country_code = 'ZA' AND resolved = false
    )
```

Questo restituirebbe i ~12 partner che vale la pena riprovare, escludendo i 10 gia confermati come vuoti.

