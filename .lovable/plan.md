

# Scorecard Finale di Affidabilità — Basata su Dati Reali

## Evidenze raccolte

### Test Suite Results
- **Deno Edge Functions**: 32 passed, 3 failed (35 total)
- Failures: `check-inbox` returns 500 instead of 401 (no auth), `email-sync-worker` returns 200 instead of 401, `check-inbox` stream locking bug

### Dati DB Reali
- **2 drafts con `sent_count: 1` ma `actual_sent: 0`** (failed items contati come sent) → BF-001 in produzione
- **4 drafts bloccati in `processing` da 4-5 giorni** senza finalizzazione → BF-023
- **Zero agent settings in `app_settings`** → budget/orari sempre su default hardcoded → BF-004
- **Zero task zombie** (nessun task in running/executing)
- **Agent stats coerenti** (tutti a 0 completed, 0 tasks eseguiti)
- **41 task pending** mai eseguiti

### Codice verificato
- ✅ BF-002 fixato: `tasks_completed` condizionato a `taskStatus === "completed"` (riga 348)
- ✅ BF-003 fixato: `email-cron-sync` e `agent-autonomous-cycle` usano `_shared/timeUtils.ts` con CET
- ✅ BF-005 fixato: entrambi i path usano `logEmailSideEffects`
- ✅ BF-001 fixato nel codice (sent_count dentro try), ma **dati legacy corrotti ancora nel DB**
- ❌ BF-007: Nessun `idempotency_key` nel sistema
- ❌ BF-008: Nessun recovery per DB failure post-send
- ❌ BF-004 parziale: settings non esistono in DB, solo fallback

---

## 1. SCORECARD GENERALE

### A. Email Ingestion — 62/100

| Sottocriterio | Max | Score | Note |
|---|---|---|---|
| Import correctness | 30 | 22 | Funziona ma `check-inbox` crasha (500) senza auth invece di 401 |
| Multipart/HTML | 15 | 11 | Non testato end-to-end con allegati reali |
| Attachment handling | 10 | 5 | Nessun test di verifica allegati |
| Dedup reliability | 25 | 13 | Test B05 fallisce (stream lock bug) → dedup non verificata |
| Resume/recovery | 10 | 5 | `email-sync-worker` non valida auth (200 senza token) |
| State consistency | 10 | 6 | Sync state funziona ma worker insicuro |

**Test a supporto**: B01 CORS ✅, B01 auth ❌ (500), B05 dedup ❌, B06 auth ❌
**Bug attivi**: check-inbox 500 senza auth, email-sync-worker senza auth check, dedup non verificata
**Soglia 80+**: ❌ Non raggiunta

### B. Email Sending — 76/100

| Sottocriterio | Max | Score |
|---|---|---|
| Direct send accuracy | 25 | 20 |
| SMTP failure handling | 20 | 15 |
| HTML/firma composition | 10 | 8 |
| Interaction logging | 15 | 13 |
| Recipient correctness | 20 | 15 |
| No false positive sent | 10 | 5 |

**Test a supporto**: C04 CORS ✅, C04 auth ✅, C05 shape ✅, send-email contract tests tutti ✅
**Bug attivi**: Nessun idempotency_key (BF-007), no recovery post-DB-failure (BF-008)
**Soglia 85+**: ❌ Non raggiunta

### C. Campaign Queue — 48/100

| Sottocriterio | Max | Score |
|---|---|---|
| Queue lifecycle | 20 | 8 |
| Sent count correctness | 20 | 6 |
| Pause/resume | 15 | 10 |
| Cancel | 10 | 7 |
| Mixed outcome | 15 | 5 |
| Post-send side effects | 10 | 7 |
| Idempotence/retry | 10 | 5 |

**Test a supporto**: C06-C09 tutti ✅ (contract), C07-C08 auth ✅
**Bug attivi**: 
- **BF-001 in produzione**: 2 drafts con sent_count=1 ma 0 email realmente inviate
- **BF-023**: 4 drafts bloccati in `processing` da 4+ giorni
- **BF-007**: Nessun idempotency_key
**Soglia 85+**: ❌ Non raggiunta

### D. Agent Autonomy — 55/100

| Sottocriterio | Max | Score |
|---|---|---|
| Task creation | 15 | 10 |
| Routing | 15 | 10 |
| Approval discipline | 20 | 12 |
| Execution correctness | 15 | 5 |
| Stats integrity | 10 | 8 |
| No duplicate tasks | 10 | 7 |
| No zombie tasks | 5 | 5 |
| Settings compliance | 10 | 3 |

**Test a supporto**: D01 CORS ✅, D08-D10 ✅ (response shape, settings ref, night pause)
**Bug attivi**:
- **BF-004**: Zero agent settings nel DB → tutto su default
- 41 task pending, 0 eseguiti → execution non testata in produzione
- `agent_require_approval` non configurato
**Soglia 88+**: ❌ Non raggiunta

### E. Workflow Coherence — 52/100

| Sottocriterio | Max | Score |
|---|---|---|
| UI vs DB consistency | 25 | 10 |
| Direct vs queue consistency | 20 | 16 |
| Lead/activity/interactions | 20 | 12 |
| Cross-module continuity | 20 | 8 |
| Auditability | 15 | 6 |

**Test a supporto**: Side effects ora allineati nel codice (✅ BF-005 fix)
**Bug attivi**:
- **BF-022**: 2 drafts mostrano sent_count=1 quando actual_sent=0 → UI mente
- **BF-023**: 4 drafts stuck in processing → UI mostra "in corso" per sempre
- Nessun E2E test eseguito per conferma end-to-end
**Soglia 85+**: ❌ Non raggiunta

