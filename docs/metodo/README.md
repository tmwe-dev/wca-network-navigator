# 📚 Il Metodo — Fonte di Verità del Progetto

**Questa cartella contiene la bibbia metodologica di `wca-network-navigator`.**
Ogni decisione tecnica, ogni refactor, ogni nuova feature **deve** essere coerente con i due volumi qui raccolti. In caso di conflitto tra un'abitudine consolidata del codice e una regola di questi libri, vincono i libri.

I volumi valgono sia per **Claude** (sessioni Cowork / Claude Code) sia per **Lovable**. Entrambi gli agenti leggono questa cartella prima di agire sul codice.

---

## I tre volumi

### 📘 Documento 2 — Come Costruire da Zero un Software Perfetto con AI
*Guida enterprise per costruire un prodotto vendibile, stabile e scalabile senza cadere nel caos tipico dei builder AI.*

**REGOLA SUPREMA**: Qualsiasi cosa venga costruita a livello di codice deve seguire assolutamente, tassativamente, inderogabilmente le regole di questo documento.

File:
- [`Documento_2_Software_Perfetto_da_Zero_con_AI.md`](./Documento_2_Software_Perfetto_da_Zero_con_AI.md) — testo integrale leggibile e ricercabile
- `Documento_2_Software_Perfetto_da_Zero_con_AI.docx` — originale consegnato dal proprietario

**Struttura**: 11 sezioni — dalla definizione di software perfetto alla formula conclusiva, passando per 6 regole fondanti, 10 fasi di costruzione, 5 regole di prompting enterprise e la checklist di costruzione perfetta.

### 📕 Volume I — Il Protocollo del Recupero
*Manuale operativo per il ripristino di sistemi software complessi.*

Si applica **oggi**, finché il sistema non è uscito dal protocollo. Governa tutte le attività di audit, pulizia, debugging, refactor e consolidamento sul codice esistente.

File:
- [`Volume_I_Il_Protocollo_del_Recupero.md`](./Volume_I_Il_Protocollo_del_Recupero.md) — testo integrale leggibile e ricercabile
- `Volume_I_Il_Protocollo_del_Recupero.docx` — originale consegnato dal proprietario

**Struttura**: 13 capitoli, dalla Fase 0 (Fotografia dello Stato Iniziale) alla Fase 10 (Hardening Finale), passando per 10 fasi operative e 7 leggi non negoziabili.

### 📗 Volume II — Il Metodo Enterprise
*Manuale operativo per la progettazione e lo sviluppo di prodotti scalabili e vendibili.*

Si applica **dopo** che il protocollo del Vol. I ha riportato il sistema a uno stato stabile. Governa tutte le decisioni su nuove feature, nuovi moduli, nuovi prodotti, go-to-market.

File:
- [`Volume_II_Il_Metodo_Enterprise.md`](./Volume_II_Il_Metodo_Enterprise.md) — testo integrale leggibile e ricercabile
- `Volume_II_Il_Metodo_Enterprise.docx` — originale consegnato dal proprietario

**Struttura**: 17 capitoli, dalla Fase Zero (Validazione Prima della Costruzione) al Go-to-Market, includendo una sezione dedicata all'uso corretto dell'AI e i cinque criteri oggettivi dello standard enterprise.

---

## Le 7 Leggi del Recupero (citazione letterale dal Vol. I)

> 1. Durante il recupero non si aggiungono funzionalità.
> 2. Non si esegue mai un refactor globale.
> 3. Ogni modifica deve essere verificabile in isolamento.
> 4. Si lavora su un flusso completo alla volta.
> 5. Si distinguono sempre quattro strati: interfaccia, stato, dominio, dati.
> 6. L'AI esegue, non decide. L'architettura è responsabilità umana.
> 7. Nessun intervento è completo finché non è documentato.

## I 5 Criteri dello Standard Enterprise (citazione letterale dal Vol. II)

