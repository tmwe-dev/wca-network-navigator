---
name: Contesto WCA Network Navigator
description: Cosa è il prodotto, le 17 reti, ruoli operatori, glossario di dominio. Letto dall'Harmonizer per inquadrare ogni proposta nel dominio reale.
tags: [harmonizer, context, wca, glossary]
---

# Contesto operativo del WCA Network Navigator

## Cos'è il prodotto

WCA Network Navigator è un CRM / Business Intelligence per gestire **partner logistici** appartenenti alle 17 reti globali della **World Cargo Alliance**. Serve operatori commerciali italiani che lavorano contemporaneamente su:
- relazioni con partner esteri delle reti WCA (mantenimento + sviluppo)
- prospect esterni alle reti (scouting + qualifica)
- biglietti da visita raccolti durante eventi (BCA, business cards arena)

Non è un mailer, non è un dialer, non è un ticketing. È un **orchestratore commerciale** dove l'AI propone, l'operatore approva, il sistema esegue.

## Le 17 reti WCA

Le reti sono organizzazioni di forwarder partner. Ogni partner appartiene a una o più reti. Lista canonica (acronimi che il sistema usa nei dati):

`WCA First`, `WCA Project`, `WCA Pharma`, `WCA Perishables`, `WCA E-Commerce`, `WCA Dangerous Goods`, `WCA Aerospace`, `WCA Interglobal Group`, `WCA Pricing Exchange`, `WCA Family of Logistic Networks` (holding), e altre verticali specializzate.

L'Harmonizer **non deve mai inventare nomi di reti**. Se un blocco desiderato menziona una rete, deve esistere nel campo `partners.network_name` o equivalente.

## Ruoli operatori

Tre ruoli definiti via `user_roles.role` (enum `app_role`):
- **admin** — vede tutto, può modificare configurazioni, gestire utenti, eseguire migrazioni
- **operator** — operatore commerciale standard, lavora sui contatti assegnati o condivisi
- **viewer** — sola lettura

L'Harmonizer riceve nel contesto runtime l'id e il ruolo dell'operatore corrente. **Non proporre azioni che richiedono privilegi superiori a quelli dell'operatore.**

## Glossario di dominio (termini canonici, non sinonimi)

- **Partner** — forwarder partner di una rete WCA. Tabella `partners`. Ha email, telefono, country, network, sede HQ o branch.
- **Partner contact** — persona fisica dentro un partner. Tabella `partner_contacts`.
- **Imported contact** — contatto fuori da WCA (prospect, da BCA o import CSV). Tabella `imported_contacts`.
- **Mission** — campagna outreach mirata su un set di contatti, con KPI misurabili (risposte, meeting, lead). Tabella `outreach_missions`.
- **Outreach** — singola azione comunicativa pianificata o eseguita (email, WhatsApp, LinkedIn). Tabelle `outreach_queue`, `outreach_schedules`.
- **Agent** — figura AI con persona, system prompt, tool autorizzati, territori assegnati. Tabella `agents`.
- **Persona** — definizione stilistica e tonale di un agente (tono, vocabolario, firma). Tabella `agent_personas`.
- **Holding pattern** — circuito di attesa per lead non rispondenti. Status `holding`.
- **Lead status** — stato commerciale del lead (vedi sotto, 9 valori).
- **Activity** — log di interazione (email inviata, chiamata, meeting). Tabella `activities`.
- **KB entry** — voce della knowledge base (dottrina, procedura, esempio). Tabella `kb_entries`.
- **Operative prompt** — prompt strutturato di un agente per un task specifico. Tabella `operative_prompts`.

## Pipeline lead a 9 stati (tassonomia inviolabile)

```
new → first_touch_sent → holding → engaged → qualified → negotiation → converted
                                                                       ↘
                                                                      archived
                                                                       ↘
                                                                    blacklisted
```

Ordine di progressione: `new`(0) → `first_touch_sent`(1) → `holding`(2) → `engaged`(3) → `qualified`(4) → `negotiation`(5) → `converted`(6).

Stati terminali fuori-flusso: `archived` (chiuso pulito), `blacklisted` (chiuso negativo).

L'Harmonizer **non può proporre nuovi stati**, **non può rinominare**, **non può rimuovere**. Se un gap richiede un nuovo stato → `resolution_layer = code_policy`.

## Cosa l'Harmonizer NON sa fare in WCA Network Navigator

- Non scrive email, non telefona, non manda WhatsApp.
- Non sceglie quali contatti contattare.
- Non assegna territori agli agenti automaticamente.
- Non crea missioni.
- Non modifica configurazioni di sistema (Stripe, IMAP, ecc.).

L'Harmonizer **manutentore architetturale** del sistema prompt/KB/runtime. Si ferma lì.