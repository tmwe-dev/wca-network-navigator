

# Indicatori Connessione LinkedIn, WhatsApp e AI nell'Header

## Cosa cambia

Un gruppo di icone di stato nella header principale (accanto ai bottoni esistenti) che mostra lo stato delle connessioni LinkedIn, WhatsApp e AI Agent. Ogni icona ha un pallino verde/rosso e cliccandola si attiva/disattiva la connessione.

## Implementazione

### 1. Nuovo componente `src/components/layout/ConnectionStatusBar.tsx`

Tre icone affiancate (Linkedin, MessageCircle, Bot) con:
- Pallino verde se `isAvailable`, rosso se no
- Click su LinkedIn: chiama `verifySession()` dal bridge — se fallisce, mostra toast con link alla pagina download estensione
- Click su WhatsApp: chiama `verifySession()` dal bridge — stesso pattern
- Click su AI Agent: toggle visivo (sempre attivo, indica che l'AI engine e' operativo)
- Tooltip su hover con stato ("LinkedIn connesso" / "WhatsApp non connesso — installa estensione")
- Usa i due hook esistenti `useLinkedInExtensionBridge` e `useWhatsAppExtensionBridge`

### 2. Modifica `src/components/layout/AppLayout.tsx`

- Importare `ConnectionStatusBar`
- Inserirlo nella header, tra `ActiveProcessIndicator` e i bottoni di destra
- Visibile solo su `sm:` e superiori per non affollare il mobile

### Comportamento

- All'apertura della pagina, i bridge fanno gia' polling ogni 3s — lo stato si aggiorna automaticamente
- Se l'estensione non e' installata: icona con pallino rosso, click mostra toast "Installa estensione" con link
- Se l'estensione e' installata e connessa: pallino verde, icona piena
- AI Agent: sempre verde (indica engine attivo), click apre il dialog AI assistant

### Stile

- Icone `w-4 h-4` con pallino `w-2 h-2` assoluto in basso a destra
- Verde: `bg-emerald-500`, Rosso: `bg-red-500`
- Sfondo trasparente, hover leggero come gli altri bottoni header

## File coinvolti

| File | Azione |
|------|--------|
| `src/components/layout/ConnectionStatusBar.tsx` | Nuovo |
| `src/components/layout/AppLayout.tsx` | Inserire nel header |