### F. Resilience Under Failure — 30/100

| Sottocriterio | Max | Score |
|---|---|---|
| SMTP failure | 20 | 12 |
| DB failure after send | 20 | 0 |
| Retry safety | 20 | 5 |
| AI malformed response | 15 | 5 |
| Concurrent cycle safety | 15 | 5 |
| Broken settings | 10 | 3 |

**Test a supporto**: Nessun chaos test eseguito
**Bug attivi**: BF-007 (no idempotency), BF-008 (no DB failure recovery), BF-009 (no concurrent safety)
**Soglia 80+**: ❌ Non raggiunta

---

## Calcolo Finale

**Raw Score**:
(62 × 0.15) + (76 × 0.15) + (48 × 0.15) + (55 × 0.25) + (52 × 0.20) + (30 × 0.10)
= 9.3 + 11.4 + 7.2 + 13.75 + 10.4 + 3.0
= **55.05**

### Cap Analysis
- **Cap 39**: ❌ Non attivo (nessun doppio invio reale confermato, nessun high-stakes auto-eseguito)
- **Cap 49**: ✅ **ATTIVO** — `sent_count` falso confermato in produzione (2 drafts con sent_count=1, actual_sent=0)
- **Cap 59**: ✅ ATTIVO — 4 drafts zombie in `processing` da 4+ giorni

### Score Finale

| Metrica | Valore |
|---|---|
| **Raw Score** | 55.05 |
| **Cap attivo** | Cap 49 (sent_count falso in produzione) |
| **Capped Score** | **49** |
| **Giudizio** | **FRAGILE** |

---

## 2. SALES AUTONOMY SCORE

| Criterio | Max | Score | Motivazione |
|---|---|---|---|
| Scelta contatto corretto | 20 | 10 | Routing esiste ma non testato in prod (0 task eseguiti) |
| Rispetto regole azienda/sede | 20 | 8 | Territory codes implementati, ma zero settings configurati |
| Timing follow-up | 15 | 5 | Follow-up logic esiste, mai eseguita (41 pending, 0 completed) |
| Qualità contenuto email | 15 | 8 | Template + sanitizzazione presenti, non testati end-to-end |
| Escalation/approval corretta | 20 | 10 | isHighStakes() fixato, `agent_require_approval` non configurato |
| Aggiornamento CRM coerente | 10 | 5 | logEmailSideEffects allineato ma dati legacy corrotti |

**Sales Autonomy Score: 46/100** — Non affidabile per outbound autonomo

---

## 3. BLOCKERS ANCORA APERTI

| ID | Blocco | Gravità | Stato |
|---|---|---|---|
| BF-001-DATA | 2 drafts con sent_count falso nel DB | P0 | Codice fixato, dati legacy corrotti |
| BF-023 | 4 drafts stuck in processing da 4+ giorni | P0 | Aperto |
| BF-004 | Zero agent settings nel DB | P1 | Aperto |
| BF-007 | Nessun idempotency_key | P0 | Aperto |
| BF-008 | Nessun recovery DB failure post-send | P0 | Aperto |
| NEW-1 | check-inbox restituisce 500 senza auth | P1 | Aperto |
| NEW-2 | email-sync-worker non valida auth | P1 | Aperto |
| BF-023-B | Queue non si finalizza automaticamente se tutti gli item sono sent/failed | P0 | Aperto |

---

## 4. CONDIZIONI MINIME PER PROMOZIONE

### Per passare da FRAGILE (49) a ASSISTITO (60+):
1. **Correggere dati legacy**: UPDATE dei 2 drafts con sent_count corretto (= 0)
2. **Finalizzare i 4 drafts stuck**: Impostarli a `completed` o `error` con conteggi reali
3. **Fix check-inbox auth**: Deve restituire 401, non 500
4. **Fix email-sync-worker auth**: Deve validare il token
5. **Inserire agent settings nel DB**: almeno `agent_work_start_hour`, `agent_work_end_hour`, `agent_max_actions_per_cycle`, `agent_require_approval`
6. **Rieseguire la suite**: 0 test rossi sui contratti base

### Per passare a SEMI-AUTONOMO (75+):
- Tutti i punti sopra +
- Idempotency key su queue items
- Almeno 1 ciclo agente completato con successo in produzione
- E2E test verdi su inbound→task e campaign lifecycle
- Recovery marker per DB failure post-send

### Per passare a QUASI AUTONOMO (85+):
- Tutti i punti sopra +
- 20+ scenari P0 verdi consecutivi
- 6+ chaos test verdi
- Zero sent_count falsi in 2 run di regressione
- Agent autonomy ≥ 88

---

## Piano di implementazione

### Fase 1 — Fix dati e auth (immediato)
1. Correggere i 4 drafts stuck e i 2 con sent_count falso (migration SQL)
2. Fix auth in `check-inbox` e `email-sync-worker`
3. Inserire agent settings default in `app_settings`
4. Aggiungere logica di auto-finalizzazione queue (se 0 pending → marca completed)

### Fase 2 — Idempotency e resilience
5. Aggiungere `idempotency_key` a `email_campaign_queue`
6. Aggiungere recovery marker per DB failure post-send
7. Scrivere chaos tests (SMTP down, DB failure, concurrent cycles)

### Fase 3 — Validazione
8. Rieseguire tutta la suite
9. Compilare scorecard aggiornata
10. Target: Raw ≥ 70, nessun cap attivo

