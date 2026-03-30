

# Ristrutturazione Settings: Tab Orizzontali Ovunque

## Problema
Ogni sezione delle impostazioni impila card una sopra l'altra verticalmente. Risultato: confusione, devi scrollare tantissimo, vedi tutto insieme. Serve: **tab orizzontali**, una cosa per volta.

## Cosa cambia per ogni sezione

### 1. Generale (`GeneralSettings.tsx`)
Attualmente: WhatsApp + SMTP + Info SMTP + Test Email + Template + Profilo AI — tutto impilato.

Tab orizzontali:
- **WhatsApp** — numero telefono
- **Email SMTP** — configurazione server + test invio
- **Template** — TemplateManager
- **Profilo AI** — AIProfileSettings

### 2. Connessioni (`ConnectionsSettings.tsx`)
Attualmente: WCA status + Auto-Login + Verifica + Avanzate + LinkedIn credenziali + Estensione + Cookie avanzato + Blacklist — tutto impilato.

Tab orizzontali:
- **WCA** — status, auto-login, verifica, avanzate
- **LinkedIn** — credenziali, estensione, cookie avanzato
- **Blacklist** — BlacklistManager

### 3. Contenuti (`ContentManager.tsx`)
Attualmente: Accordion con Goal, Proposte, Documenti, Link tutti espandibili insieme.

Tab orizzontali:
- **Goal** — lista goal
- **Proposte** — lista proposte
- **Documenti** — upload e lista documenti
- **Link** — link di riferimento

### 4. Import/Export (`ImportExportSettings.tsx`)
Già ha tab orizzontali — OK, nessuna modifica.

### 5. Report Aziende (`RASettings.tsx`)
Attualmente: Credenziali + Estensione impilate.

Tab orizzontali:
- **Credenziali** — username/password
- **Estensione** — download e istruzioni

### 6. Abbonamento (`SubscriptionPanel.tsx`)
Attualmente: Piano + Crediti + Calcolatore token impilati.

Tab orizzontali:
- **Piano** — card tier + gestione
- **Crediti** — saldo + acquisto pacchetti
- **Token** — calcolatore costi

## File coinvolti

| File | Azione |
|------|--------|
| `src/components/settings/GeneralSettings.tsx` | Wrappare contenuti in Tabs con 4 tab |
| `src/components/settings/ConnectionsSettings.tsx` | Wrappare in Tabs con 3 tab |
| `src/components/settings/ContentManager.tsx` | Sostituire Accordion con Tabs a 4 tab |
| `src/components/settings/RASettings.tsx` | Wrappare in Tabs con 2 tab |
| `src/components/settings/SubscriptionPanel.tsx` | Wrappare in Tabs con 3 tab |

Ogni sezione mostra **una sola vista per volta**, selezionata dal tab orizzontale in alto. Zero scroll infinito, zero confusione.

