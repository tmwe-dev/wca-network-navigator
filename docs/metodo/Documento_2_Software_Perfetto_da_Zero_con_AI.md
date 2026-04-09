# Documento 2 — Come Costruire da Zero un Software Perfetto con AI

Guida enterprise adattata al dominio importazione listini: metodo per costruire un prodotto vendibile, stabile e scalabile senza cadere nel caos tipico dei builder AI.

> **Destinazione**: software enterprise che unisce prodotto, operatività, affidabilità e capacità di evoluzione.
> **Principio**: l'AI accelera produzione e analisi, ma l'architettura, i contratti e la qualità devono essere progettati prima.
> **Output**: metodo completo su cosa fare, quando farlo, come farlo e quali criteri usare per dire che il sistema è davvero pronto.

---

## 1. Definizione di software perfetto

Nel contesto enterprise, un software perfetto non è quello che ha zero difetti teorici, ma quello che rimane controllabile sotto crescita, casi eccezionali, cambi di team e aumento dei clienti.

| Dimensione | Definizione enterprise |
|---|---|
| Funzionalità | Fa bene il lavoro primario end-to-end |
| Controllo | Ogni stato è spiegabile e tracciato |
| Qualità | Test, osservabilità e rollback sono nativi |
| Scalabilità | Aggiungere corrieri/casi non richiede rifare il core |
| Vendibilità | Il cliente percepisce velocità, affidabilità e riduzione lavoro manuale |
| Sostenibilità | Il team può continuare a evolvere il prodotto senza paura |

---

## 2. Regole fondanti prima di una riga di codice

1. **Prima si definisce il dominio, poi la UI.**
2. **Prima si definiscono contratti e schemi, poi i prompt.**
3. **Prima si decide dove vive la verità dei dati, poi si aggiunge AI.**
4. **Ogni modulo deve avere un solo scopo primario.**
5. **Ogni flusso critico deve essere completabile senza intuizioni manuali del team.**
6. **Ogni funzione AI deve essere sostituibile, osservabile e testabile con casi campione.**

---

## 3. Fasi progressive di costruzione

### Fase 1 — Strategia prodotto
- Scrivere missione, problema reale, utenti, volumi attesi, valore economico generato.

### Fase 2 — Modellazione dominio
- Elencare entità, relazioni e regole. Separare chiaramente regole di business da regole di presentazione.

### Fase 3 — Contratti
- Definire schema input/output per ogni step. Scrivere errori ammessi e campi obbligatori; niente payload ambigui.

### Fase 4 — Architettura
- Scegliere componenti: frontend, storage, database, worker/edge, AI gateway, observability. Disegnare confini.

### Fase 5 — Foundation tecnica
- Auth, ruoli, logging, tracing, config, error boundaries, ambiente staging, CI, seed dataset. Nessun builder AI deve saltare questa fase.

### Fase 6 — Design system e UX
- Componenti standard, stati loading/error/empty, pattern di conferma e warning.

### Fase 7 — Sviluppo verticale
- Un flusso completo alla volta: dall'input alla persistenza al file finale. Vertical slice, non strati scollegati.

### Fase 8 — QA strutturata
- Unit test, contract test, scenario test, golden files, replay job, test di carico mirati. L'AI produce codice; la qualità si ottiene con prove, non con fiducia.

### Fase 9 — Hardening
- Sicurezza, performance, idempotenza, retry policy, failure recovery, versioning dati/regole. Solo qui si parla di prodotto pronto a vendere.

### Fase 10 — Messa a terra commerciale
- Onboarding, template iniziali, manuali, metriche di valore per il cliente, supporto e audit trail.

---

## 4. Uso corretto dell'AI durante la costruzione

| L'AI deve fare | L'AI non deve fare |
|---|---|
| Boilerplate, parser iniziali, componenti UI standard, test scaffold, documentazione tecnica, refactor locali | Inventare dominio, cambiare regole business, spostare architettura senza mandato, unire responsabilità diverse nello stesso modulo |
| Analisi file complesse con schema obbligatorio | Restituire testo libero dove serve dato eseguibile |
| Proporre pattern ricorrenti e template | Decidere da sola cosa è produzione-ready |
| Assistere il debug con dati e log | Sostituire l'osservabilità del sistema |