> 1. **Prevedibilità** — stesso input, stesso stato → stesso comportamento, sempre.
> 2. **Stabilità** — tollera carichi, errori di rete, input malformati senza degradarsi.
> 3. **Leggibilità** — comprensibile da uno sviluppatore qualificato in tempi ragionevoli.
> 4. **Estendibilità** — nuove feature senza modificare parti non correlate.
> 5. **Monitoraggio** — ogni stato del sistema osservabile dall'esterno.

## Le 3 illusioni da estirpare (Vol. I, §1.2)

1. **Il rewrite** — riscrivere tutto da zero non risolve, rigenera gli stessi bug più una nuova generazione.
2. **La magia dell'AI** — un buon prompt non basta: l'AI non ha visione d'insieme.
3. **La velocità** — la velocità apparente iniziale si paga con gli interessi in fase di recupero.

## Cosa l'AI deve fare / non deve fare (Vol. II, cap. VII)

**Deve**: boilerplate, componenti da specifiche chiare, refactor locali (una funzione/un file), test per codice esistente, documentazione da codice.

**Non deve**: inventare l'architettura, gestire logiche critiche di dominio, modificare più moduli simultaneamente.

**Regola del singolo obiettivo**: ogni interazione con l'AI ha un solo obiettivo verificabile. Ogni prompt include: file coinvolti, contratto input/output, vincoli da non violare, criterio di successo.

---

## Stato attuale del progetto rispetto al metodo

Secondo l'[AUDIT_2026-04-08.md](../../AUDIT_2026-04-08.md), il progetto si trova **nella Fase 1 del Protocollo del Recupero** (Vol. I, cap. III). Voto attuale: **4.150/10.000** (audit iniziale). Il piano di ristrutturazione in 5 ondate descritto nell'audit è la **concretizzazione** delle fasi 1-10 del Vol. I applicate a questo specifico codebase.

### Test implementati (Sessione 2026-04-09)

| File test | Tipo | Test | Cosa verifica |
|---|---|---|---|
| `src/test/apiError.test.ts` | Vitest | 16 | ApiError: costruzione, toJSON, isApiError, from(), fromResponse() per tutti gli status |
| `src/test/invokeEdge.test.ts` | Vitest | 14 | invokeEdge: successo, propagazione body/headers, mapping status→code, body extraction |
| `src/test/platformTools-integrity.test.ts` | Vitest | 7 | Integrità PLATFORM_TOOLS: ≥30 tool, nomi unici, handler↔definizione, struttura parametri |
| `supabase/functions/_shared/platformTools_test.ts` | Deno | 5 | Stesse verifiche lato Deno (snake_case, unicità, completezza) |
| `supabase/functions/check-inbox/index_test.ts` | Deno | 2 | CORS preflight 200, POST senza auth → 401 |

**Totale: 44 test passanti** (37 Vitest + 7 Deno)

| Fase Vol. I | Corrispondenza nel piano audit |
|---|---|
| Fase 0 — Fotografia | ✅ AUDIT_2026-04-08.md (eseguito) |
| Fase 1 — Contenimento del degrado | ✅ Parziale — test guardrails implementati |
| Fase 2 — Radiografia | ✅ sezioni 1-6 dell'audit |
| Fase 3 — Asse di verità | ⏳ Ondata 1 (consolidamento bridge WCA) |
| Fase 4 — Classificazione 3 colori | ⏳ Ondata 2 (split file giganti) |
| Fase 5 — Guardrails | ✅ Parziale — test suite API + integrità tool |
| Fase 6 — Debugging sistematico | ⏳ continuo |
| Fase 7 — Recupero verticale | ⏳ Ondata 2+ (un flusso alla volta) |
| Fase 8 — Strangler pattern | ⏳ Ondata 4 (edge fn + tabelle) |
| Fase 9 — Standardizzazione | ⏳ Ondata 3 fine (ARCHITECTURE.md) |
| Fase 10 — Hardening | ⏳ Ondata 5 (performance + sicurezza) |

---

**Regola d'oro**: prima di qualunque intervento sul repo, leggere o ri-leggere il capitolo pertinente. Se il capitolo e il codice esistente sono in conflitto, **vince il capitolo**.
