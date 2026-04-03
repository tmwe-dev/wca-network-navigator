
## Architettura Polling Adattivo WhatsApp

### Livelli di Attenzione

| Livello | Nome | Intervallo | Cosa fa | Quando |
|---------|------|-----------|---------|--------|
| 0 | Idle | 60-90s | Sidebar scan (lista chat) | Nessuna attività |
| 3 | Alert | 10-20s | Sidebar scan rapido | Nuovo messaggio rilevato |
| 6 | Conversazione | 3-5s | Thread scan chat attiva | Risposta ricevuta in chat attiva |

### Logica di Escalation/De-escalation

- **0 → 3**: Sidebar scan rileva nuovo messaggio non letto
- **3 → 6**: La chat su cui ci si concentra riceve una risposta entro 30s
- **6 → 3**: Nessuna nuova risposta per 60s nella chat attiva
- **3 → 0**: Nessun nuovo messaggio per 3 minuti
- **Focus singola chat**: Una sola conversazione attiva alla volta; le altre aspettano in coda

### DOM Learning (ogni 3h)

- Una chiamata AI ogni 3 ore per "imparare" la struttura DOM di WhatsApp Web
- Il risultato (selettori CSS per sidebar, messaggi, input, badge) viene salvato in `app_settings` con chiave `wa_dom_schema`
- Le letture successive usano i selettori cached → **zero chiamate AI per lo scraping normale**
- Se un selettore fallisce → trigger di ri-apprendimento immediato

### Implementazione

1. **Creare `useWhatsAppAdaptiveSync` hook** — gestisce i livelli, escalation/de-escalation, timer adattivi
2. **Aggiungere `focusChat` al bridge** — comando per aprire e monitorare una chat specifica
3. **Aggiungere `learnDom` al bridge** — scansione AI della struttura DOM, salva selettori
4. **Aggiornare background.js** — supporto comandi `focusChat`, `learnDom`, `readThread` con selettori cached
5. **Aggiornare la UI WhatsApp** — mostrare il livello corrente e la chat in focus
