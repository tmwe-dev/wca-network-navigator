
# Riorganizzazione Outreach — 5 sezioni chiare

## Struttura attuale (7 tab)
Cockpit · In Uscita · Attività · Circuito · Email · WhatsApp · LinkedIn

## Nuova struttura (5 tab)

| Tab | Icona | Contenuto |
|-----|-------|-----------|
| **Cockpit** | 🚀 | Workspace di generazione outbound (invariato) |
| **In Arrivo** | 📥 | Inbox unificata: Email + WhatsApp + LinkedIn ricevuti, con sotto-filtri per canale e badge conteggio totale non letti |
| **In Uscita** | ↑ | Messaggi programmati/inviati: diretti + campagne. Stato invio, scheduling |
| **Attività** | ✅ | Log storico: cosa è stato fatto (telefonate, email inviate, note). Timeline cronologica |
| **Circuito** | ✈️ | Aziende in follow-up: stato/livello, timeline interazioni, risposte ricevute, data ultimo contatto |

## Cosa cambia

**Eliminati come tab separati:** Email, WhatsApp, LinkedIn → diventano sotto-filtri dentro "In Arrivo"

**In Arrivo** (nuovo):
- Header con 3 chip-filtro: Email (badge) · WhatsApp (badge) · LinkedIn (badge) + "Tutti"
- Sotto: lista messaggi ricevuti in ordine cronologico, raggruppabili per mittente/partner
- Click su messaggio → dettaglio a destra (come l'attuale EmailInboxView)
- Il badge sulla tab mostra la somma totale dei non letti

**Opzione collassabile:** La sezione "In Arrivo" potrebbe avere un toggle per minimizzarsi in una barra compatta con solo i badge, per dare più spazio al Cockpit

## File coinvolti

| File | Azione |
|------|--------|
| `src/pages/Outreach.tsx` | Ridurre a 5 tab, aggiungere "In Arrivo" con badge somma |
| `src/components/outreach/InArrivoTab.tsx` | **Nuovo**: inbox unificata con sotto-filtri canale |
| `src/components/outreach/InArrivoTab.tsx` | Riusa EmailInboxView, WhatsAppInboxView, LinkedInInboxView come sotto-viste |
