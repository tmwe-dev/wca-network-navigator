

## Deep Search Canvas - Piano di Implementazione

### Obiettivo
Creare un canvas visivo che mostra in tempo reale i risultati della Deep Search mentre processa ogni partner: logo trovato, profili LinkedIn, dati aziendali, social links, rating calcolato. Visibile con un click, stile terminale ma con dati strutturati.

### Componente nuovo: `src/components/operations/DeepSearchCanvas.tsx`

Un pannello che si apre come overlay (simile al detail overlay già esistente) o come pannello laterale, mostrando:

- **Header**: progresso globale (3/12 partner), barra percentuale, pulsante Stop
- **Card partner corrente** (animata, in primo piano):
  - Logo (appare quando trovato, con animazione fade-in)
  - Nome azienda + bandiera paese
  - Sezione contatti: per ogni contatto mostra LinkedIn trovato/non trovato, Facebook, Instagram, WhatsApp con icone colorate
  - Seniority estratta (senior/mid/junior badge)
  - Background professionale trovato (1-2 righe)
  - Company profile: awards, specialties, news
  - Rating calcolato (stelle animate)
  - Website scoperto (se nuovo)
- **Cronologia partner precedenti** (compatta, scroll verso l'alto): mini-card con logo + nome + risultati sintetici (icone: quanti social trovati, rating)

### Modifiche a `src/pages/Operations.tsx`

1. Nuovo stato: `deepSearchResults: DeepSearchResult[]` - array di risultati accumulati
2. Nuovo stato: `deepSearchCanvasOpen: boolean` - toggle visibilita canvas
3. Nuovo stato: `deepSearchCurrent: { partnerId, companyName, index, total } | null`
4. Modificare `handleDeepSearch`: prima di invocare l'edge function, settare il partner corrente; dopo la response, pushare il risultato nell'array
5. Il canvas si apre automaticamente quando parte la deep search, chiudibile con X

### Flusso dati

Il loop esistente in `handleDeepSearch` (riga 85-103) gia processa sequenzialmente. Per ogni iterazione:
1. **Pre-call**: fetch partner name/logo dal DB locale (gia in cache react-query) → mostra card "in ricerca" con spinner
2. **Post-call**: la response dell'edge function restituisce `{ socialLinksFound, logoFound, contactProfilesFound, companyProfileFound, rating, companyName }` → aggiorna la card con i risultati trovati
3. **Transizione**: dopo 1.5s, la card corrente scorre nella cronologia e si prepara la prossima

### Struttura tecnica

```text
┌─────────────────────────────────────┐
│ 🔍 Deep Search  3/12    [Stop] [X] │
│ ████████░░░░░░░░░░  25%             │
├─────────────────────────────────────┤
│                                     │
│  [logo]  Airone Log Sh.p.k  🇦🇱    │
│  ─────────────────────────────      │
│  👤 John Smith                      │
│    🔗 LinkedIn ✓  📘 Facebook ✗    │
│    📸 Instagram ✗  💬 WhatsApp ✓   │
│    🏷 Senior · Operations Manager  │
│    📝 "10+ years in Balkans..."     │
│                                     │
│  🏢 Company Profile                │
│    🏆 Awards: ISO 9001, IATA       │
│    ⭐ Rating: ★★★★☆ (4/5)         │
│    🌐 Website: airone-log.al        │
│                                     │
├── Completati ───────────────────────┤
│ ✅ ABC Logistics    🔗2 ⭐3        │
│ ✅ XYZ Freight      🔗4 ⭐5        │
└─────────────────────────────────────┘
```

### File da creare/modificare

| File | Azione |
|------|--------|
| `src/components/operations/DeepSearchCanvas.tsx` | **Nuovo** - componente canvas completo |
| `src/pages/Operations.tsx` | Aggiungere stati, modificare `handleDeepSearch`, renderizzare canvas |

### Dettagli implementativi

- Il canvas si posiziona come overlay nel pannello centrale (stessa posizione del detail overlay), z-index superiore
- Tema dark/light coerente con il resto di Operations (usa `t(isDark)`)
- Auto-scroll sulla cronologia completati
- Animazioni: fade-in per ogni dato trovato, pulse per elemento in ricerca
- Il canvas rimane visibile dopo il completamento per review, chiudibile con X
- Pulsante "eye" nella barra di progresso deep search per toggle canvas quando minimizzato

