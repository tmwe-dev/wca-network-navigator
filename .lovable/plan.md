

## Ristrutturazione PartnerDetailFull

### Analisi attuale

Il pannello di dettaglio ha 612 righe e spreca spazio con:
- **8 KPI cards** in alto (righe 126-159): Anni WCA, Network, Contatti, Scadenza, Con Email, Con Tel, Servizi, Interazioni — informazioni ridondanti rispetto alla card nella lista
- **Header card** (righe 161-244): ripete rating, trophy, telefono, email, website, social — visibile anche dalla lista
- **Profilo Aziendale** (righe 307-315): testo `text-muted-foreground` illeggibile su dark
- **Layout a 2 colonne** (righe 317-609): sparso e frammentato, con servizi e certificazioni separati dall'enrichment
- **Manca**: sezione Note

L'Enrichment Card ha lo stile giusto: `bg-gradient-to-br from-violet-500/5 via-card to-purple-500/5`, pulito, monocromatico con sfumature leggere.

### Proposta nuovo layout — colonna singola, prioritizzato

```text
┌─────────────────────────────────────────────────┐
│ HEADER COMPATTO                                  │
│ [Logo] ALTISA  #115931  ⭐ ✈ HQ                  │
│ 🇩🇿 Algeria · Algiers · ⭐⭐⭐⭐ · 🏆7 yrs        │
│ 📞 +213... · 🌐 altisa-dz.com · 🔗 LinkedIn     │
├─────────────────────────────────────────────────┤
│ ACTION BAR (invariato)                           │
│ [Attività] [Deep Search] [Workspace] [Email]     │
│ [Note]  ← NUOVO                                 │
├─────────────────────────────────────────────────┤
│ ENRICHMENT (stile viola, spostato in alto)        │
│ Profilo Aziendale + Profili Contatti              │
├─────────────────────────────────────────────────┤
│ PROFILO WCA (testo leggibile, text-foreground)    │
├─────────────────────────────────────────────────┤
│ CONTATTI UFFICIO (persone con email/tel/WA)       │
├─────────────────────────────────────────────────┤
│ NETWORK (loghi compatti inline)                  │
├─────────────────────────────────────────────────┤
│ SERVIZI (tutte le icone inline, no 2 sezioni)    │
├─────────────────────────────────────────────────┤
│ ATTIVITÀ                                         │
├─────────────────────────────────────────────────┤
│ TIMELINE + PROMEMORIA                            │
├─────────────────────────────────────────────────┤
│ DETTAGLI SECONDARI (collapsible)                 │
│ Certificazioni, Filiali, Mercati, Routing, Mappa │
└─────────────────────────────────────────────────┘
```

### Modifiche tecniche in `src/components/partners/PartnerDetailFull.tsx`

#### 1. Rimuovere le 8 KPI cards (righe 126-159)
Eliminare completamente la griglia "MEMBERSHIP SUMMARY" e la riga "KPI CARDS ROW". Le info chiave (anni, network count, scadenza) restano nell'header compatto.

#### 2. Header card — aggiungere info membership inline
Integrare anni WCA, scadenza membership e conteggio network come badge compatti nella riga sotto il nome, eliminando la necessità delle card separate.

#### 3. Eliminare il layout a 2 colonne
Passare a colonna singola. Riordinare le sezioni in ordine di priorità d'uso.

#### 4. Enrichment → subito dopo l'action bar
Spostare `<EnrichmentCard>` dalla riga 358 (metà pagina) a subito sotto l'action bar.

#### 5. Profilo WCA — fix leggibilità
Cambiare `text-muted-foreground` → `text-foreground/90` per il testo del profilo.

#### 6. Servizi — unificare in una sola sezione
Unire "Servizi di Trasporto" e "Specialità" in un'unica sezione "Servizi" con icone inline.

#### 7. Stile uniforme — template EnrichmentCard
Applicare a tutte le sezioni lo stesso stile monocromatico dell'EnrichmentCard:
- `bg-card/60 backdrop-blur-sm border border-border/20 rounded-2xl` (senza colori forti)
- Titoli sezione: `text-xs text-muted-foreground uppercase tracking-wider`
- Testi: `text-foreground` (niente azzurro/sky per testi normali)

#### 8. Aggiungere bottone "Note" nell'action bar
Aggiungere un pulsante Note che apre un dialog/area di testo per annotazioni rapide (salvataggio su tabella `interactions` con tipo `note`).

#### 9. Dettagli secondari — collapsible
Raggruppare Certificazioni, Filiali, Mercati Principali, Routing e Mappa in un `Collapsible` "Dettagli Avanzati" in fondo, per non ingombrare.

### File coinvolti
- `src/components/partners/PartnerDetailFull.tsx` — ristrutturazione completa

