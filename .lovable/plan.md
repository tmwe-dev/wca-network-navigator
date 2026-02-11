

## Pulizia e Semplificazione WCA - "Un Click e Via"

### Problema attuale
La gestione WCA e' frammentata e piena di roba inutile:
- La pagina **Impostazioni** ha campi username/password WCA che non servono (il login server-side non funziona per protezioni Cloudflare)
- Ci sono **3 posti diversi** dove incollare il cookie manualmente (Settings cookie fallback, ProxySetupGuide, pagina WCA)
- Il componente si chiama ancora "ProxySetupGuide" ma non c'e' nessun proxy
- La sidebar dice "WCA Proxy" invece di "WCA"
- Troppe istruzioni tecniche sparse ovunque

### Cosa cambia

**1. Pagina /wca - Diventa il centro di comando**
- Badge di stato grande e chiaro (Connesso / Non connesso)
- UN SOLO pulsante "Sincronizza Cookie" che apre una nuova finestra su wcaworld.com e poi l'utente clicca l'estensione Chrome
- Pulsante "Verifica Sessione" per ricontrollare
- Il metodo manuale (incolla cookie) resta nascosto in un dettaglio collassabile per emergenze
- Niente piu' istruzioni lunghe 4 passaggi sull'installazione dell'estensione: solo un link diretto

**2. Pagina Impostazioni - Pulizia totale**
- ELIMINATA la card "Credenziali WCA World" (username e password sono inutili, il login avviene dal browser)
- ELIMINATA la sezione "Inserimento cookie manuale (fallback)" duplicata
- La card "Sessione WCA" diventa compatta: solo semaforo di stato + link a /wca per gestire la connessione
- Resta la card WhatsApp che e' utile

**3. Componente ProxySetupGuide - Rinominato e semplificato**
- Rinominato in `WcaSessionCard`
- Mostra solo: indicatore di stato + pulsante "Vai a WCA" (link a /wca) + pulsante "Verifica"
- Rimosso tutto il codice per input cookie (quello si fa solo dalla pagina /wca)

**4. Sidebar**
- "WCA Proxy" rinominato in "WCA"

### Dettagli tecnici

**File modificati:**
- `src/pages/WCA.tsx` - Semplificato: status + sync button + verify + fallback nascosto
- `src/pages/Settings.tsx` - Rimossa card credenziali WCA, rimosso fallback cookie duplicato, card sessione punta a /wca
- `src/components/settings/ProxySetupGuide.tsx` - Rinominato in `WcaSessionCard.tsx`, semplificato a indicatore di stato + link
- `src/components/layout/AppSidebar.tsx` - Label "WCA Proxy" cambiata in "WCA"

**File eliminati:**
- Nessuno (il componente viene rinominato)

**Nessuna modifica alle Edge Functions** - la logica backend e' gia' corretta dopo l'ultimo fix.

