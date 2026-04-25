# Guida — Come preparare i documenti per il sistema AI

> Documento operativo per chi prepara contenuti destinati all'Armonizzatore (Prompt Lab → Armonizza tutto) e, in generale, a tutti gli agenti AI della piattaforma.
>
> Obiettivo: fornire al modello documenti **categorizzati, etichettati e taggati** in modo che vengano riconosciuti come entità singole, salvati nelle tabelle giuste e collegati al contesto corretto.

---

## 1. Principi base

Il sistema AI tratta ogni documento come una sequenza di **entità**. Una entità =

- un blocco di testo autosufficiente
- con un titolo riconoscibile
- con metadati che dicono "dove va salvato" e "a chi serve"

Se il documento è scritto come un blocco continuo, il modello fatica a separarlo e tende a creare INSERT spuri o duplicati. Se invece è strutturato, ogni voce viene processata in micro-call dedicate (~2K token), il riconoscimento è preciso e i costi crollano.

**Regole d'oro**

1. **Una entità = una sezione `## Titolo`**. Mai mescolare due dottrine nello stesso heading.
2. **Sempre includere i metadati** subito sotto il titolo (categoria, capitolo, priorità).
3. **Niente placeholder o stub**. Il sistema rifiuta esplicitamente file di tipo "Sostituire questo file con la libreria reale".
4. **Lunghezza minima per entità**: ~80 parole. Sotto questa soglia il blocco viene marcato `needs_review`.
5. **Lunghezza massima per entità**: ~1.500 parole. Oltre, splittare in più sezioni `##`.

---

## 2. Formato file accettati

| Formato | Estensione | Quando usarlo |
|---|---|---|
| Markdown | `.md` | **Preferito**. Massima leggibilità + struttura nativa per heading. |
| Testo semplice | `.txt` | Solo per liste flat di brevi voci (es. blacklist termini). |
| Word | `.docx` | Accettato, ma viene convertito a markdown internamente: i tracked changes vengono persi. |
| PDF | `.pdf` | Sconsigliato per dottrine. OK per allegati di riferimento (manuali). |
| JSON | `.json` | Solo per export strutturati (es. seed di tabelle), non per dottrine narrative. |

**Encoding obbligatorio**: UTF-8 senza BOM. Niente Windows-1252.

**Lunghezza file**: fino a ~80.000 token totali (~250.000 caratteri). Oltre, splittare in più file e processarli in sessioni separate.

---

## 3. Struttura canonica di una entità

Ogni entità deve seguire questo schema:

```markdown
## 📄 Titolo univoco e parlante
**Categoria suggerita:** doctrine
**Capitolo:** c1
**Priorità:** 80
**Tabella target:** kb_entries
**Tag:** governance, persona, agent

Contenuto narrativo della voce. Da 80 a 1500 parole.
Spiegare cosa, perché, quando, chi, come.

### Esempi (opzionale ma raccomandato)
- Esempio concreto 1
- Esempio concreto 2

### Anti-esempi (opzionale)
- Cosa NON fare
```

### Metadati obbligatori

| Campo | Valori ammessi | Note |
|---|---|---|
| `Categoria suggerita` | `doctrine` · `system_doctrine` · `sales_doctrine` · `procedures` · `playbook` · `glossary` · `policy` · `template` | Usare le categorie esistenti del DB. Categorie nuove vanno proposte separatamente. |
| `Capitolo` | `c0` … `c12` | Codice del macro-tema. Usare lo stesso capitolo per voci correlate. |
| `Priorità` | numero 0–100 | 90+ = Legge Fondamentale (sempre iniettata nel contesto). 70–89 = importante. 50–69 = standard. <50 = referenza. |
| `Tabella target` | nome tabella DB | Vedi sezione 5. Se non sei sicuro, scrivere `kb_entries` (default). |

### Metadati opzionali

| Campo | Quando usarlo |
|---|---|
| `Tag` | Lista parole chiave separate da virgola. Usate per cross-reference e filtri agente. |
| `Lingua` | `it` (default) · `en` · `es` · `fr` · `de` |
| `Validità` | `permanent` · `temporary` · `experimental` |
| `Owner` | nome del referente umano (per tracciabilità) |
| `Versione` | semver (`1.0.0`) — utile per dottrine in evoluzione |
| `Sostituisce` | titolo della voce precedente che questa rimpiazza |
| `Riferimenti` | lista di altri titoli `## ...` collegati |

