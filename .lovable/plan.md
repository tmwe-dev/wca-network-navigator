

# Redesign chat WhatsApp nella Inbox

## Problemi attuali identificati

1. **Nessuna distinzione visiva mittente/destinatario** — Le bolle mostrano solo il testo e l'orario. Non c'è label "Tu" sui messaggi outbound né nome del contatto sugli inbound
2. **Bolle troppo semplici** — Manca la "coda" tipica di WhatsApp, mancano le spunte di lettura (✓✓), manca il raggruppamento per data
3. **Nessun separatore di data** — I messaggi di giorni diversi non sono separati visivamente
4. **Header chat minimale** — Mostra solo nome e conteggio messaggi, nessuna info aggiuntiva utile
5. **Messaggi raggruppati per `from_address`/`to_address`** — Se il sistema salva formati diversi per lo stesso contatto (es. numero vs nome), i thread possono frammentarsi

## Piano di intervento

### 1. Separatori di data tra i messaggi
Inserire un divisore orizzontale con la data (es. "Oggi", "Ieri", "3 aprile 2026") tra gruppi di messaggi di giorni diversi, come fa WhatsApp nativo.

### 2. Bolle chat migliorate stile WhatsApp
- **Outbound (Tu)**: verde scuro con angolo in basso a destra, label "Tu" in grassetto sopra il testo, doppia spunta grigia/blu
- **Inbound**: sfondo bianco/card con angolo in basso a sinistra, nome contatto in grassetto colorato sopra il testo
- Tail/coda CSS triangolare sulle bolle per il look WhatsApp autentico
- Orario posizionato in basso a destra inline col testo

### 3. Raggruppamento consecutivo
Messaggi consecutivi dallo stesso mittente: nascondere il nome e ridurre il margine tra bolle per un effetto "cluster" naturale.

### 4. Indicatori di stato messaggio
- Outbound: mostrare icona ✓ (inviato) o ✓✓ (letto, se `read_at` presente)
- Timestamp più leggibile

### 5. Header chat arricchito
- Mostrare telefono se disponibile (estratto da `raw_payload`)
- Status "online/ultimo accesso" se presente
- Conteggio messaggi non letti nel thread

### 6. Empty body handling
- Messaggi senza `body_text`: mostrare "(📎 media)" con icona invece di "(media)" in testo piatto

## File da modificare

- **`src/components/outreach/WhatsAppInboxView.tsx`** — Refactor della sezione messaggi (righe 458-484): aggiungere date separators, redesign bolle, clustering, status indicators. Migliorare header chat (righe 438-456).

## Dettagli tecnici

Separatori data:
```text
messages.reduce → gruppi per giorno (format "yyyy-MM-dd")
→ render: DateSeparator + bolle del giorno
```

Bolle con tail CSS (pseudo-elemento `::before`):
```text
outbound: triangolo bianco-verde in basso a destra
inbound: triangolo grigio in basso a sinistra
```

Clustering: confronto `direction` del messaggio precedente → se uguale, margine ridotto e nessun nome.

