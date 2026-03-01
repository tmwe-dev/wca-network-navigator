

## Piano: Riorganizzazione tab Impostazioni

### Struttura attuale (10 tab)
Generale, Email, Connessioni, Import/Export, Blacklist, Report Aziende, Template, Contenuti, Profilo AI, Abbonamento

### Nuova struttura (6 tab)

| Tab | Contenuto |
|-----|-----------|
| **Generale** | WhatsApp + Email SMTP + Test invio + Template/Allegati + Profilo AI |
| **Contenuti** | Goal + Proposte + Documenti + Link (invariato) |
| **Connessioni** | WCA + LinkedIn + Blacklist (spostata qui dentro WCA) |
| **Import / Export** | Invariato |
| **Report Aziende** | Invariato |
| **Abbonamento** | Invariato |

### Modifiche in `src/pages/Settings.tsx`

1. **Rimuovere le tab**: Email, Blacklist, Template, Profilo AI
2. **Tab Generale** — aggiungere sotto la card WhatsApp:
   - Sezione Email SMTP (spostata da tab "email")
   - Sezione Test Invio
   - Sezione Template (`<TemplateManager />`)
   - Sezione Profilo AI (`<AIProfileSettings />`)
3. **Tab Connessioni** — aggiungere in fondo:
   - Sezione Blacklist (`<BlacklistManager />`)
4. **Aggiornare la `TabsList`** con solo 6 voci

### File da modificare
1. `src/pages/Settings.tsx` — riorganizzare tab e spostare contenuti

