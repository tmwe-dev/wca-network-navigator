
## Piano: Bonifica errori critici emersi dai test

Affronto i 3 blocchi di problemi in ordine di **rischio business**, non di volume. Niente big-bang: ogni blocco è autoconsistente e rilasciabile separatamente.

---

### Blocco 1 — Sicurezza dati (PRIORITÀ MASSIMA)
**Perché prima:** ogni minuto che passa, dati partner/contatti sono potenzialmente accessibili cross-operator. Rischio reale GDPR + perdita fiducia.

**Migrazione SQL unica** che corregge:

1. **`user_credits` — privilege escalation**
   - Revoca `UPDATE` diretto al ruolo `authenticated`
   - Crea funzione `SECURITY DEFINER` `consume_credits(amount, operation, description)` che è l'unico modo per modificare `balance`
   - Aggiorna policy: solo SELECT del proprio record

2. **12 tabelle con `USING(true)` — leak cross-tenant**
   Tabelle: `partners`, `prospects`, `imported_contacts`, `partner_contacts`, `business_cards`, `activities`, `outreach_queue`, `outreach_missions`, `mission_actions`, `channel_messages`, `email_drafts`, `agent_tasks`
   - Sostituisco `USING(true)` con `USING(operator_id = ANY(get_effective_operator_ids()))` (funzione già esistente per multi-operator)
   - Per tabelle senza `operator_id` chiaro: scope via `user_id = auth.uid()` o via JOIN su `partners.operator_id`
   - Mantengo policy "shared visibility" SOLO per `business_cards` (memoria `shared-contacts-visibility-policy`) ma ristretta ad `authenticated`

3. **Policy permissive `operator_id IS NULL`**
   - Rimuovo il bypass su INSERT/UPDATE: `operator_id` diventa obbligatorio e auto-set via trigger `BEFORE INSERT` con `get_active_operator_id()`

4. **`realtime.messages` — topic auth mancante**
   - Aggiungo policy SELECT che valida il topic contro `auth.uid()` per i 10 canali pubblicati

5. **`team_members`, `kb_entries` (public role), `email_templates` (public role), `blacklist_entries`**
   - Chiusura access pubblico → `authenticated`
   - Per `team_members`: writes solo `is_operator_admin()`

**Test post-migrazione:**
- Re-run `security--run_security_scan` → 0 ERROR attesi
- Re-run `supabase--linter` → < 10 warning attesi
- Smoke test V2: login + lettura partners + invio email → deve continuare a funzionare

---

### Blocco 2 — Test regression taxonomy lead status
**Perché:** 23 test rossi su `escalation-logic` e `leadEscalation` perché usano vecchia tassonomia (`contacted`, `in_progress`, `lost`) invece della nuova 9-state (`first_touch_sent`, `engaged`, `archived`, …).

**Azione:**
1. Aggiorno `src/lib/leadEscalation.ts` per supportare i 9 stati canonici (allineato al constraint DB già migrato in `20260419100854`)
2. Riscrivo i 2 file test:
   - `src/lib/__tests__/leadEscalation.test.ts`
   - `src/__tests__/escalation-logic.test.ts`
3. Aggiorno funzione DB `get_dashboard_snapshot` (riga `contacted_partners`/`contacted_contacts`) per usare `first_touch_sent`
4. Aggiorno `get_contact_group_counts` (CASE su `lead_status`) per i 9 stati
5. Re-run Vitest → 1562/1562 verde

---

### Blocco 3 — Debito architetturale (NON ORA)
**581 ESLint errors per `supabase.from()` fuori da DAL** sono debito noto, non bug. Non blocca produzione, non blocca build.

**Decisione:** lascio in `warn` come oggi, non promuovo a `error`. Apro issue tracker (`.github/issues-drafts/dal-bypass-cleanup.md`) con:
- Conteggio per file
- Top-10 file più problematici
- Piano migrazione progressiva (10 file/sprint)

Affrontarlo ora = 2 settimane di lavoro meccanico ad alto rischio regression. ROI bassissimo.

**Edge function failures (21):** ~19 sono falsi positivi tooling (Vitest invece di Deno). Le 2 reali (`platformTools_test.ts`) le sistemo dentro Blocco 1 come effetto collaterale (sono test su funzioni che toccano credits/operators).

---

### Sequenza esecuzione

```text
Step 1: Migration SQL sicurezza (Blocco 1)
        ↓
Step 2: Verifica con security_scan + linter
        ↓
Step 3: Aggiorno leadEscalation.ts + 2 file test
        ↓
Step 4: Migration SQL per get_dashboard_snapshot + get_contact_group_counts
        ↓
Step 5: Re-run Vitest completo (target: 1562/1562)
        ↓
Step 6: Build production check
        ↓
Step 7: Issue draft per debito DAL (Blocco 3)
        ↓
Step 8: Report finale in /mnt/documents/test_report_2026-04-19_v2.md
```

### Tempi stimati
- Blocco 1: 15-20 min (migrazione lunga, attenzione a non rompere RLS esistenti)
- Blocco 2: 5-8 min
- Verifica + report: 5 min
- **Totale: ~30 min**

### Cosa NON faccio in questo giro
- Riorganizzazione modulare (rifiutata)
- Pulizia 581 DAL bypass (basso ROI ora)
- Test E2E Playwright (sandbox limit)
- Modifica codice email/IMAP (vincolo assoluto memorie)

### Output finale
- DB più sicuro (0 ERROR security scan)
- Test verdi (1562/1562)
- Tassonomia lead allineata DB ↔ codice ↔ test
- 1 issue draft per debito DAL (tracciato, non risolto)
- Report consolidato in `/mnt/documents/`