> **Formula corretta** — AI come squadra di specialisti dentro una costituzione tecnica rigida. Mai AI come architetto assoluto del prodotto.

---

## 5. Metodo di prompting per prodotti enterprise

1. **Ogni prompt ha uno scopo solo.**
2. **Ogni prompt dichiara input, output, schema, vincoli, errori ammessi e criteri di completamento.**
3. **Ogni prompt che estrae dati deve indicare coordinate o evidenze di origine quando il dominio lo richiede.**
4. **Ogni prompt critico deve essere testato su un pacchetto di casi campione prima di entrare in produzione.**
5. **Ogni comportamento emerso da correzioni utente deve diventare regola governata, non memoria implicita.**

---

## 6. Architettura enterprise consigliata

| Layer | Responsabilità chiave | Nota progettuale |
|---|---|---|
| Frontend operativo | Workspace import, review, warning, storico, file | UX da operatore, velocità e chiarezza |
| API / Edge | Endpoint sottili e orchestrazione | Niente logica gigantesca in un solo file |
| Domain services | Validation, split, mapping, artifact rules | Librerie pure testabili |
| Persistence | DB transazionale + storage artefatti | Idempotenza e audit trail |
| AI services | Report, extraction, suggestion, pattern detection | Sempre dietro schema e guardrail |
| Learning layer | KB, memory, templates | Versionato, filtrabile, governato |

---

## 7. Checklist di costruzione perfetta

- [ ] Esiste una mappa dominio approvata.
- [ ] Esistono schemi versionati per tutti i payload.
- [ ] Esistono flussi utente critici scritti e testabili.
- [ ] Esistono ruoli, permessi e confini dati.
- [ ] Esiste un dataset di prova reale.
- [ ] Esiste una pipeline CI che blocca regressioni.
- [ ] Esistono log e metriche per capire ogni errore.
- [ ] Esistono procedure di rollback e reprocessing.
- [ ] Esiste documentazione operativa per utente e team tecnico.
- [ ] Esistono criteri chiari di release e definizione del done.

---

## 8. Cosa fare quando il builder AI spinge troppo veloce

- Fermare la produzione di nuove schermate e tornare ai contratti.
- Confrontare ogni feature con il modello dominio: se non ci entra bene, va riprogettata.
- Ridurre i prompt e aumentare gli schemi.
- Sostituire la libertà del builder con checklist di review per modulo.
- Mettere subito golden tests sui file reali: l'illusione di velocità cade quando arrivano i dati veri.

---

## 9. Definizione di prodotto vendibile

| Requisito | Perché conta |
|---|---|
| Risultato misurabile | Il cliente compra tempo risparmiato, meno errori, più controllo |
| Onboarding rapido | Senza avvio semplice, il prodotto non scala commercialmente |
| Affidabilità percepita | Il cliente perdona meno gli errori sui prezzi che su un CRM generico |
| Adattabilità | Nuovi corrieri e formati devono essere gestibili senza sviluppo pesante |
| Storico e tracciabilità | In ambito tariffario e logistico servono evidenze e audit |
| Supporto intelligente | Template, KB e apprendimento riducono il costo operativo del vendor |

---

## 10. Definizione di successo finale

Un software costruito bene con AI raggiunge il suo obiettivo quando il team non è più schiavo del codice generato. Il codice diventa governato, il dominio rimane centrale, i moduli sono sostituibili, gli errori sono leggibili e ogni nuova estensione costa meno della precedente.

---

## 11. Formula conclusiva

> **Metodo vincente** — Architettura prima. Contratti prima dei prompt. Vertical slice prima del refactor globale. Test prima della fiducia. AI come acceleratore dentro un sistema che resta umano, leggibile e vendibile.
