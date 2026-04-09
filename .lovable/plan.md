

# Piano: Riorganizzazione Toolbar WhatsApp + Miglioramenti Chat

## Panoramica

Tre interventi: (1) spostare i controlli WhatsApp (Leggi, ON/OFF, Backfill, stato connessione) nella barra dei tab di InArrivoTab, così la sidebar chat resta pulita; (2) arricchire l'area di reply con supporto drag-and-drop per foto/documenti e allegati; (3) analisi delle limitazioni attuali.

## A. Toolbar unificata nel header Inreach

Spostare i bottoni Leggi, ON/OFF, Backfill, badge connessione e livello **nella riga dei tab** (a destra dei bottoni Email/WhatsApp/LinkedIn), visibili solo quando il canale WhatsApp è selezionato. La progress bar backfill va sotto la riga tab.

**File coinvolti:**

| File | Azione |
|------|--------|
| `src/components/outreach/InArrivoTab.tsx` | Aggiungere slot per controlli canale-specifici a destra dei tab; quando `channel === "whatsapp"`, mostrare i bottoni Leggi/ON-OFF/Backfill/Badge |
| `src/components/outreach/WhatsAppInboxView.tsx` | Rimuovere i controlli dalla sidebar interna; esportare un componente `WhatsAppToolbar` separato che InArrivoTab possa importare |

La sidebar WhatsApp conterrà solo: campo Cerca + lista contatti. Molto più pulita.

## B. Migliorare l'area di chat WhatsApp

### B1. Drag & Drop e allegati
- Aggiungere un'icona 📎 (Paperclip) accanto all'input di reply
- Supportare drag-and-drop sull'area chat (overlay "Rilascia qui")
- File accettati: immagini (JPG/PNG/WEBP), PDF, documenti
- Il file viene caricato su Supabase Storage (bucket `chat-attachments`) e il link viene inviato come messaggio WhatsApp (l'estensione non supporta invio binario diretto — si invia il link del file)

### B2. Messaggi vocali
- L'invio di audio richiede che l'estensione Chrome supporti l'interazione con il tasto microfono di WhatsApp Web — attualmente **non supportato**
- Per ora, segnalare con un tooltip "Messaggi vocali non ancora supportati"

### Limitazione tecnica importante
L'estensione WhatsApp bridge può inviare solo **testo**. Per allegati (foto, documenti), il sistema:
1. Carica il file su storage cloud
2. Invia un messaggio con il link scaricabile
3. Non è identico a un allegato nativo WhatsApp, ma è funzionale

## C. File coinvolti

| File | Azione |
|------|--------|
| `src/components/outreach/InArrivoTab.tsx` | +importa WhatsAppToolbar, mostra condizionalmente |
| `src/components/outreach/WhatsAppInboxView.tsx` | Estrai WhatsAppToolbar, rimuovi controlli dalla sidebar, aggiungi drag-drop + bottone allegati nell'area reply |
| `src/components/outreach/WhatsAppToolbar.tsx` | Nuovo — componente toolbar con Leggi/ON-OFF/Backfill/Badge |

## Ordine di esecuzione

1. Estrarre `WhatsAppToolbar` da WhatsAppInboxView
2. Integrare in InArrivoTab accanto ai tab
3. Aggiungere drag-and-drop + allegati nell'area reply
4. Pulire sidebar (solo cerca + lista)

