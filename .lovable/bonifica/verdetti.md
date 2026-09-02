# Verdetti (Fasi 2-3) — matrice delle tre lenti

Regola d'oro: basta una lente "vivo" perché sia vivo. Servono tre "morto" per tagliare.
Legenda lenti: **R** = raggiungibilità (statica), **T** = traffico reale (usage_events), **I** = intento storico.

## Sezione A — Duplicati esatti (primo taglio sicuro: unificazione, non rimozione)

Classificazione: **Duplicato** (stessa idea in due posti). Cura: unificare. NON è una sottrazione di comportamento.

| # | Cluster | R | T | I | Verdetto | Azione |
| - | ------- | - | - | - | -------- | ------ |
| A1 | `AuroraBorealis.tsx` (campaigns ↔ standalone-globe) | entrambi raggiungibili | n/d | pacchetto self-contained (README) | **Duplicazione intenzionale** | NON unificare: `src/standalone-globe/` è un pacchetto estraibile per contratto |
| A2 | `caCerts.ts` ×6 (apply/backfill/check-inbox×2/imap-list/manage-folders) | vive | n/d | n/d | Duplicato esatto (md5 identico) | ✅ **FATTO 2026-09-02**: unificato in `_shared/caCerts.ts`, 6 import aggiornati, 6 copie rimosse |
| A3 | `bounceDetector.ts` (check-inbox-booking ↔ check-inbox) | vive | n/d | n/d | Duplicato (diff = solo etichetta logger) | ✅ **FATTO 2026-09-02**: `_shared/bounceDetector.ts` |
| A4 | `enqueueEnrichment.ts` (idem) | vive | n/d | n/d | Duplicato (diff = solo etichetta logger) | ✅ **FATTO 2026-09-02** |
| A5 | `index.integration.test.ts` (idem) | test | n/d | n/d | Duplicato esatto | rinviato: i test vivono accanto alla funzione, unificarli riduce l'isolamento — nessun beneficio di rischio |
| A6 | `index_test.ts` (idem) | test | n/d | n/d | Duplicato esatto | come A5 |
| A7 | `mimeDecoder.ts` (idem) | vive | n/d | n/d | Duplicato (diff = solo etichetta logger) | ✅ **FATTO 2026-09-02** |
| A8 | migration SQL duplicate 20260403 ×2 | applicata | n/d | storia DB | **Obbligatorio invisibile** | NON toccare: le migration applicate sono storia immutabile |

> Nota Fase 3: A2-A7 richiedono refactor degli import (cambio + sottrazione). Per la regola "mai mescolare togliere e cambiare", ogni cluster = un commit dedicato di sola unificazione, senza altre modifiche.

## Sezione B — Near-duplicati (9 cluster)

Stessi cluster di A con fingerprint parziale: inclusi nelle azioni A2-A7. Il 9° (`migrations 20260419/20260420`) = migration applicate → **non si toccano**.

## Sezione C — Orfani candidati (473)

Lente R dice "non raggiunti", ma l'audit dichiara falsi orfani noti (lazy import, route string, barrel).
Procedura: nessun taglio diretto. Primi 20 in quarantena (`quarantena.md`) con criterio a 30 giorni;
gli altri 453 restano in inventario finché la Lente 2 non ha coperto un ciclo completo.

## Sezione D — Overlap v1↔v2 (45 basename)

Segnale, non prova. Triage rinviato: richiede Lente 3 voce per voce (alcuni sono adapter legittimi).

## Sezione E — Obbligatori invisibili già noti (da proteggere, non toccare)

- Migration applicate (tutta la storia `supabase/migrations/`).
- Trigger soft-delete globale (15 tabelle).
- `hardGuards.ts`, `aiInvocationGuard`, prompt versionati, `authorized_users`.
- Bridge estensioni WA/LI/email/ra-extension/partner-connect: interfacce pubbliche → mai taglio senza preavviso.


## Registro tagli eseguiti

| Data | Cluster | Operazione | Reversibilità |
| ---- | ------- | ---------- | ------------- |
| 2026-09-02 | A2 | `caCerts.ts` → `supabase/functions/_shared/caCerts.ts`; import aggiornati in `apply-email-rules`, `backfill-email-rules`, `imap-list-folders`, `manage-email-folders`, `check-inbox/imapConnection.ts`, `check-inbox-booking/imapConnection.ts` | ripristino da git: contenuto invariato (md5 identico su tutte le 6 copie), sola unificazione |

Prova del contrario (Fase 6) per A2: nessun `caCerts.ts` locale residuo, nessun import `./caCerts.ts` residuo, funzione esportata invariata (`getCaCertsForHost`).
| 2026-09-02 | A3/A4/A7 | `bounceDetector.ts`, `enqueueEnrichment.ts`, `mimeDecoder.ts` → `_shared/`; 10 import aggiornati in `check-inbox` e `check-inbox-booking`; funzioni ridistribuite | diff verificato riga per riga: unica differenza era `createLogger("check-inbox")` vs `("check-inbox-booking")` → ora `createLogger("inbox-shared")`. Nessun cambio di logica, solo etichetta nei log strutturati |

Prova del contrario (Fase 6) per A3/A4/A7: nessun modulo locale residuo, nessun import `./` residuo, export invariati (`detectBounce`, `handleBounce`, `enqueueInboundEnrichment`, `sha256hex`, `sanitizeMessageId`, `decodeRfc2047`, helper body). Deploy eseguito su entrambe le funzioni.
