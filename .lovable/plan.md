## 1) Cosa c'è oggi (diagnosi onesta)

La pagina `/v2/cockpit` ha tre colonne:

```text
┌─────────────┬───────────────────────────┬──────────────────────────┐
│  Sinistra   │         Centro            │        Destra            │
│ ContactStream│   ChannelDropZones        │  OraclePanelSlim (alto)  │
│ (380px)     │   (drop email/wa/li/sms)  │  + DraftQueue bar        │
│             │                           │  + AIDraftStudio (basso) │
└─────────────┴───────────────────────────┴──────────────────────────┘
```

I problemi reali, non opinioni:

- **Centro vuoto dopo il drop**: una volta trascinato il contatto, le drop zone restano lì occupando tutto lo spazio mentre la bozza viene generata a destra in una colonna stretta (`max-w-[480px]`). Lo spazio centrale diventa inutile.
- **Destra schiacciata in due metà**: Oracolo sopra (46–62%) + Studio sotto, divisi da un bordo. Goal, bottoni Genera/Migliora, KB sections, queue bulk, oggetto, corpo, allegati, badge agenti, footer azioni — tutto in 480px. Un casino.
- **Doppio "Migliora"**: ce ne sono due perché vivono in due componenti diversi che non si parlano:
  - quello in alto nell'OraclePanelSlim (footer dell'Oracolo) → chiama `handleOracleImprove` → `handleImprove`
  - quello in basso nell'AIDraftStudio (`AIDraftStudio.tsx` riga 137-146) → chiama lo stesso identico `onImprove` → `handleImprove`
  
  Sono **letteralmente** la stessa funzione. Uno dei due è un residuo del vecchio layout, va eliminato.

## 2) Flusso logico Genera (per 1 o N contatti)

Sequenza esatta che parte quando trascini un contatto su una drop zone (`useCockpitLogic.handleDrop`):

