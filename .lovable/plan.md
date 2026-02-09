
# Evidenziare completezza contatti personali in tutto il sistema

## Situazione attuale

I dati mostrano che quasi tutti i partner hanno il telefono generico dell'ufficio, ma pochissimi hanno email personali dei responsabili. Ad esempio:
- USA: 198 partner, solo 61 contatti con email personale (31%)
- Australia: 90 partner, solo 21 contatti con email personale (23%)
- Canada: 10 partner, 0 contatti con email personale (0%)

Il sistema attualmente non evidenzia questa lacuna in nessun punto dell'interfaccia.

## Cosa cambia

Il sistema mostrera' ovunque quanto sono "completi" i dati di valore (email e telefono personali dei responsabili), evidenziando in rosso/arancione i paesi e partner dove mancano questi dati critici.

## Dove appare l'indicatore

### 1. Dashboard - Nuova stat card "Qualita' Contatti"
Una nuova card nella griglia delle statistiche che mostra:
- Percentuale globale di partner con contatti personali completi
- Numero di partner senza email personale del responsabile
- Colore rosso/arancione/verde a seconda della copertura

### 2. Dashboard - Grafico paesi con indicatore completezza
Il grafico "Partners by Country" viene arricchito: accanto al numero di partner per paese, una barra secondaria o indicatore colorato mostra la percentuale di contatti personali completi.

### 3. Partners - Badge su ogni card
Ogni PartnerCard mostra un indicatore visivo:
- Badge verde "Contatti completi" se ha almeno un contatto con email personale
- Badge rosso "Manca email responsabile" se nessun contatto ha email
- Icona di avviso arancione se ha contatto ma senza telefono diretto

### 4. Agenti - Lista partner con filtro completezza
Nella pagina Agenti (quella attuale), aggiungere:
- Un badge colorato nella lista a sinistra per ogni partner
- Un filtro rapido "Solo incompleti" per concentrarsi sui partner da completare
- Nel pannello dettaglio, evidenziare chiaramente quali dati mancano

### 5. Download Management - Riepilogo per paese
Nella tabella dei paesi scaricati, una colonna "Qualita'" che mostra la percentuale di contatti personali completi per quel paese.

## Dettagli tecnici

### Nuovo hook: `useContactCompleteness`
Un hook dedicato che interroga il database per calcolare le statistiche di completezza:

```text
-- Query: per ogni paese, quanti partner hanno almeno un contatto con email personale
SELECT 
  p.country_code,
  COUNT(DISTINCT p.id) as total,
  COUNT(DISTINCT CASE WHEN pc.email IS NOT NULL THEN p.id END) as with_personal_email,
  COUNT(DISTINCT CASE WHEN pc.direct_phone IS NOT NULL OR pc.mobile IS NOT NULL THEN p.id END) as with_personal_phone
FROM partners p
LEFT JOIN partner_contacts pc ON pc.partner_id = p.id
WHERE p.is_active = true
GROUP BY p.country_code
```

### Definizione di "contatto di valore"
Un partner ha contatti di valore quando:
- Ha almeno un record in `partner_contacts` con `email` non vuoto (email del responsabile)
- Bonus: ha anche `direct_phone` o `mobile` (telefono personale)

Il telefono generico (`partners.phone`) e l'email generica (`partners.email`) NON contano come "di valore".

### Logica colore
- Verde: ha email personale + telefono personale
- Arancione: ha email personale MA non telefono personale (o viceversa)
- Rosso: non ha ne' email ne' telefono personale di nessun responsabile

### File da modificare
- `src/hooks/useContactCompleteness.ts` (nuovo) - hook con query aggregata
- `src/pages/Dashboard.tsx` - nuova stat card + modifica grafico paesi
- `src/components/dashboard/CountryChart.tsx` - indicatore completezza per paese
- `src/components/partners/PartnerCard.tsx` - badge completezza contatti
- `src/pages/Agents.tsx` - badge nella lista + filtro "solo incompleti"
- `src/pages/DownloadManagement.tsx` - colonna qualita' nella tabella paesi
- `src/hooks/usePartners.ts` - includere `partner_contacts` nella query lista
