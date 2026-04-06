

# Miglioramento Card Contatti Cockpit + Menu Azioni

## Problemi identificati

1. **Icona globo (🌍) inutile** — il flag del paese è sufficiente, il globo aggiunge solo rumore
2. **Icona AI (Sparkles) mal posizionata** — sta in mezzo al nome, dovrebbe essere in basso a sinistra o in alto a destra
3. **Layout card disordinato** — troppi elementi ammassati senza separazione chiara tra sezioni
4. **Enrichment non sempre visibile** — quando il deep search è stato fatto, non si vede chiaramente lo stato di ogni componente (LinkedIn ✓, Sito ✓, ecc.)
5. **Menu 3 pallini (ContactActionMenu)** — mancano opzioni importanti e gli item sono disallineati
6. **Nessuna ricerca logo Google** dalla card

## Interventi

### A. Ristrutturare il layout della CockpitContactCard

**File**: `src/components/cockpit/CockpitContactCard.tsx`

Riorganizzare la card in 3 sezioni verticali chiare:

```text
┌──────────────────────────────────────────────┐
│ ☐ ⠿  Nome Contatto  ✨(se enriched)   🟢 BCA │
│       Azienda Srl                        P6  │
│       Managing Director                      │
│       5a membro · Air/Ocean · Senior         │
├──────────────────────────────────────────────│
│  Manuale · english · 4 giorni fa             │
│  📧  in  💬  📱           [avatar agente]    │
├──────────────────────────────────────────────│
│  Enrichment: 🔗LinkedIn ✓  🌐Sito ✓  📋AI ✓ │
└──────────────────────────────────────────────┘
```

Modifiche specifiche:
- **Rimuovere** il flag `{flag}` dalla riga del nome (è già visibile nel badge paese/origine)
- **Spostare Sparkles** in alto a destra, accanto al badge origine, come indicatore di enrichment completato
- **Aggiungere riga enrichment status** sotto i canali: micro-badge per ogni componente (LinkedIn, Website, AI) con ✓ verde se fatto, grigio se mancante
- **Aggiungere bottone logo search**: piccola icona immagine cliccabile che cerca il favicon/logo via Google (`google.com/s2/favicons?domain=...`) se c'è un website nell'enrichment data

### B. Ampliare il ContactActionMenu

**File**: `src/components/cockpit/ContactActionMenu.tsx`

Aggiungere le opzioni mancanti al menu 3 pallini:

| Opzione | Icona | Azione |
|---------|-------|--------|
| **Invia email ora** | Mail | Naviga a `/email-composer` con recipient precompilato |
| **Invia WhatsApp** | MessageCircle | Apre `wa.me/{phone}` se disponibile |
| **Programma invio** | CalendarClock | Già presente — mantiene |
| **Aggiungi nota** | StickyNote | Già presente — mantiene |
| **Segna come svolta** | CheckCircle2 | Già presente — mantiene |
| **Programma data contatto** | Calendar | Nuovo: crea attività `follow_up` con data futura senza rimuovere dal cockpit |

Miglioramenti di allineamento:
- Padding uniforme su tutti gli item (`px-3 py-2`)
- Icone tutte a `w-4 h-4` con `gap-2.5`
- Separatori tra gruppi logici (Comunicazione / Organizzazione / Completamento)

### C. Migliorare il pannello espanso enrichment

Quando la card è espansa e l'enrichment è stato fatto, mostrare lo stato di ogni componente in modo chiaro:

```text
Enrichment completato il 05/04/2026
├ 🔗 LinkedIn: trovato ✓    [link]
├ 🌐 Website: scraping OK ✓
├ 🖼 Logo: disponibile ✓    [preview]
└ 📋 Analisi AI: completata ✓
```

Se qualche componente manca, mostrare il pulsante per avviarlo individualmente.

## File coinvolti

| File | Azione |
|------|--------|
| `src/components/cockpit/CockpitContactCard.tsx` | Ristrutturazione layout, rimozione globo, riposizionamento AI icon, aggiunta riga enrichment status |
| `src/components/cockpit/ContactActionMenu.tsx` | Aggiunta opzioni (email, WhatsApp, programma data), fix allineamento items |