1. **Selezione destinatari**: se il contatto trascinato è già nella selezione multipla (`selection`), prende **tutta** la selezione; altrimenti solo quello.
2. **Auto-assignment** del contatto a un agente sales attivo (best-effort).
3. **LinkedIn (solo canale linkedin)**: verifica autenticazione bridge, cerca URL via Google se manca, salva URL in `enrichment_data` del partner. **Mai scraping diretto.**
4. **Genera prima bozza** chiamando `generate(...)` → `useEmailForge.run(...)` → edge function `generate-email`. Il payload include:
   - `partner_id`, `contact_id`, `recipient_name`, `recipient_company`, `recipient_countries`
   - `oracle_type`, `oracle_tone`, `use_kb`, `email_type_prompt`, `email_type_structure`, `email_type_kb_categories` ← letti da `useComposeAiConfig` (sidebar filtri sinistra)
   - `goal` = `customGoal` (testo dell'Oracolo) **+** prompt del tipo email selezionato
   - `base_proposal` = brief testuale (`briefToText(brief)`)
   - `quality` = preset Sherlock (Scout/Detective/Sherlock) da `useForgeLab`
5. **Bulk**: se erano selezionati N contatti, dopo il primo cicla in sequenza sui restanti chiamando lo stesso `generate(...)` per ciascuno, accumulando i risultati in `draftQueue`. Solo la bozza attiva è visibile, le altre stanno nella barra in alto a destra come chip cliccabili.
6. **Editorial review** è obbligatorio lato edge (`journalistReview`) — arriva nel risultato come `journalist_review` e viene mostrato come badge.

**Cosa viene effettivamente preso in considerazione:**
- ✅ `customGoal` (campo "OBIETTIVO DELLA MAIL" nell'Oracolo)
- ✅ Tipo email selezionato (sidebar) — prompt, struttura, kb_categories
- ✅ Tono (sidebar)
- ✅ Brief strutturato (sidebar accordion)
- ✅ Use KB on/off (sidebar)
- ✅ Quality / Sherlock preset (sidebar)
- ✅ Filtri attivi sui contatti (`activeFilters` → influenzano la lista, non il prompt)
- ❌ I `CockpitFilter` chip in alto NON vengono iniettati nel prompt, filtrano solo la lista contatti. Questa è una scelta corretta ma da rendere esplicita all'utente.

## 3) Differenza Genera vs Migliora

| Aspetto | Genera (`handleRegenerate`) | Migliora (`handleImprove`) |
|---|---|---|
| Edge function | `generate-email` | `generate-email` (stessa) |
| `base_proposal` inviato | brief testuale dalla sidebar | **il body attuale della bozza** |
| `goal` | customGoal + prompt del tipo email | customGoal + prompt del tipo email + frase fissa: *"MIGLIORA la bozza qui sotto mantenendo voce, intento e personalità dell'autore. Non riscrivere da zero."* |
| Subject/body iniziali | svuotati prima della chiamata | **mantenuti come fallback** se il risultato è vuoto |
| Links | non considerati | se ci sono link allegati, vengono iniettati nel goal con istruzione di usarli come `<a href>` |
| Effetto | scrive da zero | rifinisce mantenendo intento |

In pratica: **Genera** = bozza nuova partendo da zero usando brief + tipo + KB; **Migliora** = passa l'edge il testo già scritto come `base_proposal` e gli dice "rifinisci, non riscrivere". Stessa pipeline, parametri diversi.

## 4) Refactoring proposto — Centro + Destra

**Principio**: una colonna sola per "scrivere", drop zones solo quando serve, niente duplicazione di Genera/Migliora.

### Layout nuovo

```text
┌─────────────┬─────────────────────────────────────────────────────┐
│ Sinistra    │  CENTRO+DESTRA fuso in un'unica area "Workspace"   │
│ ContactStream│                                                     │
│             │  STATO A — nessun contatto attivo:                  │
│             │   ChannelDropZones a tutta larghezza + hint Oracolo │
│             │                                                     │
│             │  STATO B — contatto/i attivo/i:                     │
│             │   ┌──────────────────┬────────────────────────┐    │
│             │   │ Oracolo (goal +  │ Bozza viva             │    │
│             │   │ Genera/Migliora) │ (oggetto, corpo,       │    │
│             │   │ ~38%             │ allegati, send) ~62%   │    │
│             │   │                  │                        │    │
│             │   │ Tipo / Tono /    │ Tabs: Preview /        │    │
│             │   │ KB chip riassunto│ Sources / Variables    │    │
│             │   │                  │                        │    │
│             │   │ Footer: Genera + │ Footer azioni:         │    │
│             │   │ Migliora UNICI   │ Invia · Copia · Rigen. │    │
│             │   └──────────────────┴────────────────────────┘    │
└─────────────┴─────────────────────────────────────────────────────┘
```

### Cosa cambia in concreto

1. **`CockpitPage.tsx`**: collasso le due colonne destra/centro in una sola `flex-1`. Mostra ChannelDropZones a tutta larghezza solo quando `!draftState.contactId && !draftState.body`. Quando esiste una bozza (o sta generando), mostra l'unico Workspace a 2 colonne interne.
2. **Nuovo componente `CockpitWorkspace.tsx`**: contiene Oracolo (sinistra interna) + Bozza+Studio (destra interna). Riusa `OraclePanelSlim` e `AIDraftStudio` ma con gestione spazio coerente (no più 50/50 verticale).
3. **Eliminazione doppione "Migliora"**: in `AIDraftStudio.tsx` rimuovo il bottone giallo Migliora (righe 137-146) e tengo solo Invia / Copia / Rigenera. L'unico Migliora resta nel footer dell'Oracolo, dove logicamente appartiene (è un'azione AI, non un'azione di invio).
4. **Bulk queue**: la chip-bar `Bulk (N)` si sposta sopra la bozza nello Studio (più visibile, con conteggio "1/N").
5. **DropZones in stato B**: trasformo le 4 drop-zone in chip compatti sopra la bozza (Email · LinkedIn · WhatsApp · SMS) per cambiare canale al volo senza dover trascinare di nuovo. Quando trascini un nuovo contatto entra in modalità "drop" sovrapposta.
6. **Header Studio più ricco**: oltre a canale + nome, aggiungo bandiera, lingua, azienda, e link "apri scheda partner".
7. **Spaziatura**: l'area Oracolo non ha più altezza fissa percentuale — è `flex-col` con goal `flex-1` (cresce/si riduce libero), bottoni e chip in basso. Il problema dello "spazio per il goal" sparisce strutturalmente.

### Coerenza pipeline (cosa NON cambia)

- `useCockpitLogic` invariato: stessi `handleRegenerate`, `handleImprove`, `handleDrop`, stessa `draftQueue`.
- Edge function `generate-email` invariata.
- `useComposeAiConfig` (sidebar sinistra: tipo, tono, brief, KB, quality) invariato — i filtri restano lì.
- Nessun side-effect duplicato: bottone Migliora unico → una sola chiamata edge.

## 5) File toccati (preview)

- `src/v2/ui/pages/CockpitPage.tsx` — layout 2 colonne (sinistra contacts + destra workspace)
- `src/components/cockpit/CockpitWorkspace.tsx` — **nuovo**, orchestratore Oracolo+Studio
- `src/components/cockpit/AIDraftStudio.tsx` — rimozione bottone Migliora doppione, header arricchito, channel chips
- `src/components/email/OraclePanelSlim.tsx` — togliere prop `prioritizeGoal` (non più necessaria, lo spazio è gestito dal nuovo Workspace), goal `flex-1`
- `src/v2/ui/pages/CockpitPage.tsx` — rimozione hardcoded heights `46%` / `62%`

Nessuna modifica a hook, edge functions, DB, contesti AI, queue logic.
