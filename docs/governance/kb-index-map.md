# KB Index Map

> **Scopo:** dare all'AI (e all'umano) una **mappa navigabile** della Knowledge Base.
> Invece di leggere tutte le 200+ entry ogni volta, l'AI consulta questa mappa,
> sceglie le categorie/chapter rilevanti per l'intento, poi legge solo quelle.
>
> Documento vivo. Aggiornato quando si aggiungono categorie nuove o si rinominano chapter.

---

## 1. Categorie canoniche

Le 27 categorie attuali sono raggruppate in **6 famiglie canoniche** (audit 2026-05-02).
L'AI deve ragionare in famiglie, non in categorie singole.

| Famiglia        | Categorie sorgente                                                                            | Quando usarla                                                                                              |
|-----------------|-----------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------|
| **doctrine**    | `doctrine`, `system_doctrine`, `agent_doctrine`, `sales_doctrine`, `filosofia`, `regole_sistema` | Domande su "perché" facciamo qualcosa, principi non negoziabili, governance, regole AI invocation, hard guards |
| **procedures**  | `procedures`, `lab_architect_procedure`, `command_tools`, `email_management`                   | Domande su "come si fa", workflow operativi, sequenze di tool, gestione inbox                              |
| **personas**    | `voice_rules`, `tono`, `calligrafia`, `chris_voss`                                            | Definizione voce/tono di un agente, stile di scrittura, formule di apertura/chiusura                       |
| **playbooks**   | `cold_outreach`, `followup`, `negoziazione`, `obiezioni`, `chiusura`, `hook`, `frasi_modello`, `struttura_email`, `prompt_template`, `arsenale`, `persuasione` | Costruire un messaggio commerciale, A/B test, follow-up, handling obiezioni                  |
| **glossary**    | `errori`                                                                                       | Vocabolario sistema, errori comuni, termini tecnici interni                                                |
| **data-schema** | `dati_partner`                                                                                 | Struttura dati partner/contatti, campi disponibili, vincoli DB                                             |

---

## 2. Decision tree per intento

Quando l'AI riceve un task, consulta questa tabella per sapere **dove cercare**.

| Intento del task                                       | Famiglie da consultare (ordine)                  |
|--------------------------------------------------------|--------------------------------------------------|
| "Validare il blocco Identità di un agente"             | personas → doctrine                              |
| "Validare il blocco Obiettivo"                         | doctrine → procedures                            |
| "Validare il blocco Metodo"                            | procedures → playbooks                           |
| "Validare il blocco Guardrail"                         | doctrine → glossary                              |
| "Validare il blocco Output (formato)"                  | playbooks (struttura_email, frasi_modello)       |
| "Migliorare un'email commerciale"                      | playbooks → personas                             |
| "Capire una regola commerciale"                        | doctrine (sales_doctrine) → playbooks            |
| "Verificare una transizione di stato lead"             | doctrine → procedures                            |
| "Capire come usare uno strumento del Command"          | procedures (command_tools)                       |
| "Verificare schema dati partner/contatto"              | data-schema                                      |
| "Aggiungere nuovo materiale alla KB"                   | tutte (per detect duplicati/conflitti)           |

---

## 3. Mappa inversa: agente → famiglie KB

Generata dal `AGENT_REGISTRY` (`src/data/agentPrompts.ts`, campo `kbCategories`).
L'endpoint `kb-index-map` restituisce questa mappa in JSON aggiornato.

Esempi indicativi (vedi endpoint runtime per la versione live):

- **LUCA Director / agenti commerciali** → playbooks + doctrine + personas
- **Email Composer / improver** → playbooks + personas + procedures
- **Classifier (inbound, lead status, email groups)** → doctrine + procedures
- **Sherlock / Deep Search** → procedures + data-schema
- **Voice agent (ElevenLabs)** → personas + playbooks
- **Architect / Lab agents** → doctrine + procedures (lab_architect_procedure)

---

## 4. Come l'AI deve usare questa mappa

Sequenza obbligatoria nella chat copilota del Prompt Reader:

1. **Leggere il task** dell'utente (es. "rendi più severo il blocco Guardrail").
2. **Identificare l'intento** dalla tabella di sezione 2.
3. **Selezionare le famiglie KB** corrispondenti.
4. **Chiedere `kb-index-map`** per ricevere gli ID delle entry attive in quelle famiglie.
5. **Filtrare per `kbCategories` dell'agente target** (intersezione).
6. **Leggere solo gli ID risultanti** via `findKbEntries({ids})`.
7. **Restituire all'utente la lista esplicita di entry consultate** (audit trail).

Anti-pattern: leggere tutta la KB. Vietato: > 30 entry per task.

---

## 5. Aggiungere materiale nuovo

Quando l'utente incolla nuovo materiale nella tab "Aggiungi alla KB":

1. AI legge il contenuto.
2. Cerca **duplicati esatti** (full-text similarity > 0.85) → segnala `duplicates_of`.
3. Cerca **conflitti** (contenuto opposto su stesso chapter) → segnala `conflicts_with`.
4. Suggerisce categoria (preferisce le 6 famiglie canoniche), chapter, tags, priorità.
5. Salva in `kb_entry_proposals` (status pending). **Mai diretto in `kb_entries`.**
6. Operatore approva → record materializzato in `kb_entries`.

---

## 6. Riferimenti

- ADR 0004 — Prompt Governance Runtime Bundle (`docs/adr/0004-prompt-governance-runtime-bundle.md`)
- KB Doctrine Audit 2026-05-02 (`/mnt/documents/kb-doctrine-audit.md`)
- Endpoint runtime: `supabase/functions/kb-index-map/index.ts`
- Standard prompt 5-sezioni: `docs/prompt-standard.md`