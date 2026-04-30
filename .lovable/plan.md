## Obiettivo

Unificare WCA Partners, CRM Contatti e Biglietti da Visita in **una sola pipeline** con tre **origini dati** selezionabili in cima. Stessa UX, stessi tab, stessi strumenti — un solo posto da imparare e da manutenere.

Il primo tab di ogni origine è **l'elenco contatti con dettaglio a destra**. Gli altri tab restano gli attuali (li snelliremo in un secondo passaggio, come da tua indicazione).

## Cosa cambia per te

### Menu di navigazione
Oggi nel menu vedi 3 voci separate:
- WCA Partner
- Contatti CRM
- Biglietti da visita

Diventa **1 sola voce**: **Contatti** → porta alla pipeline unica.

### Dentro la pipeline unica
In alto, **3 pillole/tab di "origine"** sempre visibili:

```text
[ WCA Partner ] [ Contatti ] [ Biglietti ]   ← scegli la fonte dei record
─────────────────────────────────────────────
[ Elenco | Kanban | Duplicati | Campagne | Agenda ]   ← tab di lavoro (stessi per tutte e 3)
─────────────────────────────────────────────
| Lista record (filtrata per origine) | Dettaglio a destra |
```

- **Origine** = quale dataset stai guardando (partner WCA, contatti CRM, biglietti).
- **Tab di lavoro** = sempre gli stessi 5, indipendentemente dall'origine.
- **Primo tab "Elenco"** = lista a sinistra + pannello dettaglio a destra (come una mailbox).

La parola "Pipeline" sparisce sia dal menu sia dall'header. L'icona resta la stessa.

## Tab di lavoro — fase 1 (replica gli attuali)

Mantengo per ora i tab esistenti, così non rompo nulla:
- **Elenco** (nuovo: lista + dettaglio a destra)
- **Kanban** (drag-and-drop per stadi)
- **Duplicati**
- **Campagne**
- **Agenda**

Quando l'avrai usata, decidiamo insieme quali togliere (la tua scelta "Decidiamo dopo").

## Redirect — nessun link rotto

Tutti i vecchi URL continuano a funzionare e portano alla nuova pipeline con l'origine giusta pre-selezionata:

| Vecchio URL                        | Nuovo URL                                  |
|-----------------------------------|--------------------------------------------|
| `/v2/explore/network` (WCA Partner) | `/v2/contatti?origine=wca`                |
| `/v2/pipeline/contacts`            | `/v2/contatti?origine=crm`                 |
| `/v2/pipeline/biglietti`           | `/v2/contatti?origine=biglietti`           |
| `/v2/pipeline/kanban`              | `/v2/contatti/kanban?origine=crm`          |
| `/v2/pipeline/duplicati`           | `/v2/contatti/duplicati?origine=crm`       |
| `/v2/pipeline/campaigns`           | `/v2/contatti/campagne?origine=crm`        |
| `/v2/pipeline/agenda`              | `/v2/contatti/agenda?origine=crm`          |
| `/v2/crm/*`, `/v2/contacts`, `/v2/business-cards` | redirect equivalenti      |

## Cosa NON cambia

- Database, RLS, edge function: zero modifiche.
- Logica di business (stadi, holding pattern, lead scoring, scoring BCA): invariata.
- Componenti `ContactPipelineView`, `BusinessCardsHub`, `DuplicateDetector`, `ContactsPage`, `CountryGridV2`, `NetworkPage`: invariati internamente — vengono solo **riposizionati** sotto la nuova shell.
- Filtri laterali (`ContextFiltersRail`): si attivano in base all'origine corrente (WCA → filtri network, CRM/Biglietti → filtri contatti). Già pronti.
- Nessuna eliminazione di codice — solo cambio di rotte e menu.

## Dettagli tecnici

File toccati (solo UI/routing, zero logica):

1. `src/v2/ui/pages/sections/PipelineSection.tsx` → rinominato concettualmente in `ContattiSection`. Tab "origine" in cima (state `?origine=wca|crm|biglietti`), tab di lavoro sotto.
2. `src/v2/ui/pages/ContactsPage.tsx` → resa "origine-aware" (mostra elenco WCA, CRM o biglietti in base al param). I componenti tabella interni restano gli stessi.
3. `src/v2/routes.tsx` → aggiunge `pipeline/*` come alias del nuovo `contatti/*` per retro-compatibilità; redirect da `/v2/explore/network` → `/v2/contatti?origine=wca`.
4. `src/v2/ui/templates/navConfig.tsx` → da 3 voci (`wca_partners`, `crm_contacts`, `business_cards`) a **1 sola** (`Contatti` → `/v2/contatti`).
5. `src/v2/ui/templates/breadcrumbConfig.ts` → label `pipeline` → `Contatti`; rimossa label `Pipeline`.
6. `src/v2/ui/templates/PageHeaderUnified.tsx` → `sectionLabel="Contatti"` (al posto di "Pipeline"), icona `Users`.
7. `src/v2/ui/templates/ContextFiltersRail.tsx` → si aggancia al param `?origine=` per scegliere il pannello filtri corretto.

Nessuna nuova tabella DB, nessuna nuova edge function, nessun nuovo hook di business. Tutto il lavoro è di **riorganizzazione UI**.

## Verifica post-implementazione

- I 3 vecchi link nel menu non esistono più → al loro posto c'è "Contatti".
- Aprendo "Contatti" parte sull'origine **CRM**, primo tab **Elenco**, dettaglio a destra.
- Cliccando l'origine **WCA** vedi i partner WCA con gli stessi tab di lavoro.
- Cliccando **Biglietti** vedi i biglietti da visita con gli stessi tab.
- Tutti i vecchi URL fanno redirect corretto, niente 404.
- Il `CampaignQueueMonitor` nel Command Canvas continua a funzionare come prima.

## Fase 2 (da decidere insieme dopo che usi la nuova UI)

Quali tab di lavoro tenere/togliere per origine (es. forse Kanban non ha senso per i Biglietti, forse Duplicati va spostato in Config). Lo decidiamo a sistema funzionante, come hai chiesto.