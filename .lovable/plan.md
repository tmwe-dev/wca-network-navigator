

# Piano: Circuito Migliorato + Dettaglio Attivita + Dati Mock

## 4 Interventi

### 1. Circuito — Pannello sinistro migliorato

Ogni messaggio nella lista mostra attualmente solo subject troncato + data. Migliorare con:
- **Logo azienda** (da `logo_url` in partners) o iniziale colorata
- **Nome contatto** sotto il nome azienda
- **Badge canale** (icona mail/WA/LinkedIn colorata)
- **Preview corpo** piu leggibile (2 righe, non troncata a 80 char)
- **Indicatore direzione** piu chiaro (freccia colorata verde=ricevuto, blu=inviato)
- **Separatore visivo** tra gruppi azienda con bordo sinistro colorato
- Riutilizzare pattern gia presenti nelle card contatti (bandiera paese, timeline marker)

### 2. Circuito — Pannello destro: azioni fuori dai tab

Attualmente ci sono 3 tab: Risposta, Strategia, Azioni. Cambiare a:
- **4 icone azione rapida** in riga orizzontale sopra i tab (sotto l'header messaggio):
  - ✅ Approva e Invia (verde)
  - ✕ Ignora (grigio)
  - 📞 Escalation Chiamata (ambra)
  - ✨ Rigenera AI (primary)
- **Solo 2 tab** sotto: Risposta e Strategia (rimuovere tab Azioni)

### 3. Attivita — Dettaglio espandibile

Attualmente le righe sono solo lista piatta senza interazione. Aggiungere:
- **Click su riga** → espande un pannello inline (accordion) con:
  - Contenuto email (subject + body HTML) se tipo email
  - Contenuto messaggio se WA/LinkedIn
  - Note associate
  - Pulsante "Riprogramma" con date picker per creare follow-up
  - Pulsante "Aggiungi nota" inline
- Alternativa: pannello laterale destro (slide-in) per il dettaglio — piu coerente con il resto del sistema

### 4. Dati Mock temporanei con toggle globale

Creare un sistema mock data per mostrare la grafica finale:
- **Pulsante nell'header** di Outreach (icona `TestTube` o `Database`) che attiva/disattiva i mock
- Stato salvato in `localStorage` (`outreach-mock-enabled`)
- Quando attivo, ogni tab (In Uscita, Attivita, Circuito, Coda AI) mostra dati finti mescolati o al posto dei dati reali
- **File dedicato** `src/lib/outreachMockData.ts` con:
  - 8-10 sorting jobs mock (In Uscita)
  - 12-15 attivita mock con tipi vari, priorita, date (Attivita)
  - 6-8 messaggi holding pattern mock con aziende/contatti (Circuito)
  - 5-6 azioni AI pendenti mock (Coda AI)
- I dati mock includono nomi realistici italiani, aziende di logistica, email con subject credibili

## File coinvolti

| File | Azione |
|------|--------|
| `src/components/outreach/HoldingPatternCommandCenter.tsx` | Migliorare lista SX (logo, contatto, preview), ristrutturare DX (azioni in alto, 2 tab) |
| `src/components/outreach/AttivitaTab.tsx` | Aggiungere dettaglio espandibile/slide-in con contenuto, note, riprogrammazione |
| `src/lib/outreachMockData.ts` | **Nuovo** — dati mock per tutte e 4 le sezioni |
| `src/hooks/useOutreachMock.ts` | **Nuovo** — hook per toggle mock (localStorage) |
| `src/pages/Outreach.tsx` | Aggiungere pulsante mock toggle nell'header |
| `src/components/outreach/InUscitaTab.tsx` | Integrare mock data quando attivo |
| `src/components/outreach/CodaAITab.tsx` | Integrare mock data quando attivo |

## Ordine di esecuzione

1. Creare `outreachMockData.ts` + `useOutreachMock.ts`
2. Riscrivere pannello sinistro Circuito (grafica migliorata)
3. Ristrutturare pannello destro Circuito (azioni sopra + 2 tab)
4. Aggiungere dettaglio espandibile in Attivita
5. Aggiungere toggle mock in header Outreach
6. Integrare mock in tutte le 4 sezioni

