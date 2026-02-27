

## Analisi dei problemi

### 1. Dati potenzialmente errati nella RPC `get_country_stats`

La funzione SQL controlla solo `partner_contacts.email` per il conteggio email, ma NON controlla `partners.email` (il campo email aziendale). Stessa cosa per il telefono: controlla solo `partner_contacts.direct_phone/mobile` ma non `partners.phone/mobile`. Questo può causare conteggi inferiori al reale.

**Fix**: Aggiornare la RPC per includere anche i campi direttamente sulla tabella `partners` nella logica di conteggio email e telefono.

### 2. UX dei StatChip invertita rispetto all'uso operativo

I chip mostrano "Email **100**/178" (quanti CE L'HANNO), ma quando li clicchi filtrano quelli che NON ce l'hanno. L'utente vuole che il chip comunichi chiaramente quanti MANCANO, perché l'obiettivo operativo è sempre completare i dati.

**Fix**: Invertire la visualizzazione dei chip cliccabili per mostrare i MANCANTI:
- "Senza Profilo **178**" invece di "Profili **0**/178"
- "Senza Deep **55**" invece di "Deep Search **123**/178"
- "Senza Email **78**" invece di "Email **100**/178"
- Quando il conteggio mancante è 0, mostrare "✓" verde

I chip non cliccabili ("Totale WCA", "Scaricati") restano invariati.

### File modificati

1. **`supabase/migrations/` (nuova)** -- Aggiornare la RPC `get_country_stats` per contare anche `partners.email` e `partners.phone/mobile` oltre ai contatti
2. **`src/components/operations/PartnerListPanel.tsx`** -- Invertire la label e il valore dei StatChip cliccabili per mostrare i mancanti anziché i presenti; aggiornare il componente `StatChip` per supportare la modalità "mancanti"

### Dettaglio tecnico RPC

```sql
-- Aggiungere nella CTE partner_base:
CASE WHEN p.email IS NOT NULL THEN 1 ELSE 0 END as has_partner_email,
CASE WHEN p.phone IS NOT NULL OR p.mobile IS NOT NULL THEN 1 ELSE 0 END as has_partner_phone

-- Nel SELECT finale, cambiare:
-- with_email: partner ha email propria OPPURE almeno un contatto con email
COUNT(*) FILTER (WHERE ca.has_email = true OR pb.has_partner_email = 1)
-- with_phone: analogo
COUNT(*) FILTER (WHERE ca.has_phone = true OR pb.has_partner_phone = 1)
```

### Dettaglio UX StatChip

```text
PRIMA (confuso):
[Totale WCA 178] [Scaricati 178/178] [Profili 0/178] [Deep 123/178] [Email 100/178]

DOPO (operativo):
[Totale WCA 178] [Scaricati 178/178] [Senza Profilo 178] [Senza Deep 55] [Senza Email 78]
                                       ↑ click filtra i 178 senza profilo
```

Quando il mancante è 0, il chip mostra "✓ Profili" in verde e non è cliccabile.

