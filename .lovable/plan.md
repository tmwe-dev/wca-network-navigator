

# LOVABLE-76B: Semplificazione Email Forge

## Obiettivo
3 click per generare: destinatario → tipo → **Genera**. Tutto il resto è opzionale e collassato.

## Stato attuale (verificato)
- `EmailForgePage.tsx`: 3 pannelli resizable (`ForgeSummaryPanel` 22% · `PromptInspector` 48% · `ResultPanel` 30%) + footer `LabBottomTabs` con 5 sotto-tab.
- La configurazione (`ForgeOraclePanel`) **non è nella pagina**: sta nel `FiltersDrawer` globale (linguetta laterale). L'utente deve aprire un drawer per scegliere destinatario/tipo. Questo è un livello di indirezione di troppo.
- `DeepSearchTab`: 3 preset + 8 toggle granulari sempre visibili + dominio prioritario.
- `ResultPanel`: 3 tab (Preview/HTML/Raw); metriche già in linea ma sparse nel body.

## Nuovo layout (2 pannelli, no drawer per le scelte base)

```text
┌─ SINISTRA 35% (ForgeOraclePanel snello) ─┬─ DESTRA 65% (Output) ──────────────┐
│  Destinatario  [picker]                  │  Tabs: [Risultato] [Prompt] [AI]   │
│  Tipo email    [4 bottoni grandi]        │                                    │
│                "Altri tipi ▾"            │  Risultato: Subject + Preview      │
│  Obiettivo     [textarea 2 righe]        │     ↳ inner tabs Preview / Codice  │
│                                          │  Prompt: PromptInspector           │
│  ▸ Opzioni avanzate (collapsed)          │  AI: 5 sotto-tab (KB/Sender/...)  │
│     Tono · Quality · KB · BaseProposal   │                                    │
│     Brief · Deep Search + badges         │                                    │
│                                          │                                    │
│  [GENERA EMAIL]  (h-12, full width)      │                                    │
└──────────────────────────────────────────┴────────────────────────────────────┘
Footer: 1 riga sottile  →  model · quality · latency · tokens · crediti
```

## File da modificare

### 1. `src/v2/ui/pages/EmailForgePage.tsx`
- Rimuovere import e uso di `ForgeSummaryPanel` e `LabBottomTabs` dal layout.
- Sostituire i 3 pannelli con 2: `ForgeOraclePanel` a sinistra (35/30/45 default), `ForgeOutputPanel` (nuovo) a destra.
- `ForgeOraclePanel` passa `onRun` → chiama `forge.run(buildBaseParams())` direttamente (niente più dipendenza dal drawer per generare).
- Header: rimuovere il sottotitolo "Apri la linguetta filtri…" — non più vero.
- Bottone "Configura" (apri drawer) → mantenuto come scorciatoia opzionale ma testo "Filtri globali" (il drawer resta utile per altri scope).
- Bottone "Genera + Ispeziona" in header → rimosso (ora è dentro il pannello sinistro come CTA grande).
- Footer compatto (1 riga, `text-xs text-foreground/60`): `model · quality · latency · tokens · crediti`.

### 2. `src/v2/ui/pages/email-forge/ForgeOraclePanel.tsx` (rivisto)
- Mantenere il file ma riorganizzare le sezioni:
  - **Sempre visibili**: Destinatario · Tipo email (grid 2 colonne, primi 4 tipi, link "Altri tipi ▾" che espande la lista completa) · Obiettivo (textarea 2 righe) · **CTA GENERA** (h-12, full width, prominente).
  - **Collapsible "Opzioni avanzate"** (chiusa di default): Tono · Quality · Switch KB · Proposta base · Brief (se serve) · toggle "Deep Search aggiuntiva" con `EnrichmentStatusBadges`.
- Si sincronizza ancora con `forgeLabStore` per mantenere i valori coerenti col drawer (chi vuole può cambiarli da entrambi i lati).

### 3. `src/v2/ui/pages/email-forge/ForgeOutputPanel.tsx` (NUOVO)
- Wrapper con 3 tab di primo livello:
  - **Risultato** (default): `ResultPanel` semplificato (subject + body con sotto-tab Preview/Codice).
  - **Prompt**: `PromptInspector` (riusa il componente esistente).
  - **AI** (Cosa legge l'AI): contenuto attuale di `LabBottomTabs` (5 sotto-tab Tabs annidati: KB, Mittente, Dottrina, Prompt, Storico) + bottone "Apri Sherlock".

### 4. `src/v2/ui/pages/email-forge/ResultPanel.tsx`
- Rimuovere tab "Raw" (`full_content` ridondante).
- Rinominare "HTML" → "Codice".
- Spostare la striscia metriche fuori dal body: ora è nel **footer di pagina** in `EmailForgePage`. Il pannello mantiene solo subject + tab Preview/Codice + (opzionale) `OracleContextPanel` collassato in fondo.

### 5. `src/v2/ui/pages/email-forge/tabs/DeepSearchTab.tsx`
- 3 bottoni preset diventano la **scelta primaria** (card grandi con icona+label+descrizione).
- 8 toggle granulari + dominio prioritario → spostati dentro un `Collapsible` "Personalizza fonti (avanzato)" chiuso di default.

### 6. `src/v2/ui/pages/email-forge/LabBottomTabs.tsx` → rimosso uso, file mantenuto
- File preservato (governance: `mem://project/development-status-governance`) ma non più importato in `EmailForgePage`. Il suo contenuto vive nella tab "AI" del nuovo `ForgeOutputPanel`.

### 7. `src/v2/ui/pages/email-forge/ForgeSummaryPanel.tsx` → rimosso uso, file mantenuto
- File preservato per stesso motivo, ma rimosso dall'import in `EmailForgePage`. Le info che mostrava sono ridondanti rispetto a `ForgeOraclePanel`.

## Dettagli UI / contrasto
- Bottoni tipo email: `bg-card border border-border/60 text-foreground/80` (inattivo) · `bg-primary text-primary-foreground` (attivo). No grigio illeggibile.
- CTA Genera: `h-12 text-base font-semibold w-full`, sempre visibile in fondo al pannello sinistro (sticky bottom).
- Collapsible trigger: `text-xs text-foreground/70 hover:text-foreground` con chevron.
- Footer pagina: `border-t border-border/60 px-3 py-1.5 text-xs text-foreground/60 flex items-center gap-3`.

## Constraints rispettati
- ✅ Token semantici (no HEX, no grigi sotto WCAG AA — già fixed in 76A)
- ✅ Nessuna modifica a edge functions, DB, hook business
- ✅ File "rimossi dall'uso" preservati (no delete fisico)
- ✅ `forgeLabStore` invariato → backward compatible col drawer
- ✅ Tipi strict, no `any`

## Cosa otterrai
- Apertura Email Forge → vista immediata: destinatario, 4 tipi email, obiettivo, **GENERA**. Niente altro.
- Risultato a destra (Preview di default), prompt e contesto AI a un click.
- Deep Search: 3 preset chiari, niente "Google Maps sì/no" in faccia al primo accesso.
- Footer riga sola con metriche tecniche (model/latency/tokens) — visibile ma non invadente.
- Da 3 pannelli + footer + 5 tab annidati a **2 pannelli + footer + 3 tab top-level**.

