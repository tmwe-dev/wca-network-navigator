

# Pulizia DB + Download Profili Mancanti — IMPLEMENTATO ✅

## Cosa è stato fatto

Quando l'utente attiva "Scarica dopo scansione" e avvia la scansione:

1. La directory viene scaricata fresca (tutte le pagine)
2. Al completamento, il sistema confronta gli ID freschi con quelli nel DB
3. **Elimina dal DB** i partner che NON sono più nella directory (+ tabelle correlate)
4. Mostra un riepilogo: "Rimossi X partner obsoleti"
5. Forza modalità `no_profile` e avvia il download dei profili mancanti

### Tabelle pulite prima della cancellazione partner:
- partner_contacts
- partner_networks
- partner_services
- partner_certifications
- partner_social_links
- interactions
- reminders
- activities

### Batch processing
Le cancellazioni avvengono in batch da 50 per evitare limiti URL.
