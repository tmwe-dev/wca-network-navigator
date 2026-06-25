# Riscrittura Guida Sistema (/v2/guida)

## Obiettivo
Trasformare la Parte 2 (tutorial) in una guida operativa **a capitoli sequenziali** che segue esattamente il menu reale a 7 macro-aree (Comando, Esplora, Pipeline, Comunica, Cervello, Lab, Config). Ogni capitolo spiega cosa fa la sezione, come si usano le operazioni e fornisce una **checklist di test** per verificare che tutto funzioni. Capitoli dedicati a gestione agenti, configurazione intelligenza e automazioni.

## Cosa NON cambia
- Parte 1 (istituzionale: Vision, Ciclo Autonomo, Sicurezza, Outreach, Performance ecc.) resta com'è.
- Infrastruttura grafica: `GuidaLayout`, nav dots, scroll-snap, progress bar — invariati.
- Nessuna modifica a logica, routing, edge function. Lavoro 100% su contenuti UI della guida.

## Nuovo componente: `TutorialChapter`
Estensione di `TutorialSection` (nuovo file `src/components/guida/TutorialChapter.tsx`) che aggiunge a quanto già presente:
- **Numero capitolo** + nome macro-area (es. "CAP. 03 · COMUNICA").
- Blocco **"Operazioni possibili"** (lista azioni concrete).
- Blocco **"Test di verifica"** — checklist passo-passo con esito atteso (es. "Apri X → clicca Y → deve comparire Z").
- Path della pagina mostrato come breadcrumb cliccabile (solo visivo).
Riusa `SectionWrapper`, `ScreenshotFrame`, token semantici (niente colori hardcoded).

## Struttura dei capitoli (sequenza = ordine menu reale)

```text
PARTE 2 — TUTORIAL OPERATIVO

CAP. 0  Come usare questa guida / legenda test
CAP. 1  COMANDO
        1a Command (AI-native, linguaggio naturale, tool+fonti, voce)
        1b Missioni Autopilot (KPI, budget, approvazioni)
CAP. 2  ESPLORA
        2a Network / Esplora partner (filtri, deep search, batch)
CAP. 3  PIPELINE
        3a Cockpit (Kanban lead, stage, azioni)
        3b Agenda (reminder, follow-up)
        3c Cestinone (soft-delete, ripristino)
CAP. 4  COMUNICA
        4a Comms (WhatsApp + LinkedIn stealth sync)
        4b Inbox (lettura, classificazione)
        4c Email (composer, invio, editorial review)
        4d Email Intelligence (classificazione risposte, escalation)
        4e Funnemail (claim/sorting)
        4f Rubriche WhatsApp / LinkedIn
CAP. 5  CERVELLO
        5a Gestione Agenti (creazione, persona, capabilities, tool)
        5b Intelligence (configurazione IA: provider, voce, memoria, KB)
CAP. 6  LAB
        6a Prompt Lab, test prompt, observability, design system
CAP. 7  CONFIG
        7a Settings (tab reali: Generale, Connessioni, Estensioni, Voce AI,
           Provider AI, Token AI, Memoria AI, Operatori, Ruoli…)
CAP. 8  AUTOMAZIONI (trasversale)
        Ciclo autonomo end-to-end: lead → outreach → follow-up →
        classificazione, holding pattern, cron sync, guardrail di costo
```

## Contenuto per ogni capitolo
1. **Cosa fa** — descrizione funzionale chiara.
2. **Operazioni possibili** — elenco azioni concrete eseguibili.
3. **Come si fa** — passi principali del flusso.
4. **Test di verifica** — checklist con azione → risultato atteso, per confermare il corretto funzionamento.
5. **Mockup** visivo coerente coi token del tema.

I contenuti verranno derivati dalle pagine reali (navConfig, registry, componenti delle pagine) per essere accurati e non inventati.

## File toccati
- `src/components/guida/TutorialChapter.tsx` — NUOVO componente capitolo con blocchi operazioni + test.
- `src/v2/ui/pages/GuidaPage.tsx` — sostituzione della Parte 2: nuova `sectionLabels` e nuovi capitoli sequenziali; Parte 1 e Chiusura invariate.
- (eventuale) `src/components/guida/TestChecklist.tsx` — sotto-componente riusabile per le checklist di test.

## Verifica finale
- `tsgo` typecheck verde.
- Smoke: `/v2/guida` carica senza crash, nav dots = numero capitoli, scroll e snap funzionanti (Playwright screenshot di alcuni capitoli).
