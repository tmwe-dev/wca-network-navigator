# Studio architetturale: sistema grafico unico per tutte le maschere

Obiettivo: un solo linguaggio visivo e un solo scheletro di pagina, applicabile a tutte le maschere tranne le due a globo 3D (Globo/Mappa e Campagne), che restano full-bleed.

Questa fase produce **solo documenti + specifiche**. Nessuna pagina viene migrata ora.

## Cosa ho verificato oggi (stato reale)

- 91 pagine in `src/v2/ui/pages`.
- Adozione dei gusci attuali: **2** pagine usano `StandardPageFrame`, **16** usano `PageShell`, **22** usano `PageTitleHeader`, le restanti ~40 costruiscono l'header a mano.
- Esistono già 3 gusci concorrenti (`StandardPageFrame`, `PageShell`, `PageTitleHeader`) più `GoldenLayout`/`GoldenHeaderBar`: da qui nascono header diversi, spaziature diverse e doppioni di pulsanti.
- `layoutTokens.ts` definisce già altezze e z-index, ma **non** il colore: i colori sono liberi nelle pagine, da cui l'esplosione cromatica visibile nello screenshot.

## Decisioni prese (dalle tue scelte)

- **Palette**: Midnight Indigo ripulita — `#0a0a1a` sfondo, `#141432` superficie, `#1e1e5a` bordo/elevazione, `#4f46e5` unico accento. Viola, verde, ambra e rosso restano **solo** come stati semantici (successo, attenzione, errore, AI), mai come decorazione.
- **Layout base**: Dashboard a pannelli — header di pagina + rail contestuali + pannelli.
- **Densità: 2/5 (essenziale)** — in prima battuta si mostrano poche informazioni chiave; il resto vive dietro "Mostra dettagli", drawer o pannello secondario.

## Deliverable dello studio

### 1. Censimento pagina per pagina
Tabella con: pagina, guscio usato oggi, tipo di contenuto (elenco, dettaglio, form, monitor, editor, hub), numero di azioni in header, colori fuori palette. Serve a scoprire che le 91 maschere ricadono in poche famiglie ricorrenti.

### 2. Le famiglie di pagina (archetipi)
Previsti 6 archetipi, ognuno con wireframe testuale e regole:
- **Elenco → Dettaglio** (Partner, Contatti, Inbox, Rubriche)
- **Monitor / KPI** (Missioni Autopilot, Cockpit, Analytics, KPI)
- **Editor / Configurazione** (Persona, Prompt, Config, Strategie)
- **Flusso operativo** (Approvazioni, Sorting, Cestinone)
- **Hub di navigazione** (Lab, AI Staff, Agenti)
- **Full-bleed** (Globo, Campagne) — esclusi dal template, tocca loro solo la palette.

### 3. Contratto di pagina unico
Regole valide per ogni maschera:
- Un solo header: titolo/breadcrumb a sinistra, **max 3** azioni primarie a destra, tutto il resto in un menu "…".
- Il tasto AI sempre nella stessa posizione.
- Filtri sempre nel rail sinistro, workflow/azioni di contesto sempre nel rail destro; mai duplicati nel corpo pagina.
- Una sola gerarchia di testo (titolo, sezione, etichetta, valore, nota).
- Badge: massimo 2 visibili per riga/card, gli altri collassati in "+N".
- Livello 1 = informazione essenziale; livello 2 = dettagli a richiesta.

### 4. Sistema di colore semantico
Mappa completa: quale token per sfondo, superficie, bordo, testo, accento, stati (attivo/pausa/errore/successo), canali (email, WhatsApp, LinkedIn) e AI. Regola: nessun colore scritto a mano nelle pagine.

### 5. Prototipo di riferimento: Missioni Autopilot
La pagina viene ridisegnata **su carta** (wireframe + specifica) come esemplare dell'archetipo "Monitor / KPI", con prima/dopo dei suoi elementi. Serve da metro per tutte le altre.

### 6. Piano di migrazione a ondate
Ordine delle ondate, criterio di uscita per ogni ondata, e regola per non rompere le pagine funzionanti (nessuna modifica alla logica, solo presentazione).

## Note tecniche

- Documenti prodotti: `docs/design/censimento-maschere.md`, `docs/design/archetipi-pagina.md`, `docs/design/contratto-pagina.md`, `docs/design/token-colore.md`, `docs/design/prototipo-missioni-autopilot.md`, `docs/design/piano-migrazione.md`.
- I token colore vengono specificati come variabili HSL da inserire poi in `index.css` / `tailwind.config.ts`; in questa fase restano descritti nel documento, non applicati.
- `StandardPageFrame` è il candidato naturale a guscio unico: `PageShell` e `PageTitleHeader` verranno assorbiti in fase di migrazione, non ora.
- Nessuna modifica a routing, hook, DAL, edge function o database.

## Fuori perimetro

Migrazione delle pagine, modifiche alla logica, ridisegno del menu, pagine a globo 3D.
