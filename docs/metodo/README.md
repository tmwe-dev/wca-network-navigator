# 📚 Il Metodo — Bibbia Metodologica v2.0

**Questa cartella contiene la guida definitiva per la ricostruzione v2.0 di `wca-network-navigator`.**

Ogni decisione tecnica, ogni modulo, ogni flusso della v2.0 **deve** essere coerente con i quattro volumi qui raccolti. In caso di conflitto tra un'abitudine consolidata del codice e una regola di questi libri, **vincono i libri**.

---

## v1.0 vs v2.0

| | v1.0 (attuale) | v2.0 (target) |
|---|---|---|
| **Stato** | 🔒 FREEZE — nessuna modifica | 🏗️ Da costruire da zero |
| **Architettura** | Organica, debito tecnico accumulato | Atomic Design: `/core`, `/io`, `/bridge` |
| **Qualità** | 4.150/10.000 (audit aprile 2026) | Standard Enterprise (5 criteri oggettivi) |
| **AI** | Prompt ad hoc, logica sparsa | Sistema multi-agente con consenso e Perfection Matrix |
| **Testing** | 44 test (guardrails minimi) | Validazione preventiva + contract + regression |
| **Osservabilità** | Parziale | Logging strutturato, metriche, audit trail completo |

**Il codice v1.0 resta dov'è. La v2.0 sarà ricostruita seguendo i 4 volumi.**

---

## I quattro volumi

### 📕 Volume I — Il Protocollo del Recupero (2ª edizione)
*Manuale operativo per il ripristino di sistemi software complessi.*

File:
- [`Volume_I_Il_Protocollo_del_Recupero.md`](./Volume_I_Il_Protocollo_del_Recupero.md)
- `Volume_I_Il_Protocollo_del_Recupero-2.docx` (originale)

**Struttura**: 13 capitoli — dalla Fase 0 (Fotografia) alla Fase 10 (Hardening), più le 7 leggi del recupero e i 6 criteri di uscita dal protocollo.

### 📘 Volume II — Il Metodo Enterprise (2ª edizione)
*Come costruire da zero un software perfetto con intelligenza artificiale.*

File:
- [`Volume_II_Il_Metodo_Enterprise.md`](./Volume_II_Il_Metodo_Enterprise.md)
- `Volume_II_Il_Metodo_Enterprise-2.docx` (originale)

**Struttura**: 17 capitoli — dalla Fase Zero (Validazione) al Go-to-Market, i 5 criteri dello standard enterprise, gli errori da evitare.

### 📗 Volume III — Software Perfetto (1ª edizione)
*Manuale avanzato per il sistema multi-agente e la generazione di codice perfetto.*

File:
- [`Volume_III_Software_Perfetto.md`](./Volume_III_Software_Perfetto.md)
- `Volume_3_-_software_perfect.docx` (originale)

**Struttura**: 5 sezioni — Classificazione TACO, best practices, Perfection Matrix, Glossario SSOT, pattern Atomic Design (`/core`, `/io`, `/bridge`), flusso di disaccoppiamento.

### 📙 Volume IV — Manuale Avanzato Multi-Agente (2ª edizione)
*Sistema multi-agente e generazione di codice perfetto — edizione integrata e completa.*

File:
- [`Volume_IV_Manuale_Avanzato_Multi_Agente.md`](./Volume_IV_Manuale_Avanzato_Multi_Agente.md)
- `volume_4_-_Manuale_Avanzato_Multi_Agente.docx` (originale)

**Struttura**: 12 capitoli — Resilienza (Circuit Breaker), Convergenza del consenso (L1/L2/L3), Versionamento (glossario, schema, ruoli), Osservabilità, Testing preventivo, Sicurezza e governance, Event Bus e Dead Letter Queue.

---

## Concetti chiave per la v2.0

### Le 7 Leggi del Recupero (Vol. I)

> 1. Durante il recupero non si aggiungono funzionalità.
> 2. Non si esegue mai un refactor globale.
> 3. Ogni modifica deve essere verificabile in isolamento.
> 4. Si lavora su un flusso completo alla volta.
> 5. Si distinguono sempre quattro strati: interfaccia, stato, dominio, dati.
> 6. L'AI esegue, non decide. L'architettura è responsabilità umana.
> 7. Nessun intervento è completo finché non è documentato.

### I 5 Criteri dello Standard Enterprise (Vol. II)

> 1. **Prevedibilità** — stesso input, stesso stato → stesso comportamento, sempre.
> 2. **Stabilità** — tollera carichi, errori di rete, input malformati senza degradarsi.
> 3. **Leggibilità** — comprensibile da uno sviluppatore qualificato in tempi ragionevoli.
> 4. **Estendibilità** — nuove feature senza modificare parti non correlate.
> 5. **Monitoraggio** — ogni stato del sistema osservabile dall'esterno.

### Pattern Atomic Design (Vol. III)

```
/core   → logica pura, senza I/O
/io     → accesso a database, API esterne
/bridge → orchestrazione tra core e io tramite event bus
```

### Perfection Matrix (Vol. III)

| Fase | Output richiesto | Criterio di accettazione |
|------|-----------------|-------------------------|
| Definizione | JSON Schema dei dati | Nessun campo opzionale senza default |
| Architettura | Grafo delle dipendenze | Nessun ciclo; percorso lineare |
| Logica | Pseudocodice in Markdown | Nessun ciclo infinito; preferire map/filter |
| Output Lovable | Prompt di implementazione | Deve includere: "Se vedi un'ambiguità, fermati e chiedi" |

### Convergenza del Consenso (Vol. IV)

| Livello | Criterio | Azione |
|---------|----------|--------|
| **L1** | Consenso unanime (5/5) | Procede |
| **L2** | Maggioranza qualificata (4/5, obiezioni solo minor) | Procede con annotation |
| **L3** | Dopo 5 iterazioni senza L1/L2 | Escalation umana |

### Circuit Breaker (Vol. IV)

`Closed → Open (dopo 3 fallimenti) → Half-Open (dopo 60s cooldown) → Closed (se test ok)`

---

## Regola d'oro

> Prima di qualunque intervento sul repo, leggere o ri-leggere il capitolo pertinente. Se il capitolo e il codice esistente sono in conflitto, **vince il capitolo**.