---

## 4. Sistema di categorizzazione

### Le 8 categorie principali

1. **doctrine** — Principi commerciali, valori, posizionamento. Vincolanti per tutti gli agenti.
2. **system_doctrine** — Regole tecniche e architetturali (es. "no physical delete", "RLS obbligatoria").
3. **sales_doctrine** — Tattiche di vendita, gestione obiezioni, qualifiche lead.
4. **procedures** — Sequenze step-by-step (es. "come gestire una richiesta di quotazione spot").
5. **playbook** — Scenari completi end-to-end (es. "playbook lead inbound da fiera").
6. **glossary** — Definizioni di termini interni (es. "WCA ID", "Holding Pattern").
7. **policy** — Regole di compliance e legali (GDPR, blacklist, no-spam).
8. **template** — Modelli riutilizzabili (email, messaggi WhatsApp, script di chiamata).

### Schema decisionale rapido

- È una regola che NON deve mai essere violata? → **doctrine** o **policy**
- È una sequenza operativa? → **procedures** o **playbook**
- È un termine da definire? → **glossary**
- È un testo riutilizzabile? → **template**
- È vincolante per il codice/architettura? → **system_doctrine**

---

## 5. Mappatura entità → tabella DB

Quando il documento contiene voci destinate a tabelle specifiche, dichiararlo nei metadati. Questo evita che l'AI proponga `INSERT` su `kb_entries` per contenuti che dovrebbero stare altrove.

| Tipo di contenuto | Tabella target | Note |
|---|---|---|
| Dottrine, principi, knowledge generale | `kb_entries` | Default per tutto ciò che non è strutturato. |
| Configurazione persona di un agente (tono, vocabolario do/dont) | `agent_personas` | Riferimento all'agente nel campo `agent_id`. |
| Anagrafica agente (nome, ruolo, system prompt) | `agents` | Modifica delicata: usa Tabella target solo se sai cosa fai. |
| Prompt operativi strutturati | `operative_prompts` | Per blocchi di prompt riutilizzabili. |
| Template email | `email_prompts` | Include subject + body + tone. |
| Regole di routing/firma per indirizzo email | `email_address_rules` | Sender policy. |
| Playbook commerciali multi-step | `commercial_playbooks` | Strutturati a fasi. |
| Configurazione applicazione | `app_settings` | Modifiche di impostazione, non dottrine. |

---

## 6. Etichettatura e tagging

I tag servono al sistema di **iniezione contestuale**: quando un agente AI risponde su un certo argomento, il motore RAG cerca le voci con tag corrispondenti e le inietta nel prompt.

### Convenzioni tag

- **minuscolo, kebab-case**: `lead-inbound`, `quotazione-spot`, `gestione-obiezioni`
- **massimo 5 tag per voce**
- **niente tag di formato** (no `markdown`, no `documento`)
- **preferire tag di dominio**: `cargo-air`, `cargo-sea`, `cargo-road`, `customs`, `wca`, `ftl`, `ltl`
- **tag di urgenza ammessi**: `critical`, `legge-fondamentale`, `deprecated`

### Tag riservati al sistema

Da NON usare manualmente — sono assegnati dagli agenti:

- `ai-generated`
- `learned-from-correction`
- `pending-review`
- `auto-promoted`

---

## 7. Cross-reference fra entità

Per dichiarare che due entità sono collegate, usare il blocco `### Riferimenti` alla fine della voce:

```markdown
### Riferimenti
- → "Gestione obiezione prezzo" (sales_doctrine, c4)
- → "Persona Luca — tono" (agent_personas)
- ← "Playbook inbound fiera" (playbook, c2)
```

Convenzioni frecce:

- `→` questa voce dipende dall'altra
- `←` l'altra dipende da questa
- `↔` relazione bidirezionale

L'Armonizzatore registra questi riferimenti nella tabella `cross_references` e li usa per evitare modifiche che spezzerebbero collegamenti.

---

## 8. Gestione conflitti e versioning

Se la nuova versione di un documento contraddice una entità già esistente nel DB, dichiararlo esplicitamente:

```markdown
## 📄 Politica sconti spot 2026
**Categoria suggerita:** sales_doctrine
**Capitolo:** c4
**Priorità:** 85
**Sostituisce:** "Politica sconti spot 2025"
**Versione:** 2.0.0

Dal 2026 lo sconto massimo applicabile in autonomia dall'agente è 8%
(prima era 12%). Sopra questa soglia → escalation a Direttore.
```

