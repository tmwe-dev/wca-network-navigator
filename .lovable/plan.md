
# Piano: Evoluzione Inbox Email — Layout, Auto-Sync, Enrichment e Reply

## 7 Interventi

### 1. Layout Compatto Inbox Email
- Spostare "Nuove", "Scarica Tutto", "Reset" nel **top bar** della pagina (accanto ai tab Email/WhatsApp/LinkedIn)
- Le info "3891 email in database · pag. 1 · 50 visualizzate" diventano una riga compatta orizzontale sotto i tab, non sopra la lista

### 2. Auto-Sync Email (ogni 2-3 minuti)
- Aggiungere un **toggle ON/OFF** nel top bar per l'auto-sync
- Quando attivo: chiamata `check-inbox` ogni 2 minuti in background
- Lo stato del toggle persiste in localStorage
- Badge animato durante il download

### 3. Loghi Aziendali Migliorati
- Rimuovere lo sfondo bianco → usare `object-contain` con sfondo trasparente
- Se non c'è logo/favicon: **nessuna icona placeholder**, solo spazio vuoto o iniziale
- Non tagliare mai l'immagine: adattare lo spazio al logo (aspect-ratio libero)
- Arrotondamento leggero, ombra sottile

### 4. Bandiere Paese sulle Email
- Analizzare il dominio dell'email o il TLD per dedurre il paese (`.ae` → 🇦🇪, `.us`/`.com` → tentativo)
- Se il contatto è nel database con country code → usare quello
- Mostrare una mini-bandiera (16px) accanto al logo/avatar

### 5. Toggle Enrichment AI (Google Search)
- Toggle in alto "🔍 AI Enrich" che attiva/disattiva l'arricchimento automatico
- Quando attivo: per ogni email nuova da mittente sconosciuto, chiama un edge function leggero che fa una ricerca rapida (dominio → nome azienda, settore, paese)
- Salva il risultato nel database (tabella `email_address_rules` o nuova `sender_profiles`) così la prossima volta non serve ricalcolare
- Costo minimo: usa Gemini Flash Lite con pochi token

### 6. Filtro Circuito d'Attesa
- Verificare se il mittente è nel circuito d'attesa (match su email in `imported_contacts` con `lead_status = 'contacted'`)
- Badge "✈️ Circuito" sulla card email se match
- Filtro rapido nel top bar: "Mostra solo Circuito d'Attesa"

### 7. Reply Inline → Email Composer
- Aggiungere tasti "Rispondi" / "Rispondi a tutti" / "Inoltra" sopra il corpo email
- Click apre un **Dialog/Sheet** con l'Email Composer precompilato (destinatario, subject con "Re:", quote del messaggio originale)
- Il messaggio originale è visibile in un pannello laterale o in basso (collassabile)

## Ordine di esecuzione

1. **Layout compatto** (intervento 1) — impatto visivo immediato
2. **Loghi migliorati** (intervento 3) — qualità grafica
3. **Bandiere paese** (intervento 4) — info visiva rapida
4. **Filtro circuito d'attesa** (intervento 6) — funzionalità operativa
5. **Reply inline** (intervento 7) — produttività
6. **Auto-sync** (intervento 2) — automazione
7. **Enrichment AI** (intervento 5) — richiede edge function + possibile nuova tabella

## File principali coinvolti

| File | Azione |
|------|--------|
| `src/components/outreach/InArrivoTab.tsx` | Riorganizzare toolbar, aggiungere toggle auto-sync |
| `src/components/outreach/EmailInboxView.tsx` | Layout compatto, loghi, bandiere, badge circuito |
| `src/components/outreach/EmailMessageCard.tsx` o simile | Logo trasparente, bandiera, badge ✈️ |
| `src/components/outreach/EmailReplyDialog.tsx` | Nuovo — dialog reply con composer |
| `src/hooks/useEmailAutoSync.ts` | Nuovo — polling check-inbox ogni 2min |
| Edge function enrichment | Eventuale — ricerca rapida mittente |
