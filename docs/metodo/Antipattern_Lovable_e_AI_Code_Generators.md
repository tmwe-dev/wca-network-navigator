# ⛔ Antipattern — Cosa NON Fare con Lovable e AI Code Generators

**Documento vincolante per la v2.0 — Errori strutturali da evitare tassativamente.**

---

## Il problema di fondo

Lovable (come v0, Bolt, e simili) genera codice che "funziona subito" ma è strutturalmente debole per ragioni precise. **La v2.0 deve correggere ognuno di questi difetti sistematicamente.**

---

## 1. Speed over Architecture

**Il difetto:** Il modello è ottimizzato per produrre un'app visivamente funzionante in secondi. Non ha incentivo a creare layer di astrazione, separation of concerns, o pattern enterprise. Il risultato è codice monolitico che fa tutto in un file.

**Regola v2.0:** Ogni modulo segue il pattern Atomic Design (`/core`, `/io`, `/bridge`). Nessun file supera le 300 LOC. Nessun componente contiene logica di dominio. L'architettura viene definita PRIMA del codice (Vol. II, Cap. III).

---

## 2. Zero Opinioni Architetturali

**Il difetto:** Non implementa mai feature flags, event bus, retry pattern, logging strutturato, health check, o state management immutabile — perché nessuno glielo chiede e aggiungerli rallenterebbe il "wow effect" iniziale.

**Regola v2.0:** Tutti questi pattern sono requisiti di fondazione (Vol. II, Cap. IV). Devono esistere PRIMA della prima feature di prodotto:
- Event bus centralizzato (Vol. IV, Sez. 11.2)
- Logging strutturato JSON con campi obbligatori (Vol. IV, Sez. 8.1)
- Circuit breaker con fallback (Vol. IV, Sez. 5.2)
- Feature flags per ogni rilascio (Vol. II, Cap. IX)
- Health check e metriche (Vol. II, Cap. XII)

---

## 3. TypeScript Finto

**Il difetto:** Usa `any` ovunque, `strict: false`, e tipi generici invece di interfacce precise. Il codice compila ma non hai nessuna garanzia a runtime.

**Regola v2.0:** TypeScript in modalità `strict` con `noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess` attivi (Vol. I, Cap. III, §3.2). Zero `any` nel codice nuovo. Ogni entità ha un'interfaccia tipizzata nel Glossario SSOT (Vol. III, §3.1). Grok boccia qualsiasi codice che viola il glossario.

---

## 4. Error Handling Cosmetico

**Il difetto:** `.catch(() => {})` è il pattern standard — errori inghiottiti, nessun logging, nessun recovery. L'app sembra funzionare finché non si rompe in silenzio.

**Regola v2.0:** Nessun `try-catch` generico (Vol. III, §3.3 — vincolo inviolabile). Ogni errore è:
- Tipizzato con codice applicativo e messaggio leggibile (Vol. II, Cap. V, §5.3)
- Registrato nel log strutturato con contesto completo (Vol. I, Cap. III, §3.3)
- Gestito con strategia esplicita: retry, fallback, escalation, o notifica (Vol. IV, Sez. 5.3)

`.catch(() => {})` è VIETATO. Ogni occorrenza è una violazione Critical (Vol. IV, Sez. 6.3).

---

## 5. Nessun Concetto di Manutenibilità

**Il difetto:** Componenti da 500+ righe, logica di business mischiata con UI, nessun test, nessuna documentazione inline. Il codice nasce già come debito tecnico.

**Regola v2.0:**
- Massimo 300 LOC per file, 15-20 righe per funzione (Vol. III, §3.1)
- Separazione rigorosa: interfaccia, stato, dominio, dati (Vol. I, Legge 5)
- Test preventivi: schema validation, contract testing, smoke testing (Vol. IV, Sez. 9.2)
- Documentazione come criterio di completezza (Vol. I, Legge 7; Vol. II, Cap. VI, §6.3)

---

## 6. Il 20/80 Invertito

**Il difetto:** Lovable risolve il problema sbagliato. Costruisce il primo 20% (prototipo visivo) bene, ma quel 20% è il lavoro facile. L'80% che conta — stabilità, sicurezza, scalabilità, monitoring — non esiste.

**Regola v2.0:** La v2.0 inverte la priorità. Le fondazioni (Vol. II, Cap. IV) vengono costruite PRIMA di qualunque schermata:
1. Autenticazione e autorizzazione granulare
2. Design system con componenti tipizzati
3. Gestione errori standardizzata
4. Logging e osservabilità
5. Framework di test
6. CI/CD e ambienti separati

Solo DOPO queste fondazioni si costruisce la prima feature di prodotto.

---

## Riferimento: v1.0 vs standard

| Metrica | v1.0 (Lovable puro) | Target v2.0 | Benchmark (Brumm) |
|---------|---------------------|-------------|-------------------|
| Score qualità | 65-68/100 | 95+/100 | 100/100 |
| `any` nel codice | 1489 | 0 | 0 |
| God components (>500 LOC) | 12 | 0 | 0 |
| Error handling | Cosmetico | Tipizzato + logged | Completo |
| Test coverage | Guardrails minimi | Contract + regression | Completo |
| Logging strutturato | Parziale | JSON obbligatorio | Completo |
| Feature flags | Assenti | Obbligatori | Presenti |
| Documentazione | Assente | Auto-generata + ADR | Completa |

---

## Regola d'oro

> **Lovable è uno strumento di velocità, non di direzione.** La direzione è responsabilità umana e deve essere stabilita prima che l'AI venga interpellata. (Vol. II, Prefazione)

> **L'AI esegue, non decide. L'architettura è responsabilità umana.** (Vol. I, Legge 6)