L'AI rileva il campo `Sostituisce`, propone `UPDATE` invece di `INSERT` e marca la vecchia voce come `deprecated`.

Senza il campo `Sostituisce`, il sistema crea due voci concorrenti e le segnala come **conflitto** nel pannello review.

---

## 9. Cosa NON fare

- ❌ **Non usare un solo `#` heading per il titolo del documento**: l'Armonizzatore lo interpreta come metadato del file e ignora il contenuto. Usare sempre `##` per le entità.
- ❌ **Non incollare PDF scansionati**: l'OCR introduce rumore che fa sballare i metadati.
- ❌ **Non mescolare lingue diverse nello stesso file**: separare in file per lingua.
- ❌ **Non usare bullet `•`, `▪`, `–`** come fossero heading. Usare `-` o `*` markdown standard.
- ❌ **Non comprimere più voci in un'unica sezione**: se hai 10 regole, fai 10 `##`, non un'unica lista.
- ❌ **Non lasciare placeholder come "TBD", "TODO", "lorem ipsum"**: vengono rilevati e bloccano l'ingestione.
- ❌ **Non duplicare titoli**: ogni `## Titolo` deve essere univoco nel file.

---

## 10. Checklist pre-consegna

Prima di caricare il documento nel pannello "Armonizza tutto":

- [ ] Encoding UTF-8 (no BOM)
- [ ] Estensione `.md` o `.txt`
- [ ] Ogni entità ha titolo `##` univoco
- [ ] Ogni entità ha **almeno** `Categoria suggerita`, `Capitolo`, `Priorità`
- [ ] Le tabelle target sono dichiarate dove non è la default `kb_entries`
- [ ] Tag in kebab-case, max 5 per voce
- [ ] Voci che sostituiscono dottrine esistenti hanno `Sostituisce`
- [ ] Cross-reference dichiarate nella sezione `### Riferimenti`
- [ ] Nessun placeholder, lorem ipsum, "TBD"
- [ ] Lunghezza voci tra 80 e 1500 parole
- [ ] Numero entità nel file ≤ 300 (oltre, splittare)

---

## 11. Esempio completo (mini-libreria)

```markdown
# Mini-libreria TMWE — Sezione Vendite Air Cargo

## 📄 Qualifica lead air cargo
**Categoria suggerita:** sales_doctrine
**Capitolo:** c2
**Priorità:** 85
**Tabella target:** kb_entries
**Tag:** lead-inbound, cargo-air, qualifica
**Lingua:** it

Un lead air cargo viene considerato qualificato quando rispetta tutti
e quattro i criteri: (1) volume mensile dichiarato ≥ 500 kg,
(2) origine/destinazione dentro il network WCA,
(3) referente con potere decisionale,
(4) timing di partenza entro 60 giorni.

Sotto questi requisiti l'agente non genera quotazione spot,
ma propone un percorso di nurturing (vedi "Nurturing lead non qualificato").

### Riferimenti
- → "Nurturing lead non qualificato" (procedures, c2)
- → "Calcolo break-even quotazione spot" (sales_doctrine, c4)


## 📄 Nurturing lead non qualificato
**Categoria suggerita:** procedures
**Capitolo:** c2
**Priorità:** 60
**Tag:** lead-inbound, nurturing

Sequenza in 3 touchpoint distribuiti su 30 giorni:

1. **T+0** — Email di ringraziamento + link a case study del settore
2. **T+10** — Messaggio LinkedIn con domanda aperta sul progetto
3. **T+30** — Email check-in con offerta di chiamata 15 min

Se nessuna risposta dopo T+30, lead passa a stato `holding_pattern`
e viene rivalutato dopo 90 giorni.
```

---

## 12. Workflow consigliato

1. **Scrittura** in editor markdown (VS Code, Obsidian, Typora)
2. **Validazione locale**: contare le sezioni `^##\s` (devono essere = numero entità attese)
3. **Anteprima** nel pannello "Armonizza tutto" → tab "Agentic V2"
4. **Review proposte** prima di approvare l'esecuzione
5. **Backup** del file sorgente in `/docs/libreria/` con versionamento `git`

---

_Ultimo aggiornamento: aprile 2026 · Riferimento interno: prompt-lab/harmonizer-v2_