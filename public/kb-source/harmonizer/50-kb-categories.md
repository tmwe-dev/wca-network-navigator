---
name: Tassonomia kb_entries
description: Enum validi per kb_entries.category, convenzioni chapter, range priority. Letto a ogni proposta su kb_entries.
tags: [harmonizer, schema, kb, taxonomy]
---

# Tassonomia knowledge base

## Categorie valide (`kb_entries.category`)

Campo testo libero a livello DB ma con **convenzione semantica stretta**. Categorie canoniche osservate in produzione:

| Categoria | Cosa contiene | Priorità tipica |
|---|---|---|
| `system_doctrine` | Regole fondamentali del sistema, mai contestabili | 80–100 |
| `sales_doctrine` | Strategia commerciale, regole di lead management | 60–90 |
| `doctrine` | Dottrina generale (architetturale, operativa) | 50–80 |
| `procedures` | Procedure operative passo-passo (workflow) | 40–70 |
| `playbook` | Script commerciali, pattern di conversazione | 40–70 |
| `glossary` | Definizioni di termini di dominio | 30–50 |
| `reference` | Materiale di consultazione (link, schemi) | 20–50 |
| `email_pattern` | Pattern di risposta automatica generati dal learning loop | 30–60 |
| `agent_briefing` | Briefing specifici per agenti (contesto, KPI) | 50–80 |
| `compliance` | Note legali, GDPR, policy compliance | 70–95 |

**Regole**:
- ❌ Non inventare nuove categorie senza evidenza forte dalla libreria desiderata.
- ❌ Non usare maiuscole, spazi, accenti. Solo `lowercase_underscore`.
- ✅ Se un blocco desiderato non rientra in nessuna → preferisci `doctrine` come fallback con `chapter` esplicito.

## Convenzioni `chapter`

Sub-area dentro la categoria. Esempi reali in DB:

| Chapter | Quando usarlo |
|---|---|
| `general` | Default fallback |
| `init` | Prima inizializzazione del sistema |
| `email` | Tutto ciò che riguarda email |
| `whatsapp` | Tutto ciò che riguarda WhatsApp |
| `linkedin` | Tutto ciò che riguarda LinkedIn |
| `outreach` | Outreach multicanale generico |
| `lifecycle` | Stati lead, holding pattern, transizioni |
| `agents` | Architettura agenti, persone, tool |
| `negotiation` | Tecniche di trattativa |
| `cold_outreach` | Primo contatto con lead nuovi |
| `follow_up` | Pattern di re-touch |
| `compliance` | GDPR, opt-in, blacklist |

Convenzione: lowercase, snake_case, max 1 parola se possibile, max 2 unite con underscore.

## Range `priority`

Intero 0–100. Più alto = più importante in fase di retrieval RAG.

| Range | Significato |
|---|---|
| 90–100 | Doctrine non contestabile, sempre in cima |
| 70–89 | Regola forte, frequentemente rilevante |
| 50–69 | Default per voci nuove non specificate |
| 30–49 | Reference, materiale di approfondimento |
| 0–29 | Archivio, raramente rilevante |

## Convenzioni redazionali (`kb_conventions`)

- **Title**: max 80 char, no emoji, capitale iniziale, lingua coerente con `language` campo.
- **Tags**: lowercase, kebab-case, max 5 tag per voce. Esempi: `email`, `cold-outreach`, `gdpr-compliance`.
- **Content**: markdown supportato, no HTML grezzo. Lunghezza ottimale 300–2000 char. Se supera 3000 → spezzare in più voci.
- **is_active**: default `true`. Soft delete = `false`.
- **sort_order**: usato per ordinamento in UI quando più voci hanno stessa priority. Default 0.

## Vincoli per INSERT

Campi obbligatori in payload:
- `title` (text, non vuoto, max 80 char)
- `content` (text, non vuoto)
- `category` (text, scegli da lista canonica)
- `chapter` (text, scegli da lista canonica)
- `user_id` (uuid, operatore corrente — gestito dall'executor)

Campi consigliati:
- `tags` (array, anche `[]`)
- `priority` (default 50)
- `is_active` (default `true`)
- `sort_order` (default 0)

## Quando usare MOVE su kb_entries

Casi tipici:
- Voce in `system_doctrine` ma è una procedura → MOVE a `procedures`
- Voce in `doctrine` ma è uno script commerciale → MOVE a `playbook`
- Voce in `procedures` ma è un glossario → MOVE a `glossary`

MOVE richiede aggiornare `category` e/o `chapter` in `payload`, `target_id` esistente.