## Contesto salvato

Config login TMWE (sandbox.findair.net + ritorno nel pannello destro, no popup, no nuova tab) è ora fissata in `mem://auth/tmwe-login-config-2026-07-17`. Non verrà più regredita.

## Obiettivo dell'audit

Verificare, per ogni voce del menu principale V2, che la pagina:
1. Carichi senza errori runtime (console + network).
2. Rispetti il guscio SSOT (`StandardPageFrame` / rail sx filtri / rail dx workflow secondo `pageContract.ts`).
3. Esponga funzioni coerenti con il nome della voce (niente doppioni, niente pagine "vuote").
4. Non contenga bottoni orfani, tab morti, o CTA che portano a rotte inesistenti.
5. Sia allineata al tema (light/dark) e responsive.

## Perimetro (SSOT: `FULL_NAV_ITEMS` in `navConfig.tsx`)

17 voci raggruppate in 7 macro-aree:

```text
COMANDO      Command · Missioni
ESPLORA      Vendi (explore/network)
PIPELINE     Autorizza (cestinone) · Cockpit · Agenda
COMUNICA     Comms · Leggi (inbox) · Scrivi (email) · Funnemail · Funnemail Inbox · Rubrica WhatsApp · Rubrica LinkedIn
CERVELLO     Agenti · Intelligence
LAB          Lab
CONFIG       Config (settings)
```

## Metodo per ciascuna voce (batch da 3-4 per turno)

Per pagina produco una scheda audit con:

- **Rotta + file sorgente**
- **Stato caricamento** (Playwright + console/network log)
- **Aderenza guscio** (header unico? rail corretti? tabs pill?)
- **Funzioni presenti vs attese** (mappa button → azione → esito)
- **Difetti** classificati: `blocker` / `bug` / `ux` / `debito`
- **Fix minimo proposto** (solo presentazione salvo bug critici)

Output finale: un unico documento `docs/audit/menu-audit-2026-07-17.md` con:
- indice per macro-area
- semaforo per pagina (verde/giallo/rosso)
- backlog fix prioritizzato

## Piano di esecuzione (autonomo, un batch per turno)

1. **Batch 1 — Comando**: Command, Missioni.
2. **Batch 2 — Esplora + Pipeline**: Vendi, Autorizza, Cockpit, Agenda.
3. **Batch 3 — Comunica (parte 1)**: Comms, Leggi, Scrivi.
4. **Batch 4 — Comunica (parte 2)**: Funnemail, Funnemail Inbox, Rubrica WhatsApp, Rubrica LinkedIn.
5. **Batch 5 — Cervello + Lab + Config**: Agenti, Intelligence, Lab, Config.
6. **Consolidamento**: documento finale + backlog fix ordinato.

## Regole operative durante l'audit

- Nessuna modifica di logica: solo osservazione + micro-fix di presentazione se banali (import morti, testo troncato, tab rotto).
- Ogni bug su nodo critico (submit, invio email/WA/LI, auth, RLS) va registrato ma NON toccato in questo audit — apre issue nel backlog.
- Uso Playwright headless su `http://localhost:8080` con sessione TMWE già iniettata.

Confermi che parto direttamente dal Batch 1 (Comando)?
