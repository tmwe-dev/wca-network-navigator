

# Piano: Pulsante Test Estensioni nel Header + Analisi Backfill vs Leggi

## 1. Pulsante Test Estensioni nel Header globale

Aggiungere un'icona (🧪 `FlaskConical`) nella barra in alto a destra, accanto al "+" e a "IntelliFlow", che apre un **Dialog** con dentro il contenuto di `TestExtensions` (WhatsApp, LinkedIn, FireScrape tabs).

**Implementazione:**
- In `AppLayout.tsx`, aggiungere un bottone con icona `FlaskConical` (da lucide) nel gruppo di destra del header (riga 167-171)
- Al click, apre un `Dialog` full-width che carica lazy il componente `TestExtensions`
- Estrarre il contenuto tabs di `TestExtensions` in un sotto-componente `TestExtensionsContent` esportato separatamente, riusabile sia nella pagina `/test-extensions` che nel Dialog

**File coinvolti:**
| File | Azione |
|------|--------|
| `src/components/layout/AppLayout.tsx` | +stato `testOpen`, +bottone FlaskConical, +Dialog con lazy TestExtensions |
| `src/pages/TestExtensions.tsx` | Estrarre `TestExtensionsContent` come export separato |

---

## 2. Analisi: Perché Backfill non funziona bene vs Leggi

Ecco la differenza tecnica tra i due:

### `readUnread` (📨 Leggi — FUNZIONA)
- Azione: `"readUnread"` inviata all'estensione
- **Cosa fa**: Legge la sidebar di WhatsApp Web — la lista delle chat visibili
- **Come**: Parsa il DOM statico della sidebar (nomi, ultimo messaggio, timestamp, badge non letti)
- **Perché funziona**: È una lettura passiva di elementi già renderizzati nel DOM, nessuna interazione necessaria

### `backfillChat` (🔄 Backfill — PROBLEMATICO)
- Azione: `"backfillChat"` inviata all'estensione con `{ contact, lastKnownText, maxScrolls: 30 }`
- **Cosa fa**: Per ogni contatto, deve:
  1. **Cercare** il contatto nella sidebar (click sulla search box, digitare il nome)
  2. **Aprire** la chat (click sul risultato)
  3. **Scrollare verso l'alto** fino a 30 volte per caricare messaggi vecchi (lazy loading)
  4. **Parsare** ogni singola bolla messaggio dal DOM
  5. **Determinare** la direzione (inbound/outbound) per ogni messaggio
- **Perché fallisce**:
  - I selettori DOM per le bolle dei messaggi cambiano spesso (WhatsApp aggiorna le classi CSS)
  - Lo scroll verso l'alto dipende dal lazy loading di WhatsApp che può non caricare
  - La ricerca del contatto può fallire (nomi con suffissi, caratteri speciali)
  - Ogni interazione (click, scroll) può essere rilevata come automazione
  - Timeout di 120s può non bastare per 30 scroll + parsing

### Confronto visuale

```text
readUnread:     Sidebar DOM → parse → done        (1 step, passivo)
backfillChat:   Search → Click → Scroll×30 → Parse (4+ step, attivo)
```

Il backfill è 10x più complesso e ogni step può fallire. Il problema non è nel codice React (`useWhatsAppBackfill.ts`) che è ben strutturato con circuit breaker e retry, ma nell'**estensione stessa** — il handler `backfillChat` nell'estensione Chrome deve interagire con il DOM in modo molto più aggressivo.

**Suggerimento**: Per diagnosticare meglio, aggiungeremo un test specifico "🔄 Test Backfill" nel pannello WhatsApp test che mostra i log dettagliati di ogni step (ricerca contatto, apertura chat, scroll, parsing bolle).

