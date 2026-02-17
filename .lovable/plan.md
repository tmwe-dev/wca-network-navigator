

# Pulizia DB + Download Profili Mancanti

## Il problema

- 837 partner US nel database
- Solo 137 hanno il profilo scaricato (`raw_profile_html`)
- 700 sono senza profilo
- Alcuni di questi 837 non esistono piu su WCA (generano errori "Member not found")

## Cosa faremo

### Passo 1: Aggiungere la pulizia automatica dopo la scansione directory

Quando la scansione directory fresca si completa (in modalita "Scarica dopo scansione"), il sistema:

1. Prende gli ID freschi trovati nella directory
2. Li confronta con i partner nel DB per quel paese
3. **Elimina dal DB** i partner che NON sono piu nella directory (ID stale/obsoleti)
4. Mostra un riepilogo: "Rimossi X partner obsoleti, da scaricare: Y profili mancanti"
5. Avvia il download solo dei profili mancanti (`raw_profile_html IS NULL`)

### Passo 2: Forzare modalita "Senza profilo" nel download automatico

Quando il download parte automaticamente dopo la pulizia, usa sempre la modalita `no_profile` (scarica solo chi non ha `raw_profile_html`), ignorando la selezione manuale.

## Dettaglio tecnico

### File: `src/components/download/ActionPanel.tsx`

Modificare il `useEffect` che gestisce l'auto-download (righe 194-208):

1. Dopo che `scanComplete = true` e `autoDownloadPending = true`:
   - Raccogliere i WCA ID freschi dalla scansione (`scannedMembers`)
   - Query al DB: tutti i partner del paese con `wca_id`
   - Calcolare gli ID stale: `dbIds - freshDirectoryIds`
   - Se ci sono ID stale, eliminarli da `partners` (e tabelle correlate: `partner_contacts`, `partner_networks`, `partner_services`, `partner_certifications`)
   - Invalidare le query per aggiornare i contatori
   - Forzare `downloadMode = "no_profile"`
   - Avviare il download

2. La pulizia delle tabelle correlate avviene tramite cascade o query separate (partner_contacts, partner_networks, ecc. referenziano `partner_id`).

### Flusso risultante

```text
Click "Scansiona e Scarica"
  --> Scansione directory pagina per pagina
  --> Completata: trovati 980 partner reali
  --> Confronto DB: 837 nel DB, di cui 50 non piu in directory
  --> Eliminati 50 partner obsoleti dal DB
  --> Rimasti 787 nel DB, di cui ~650 senza profilo
  --> Avvio download automatico di ~650 profili
```

### Nessuna migrazione SQL necessaria

La pulizia avviene via client Supabase (`DELETE FROM partners WHERE id IN (...)`). Le tabelle correlate (contacts, networks, services, certifications) dovranno essere pulite prima del partner principale poiche non hanno foreign key con CASCADE.
