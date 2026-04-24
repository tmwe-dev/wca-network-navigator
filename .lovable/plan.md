
# Piano — Pausa sistema + reset attività + fix Coda AI

## Diagnosi DB (numeri reali ora)

| Cosa | Numero | Origine |
|---|---|---|
| `activities` pending | **2.611** | Trigger `on_inbound_message` su ogni email IMAP, anche spam/newsletter |
| `activities` con `executed_by_agent_id` | **0** | Coda AI sempre vuota |
| `cockpit_queue` (tutte `queued`) | 8 | Vecchi BCA/partner_contact, invisibili in UI (cerca `pending`/`scheduled`/`failed`) |
| `outreach_missions` | **0** | Nessuna missione attiva |
| `agent_tasks` pending+proposed | 220 | Vecchia tabella, non visibile in Coda AI |
| `channel_messages` inbound 24h | **492** | Sync IMAP gira ogni 3 e 5 min |
| Cron attivi | `email_cron_sync_tick` (5min), `email-sync-worker` (3min) | Continuano a generare attività |

**Causa**: Il trigger `on_inbound_message` crea SEMPRE una activity `follow_up` per ogni inbound, indipendentemente dal mittente. Newsletter, notifiche di sicurezza, conferme PosteID, fatture Apple → tutte diventano "task da gestire".

## Cosa faccio (3 interventi)

### 1. Toggle "Pausa Sistema" (admin only)

Aggiungo un controllo unico nel badge diagnostico admin (top dashboard) chiamato **"Pausa Sistema"**. Quando ON:

- Disattiva i cron `email_cron_sync_tick` e `email-sync-worker` (no più letture IMAP)
- Disattiva il trigger `on_inbound_message` (no più classificazione/creazione attività anche se arrivano messaggi da altre fonti)
- Mostra banner rosso "Sistema in pausa — no letture/classificazione attive"

Quando OFF: riattiva tutto. Stato persistito in tabella nuova `system_settings(key, value)` letto via RPC `get_system_paused()`.

**Interfaccia**: switch grande dentro il pannello del badge diagnostico, accanto ai numeri. Solo admin lo vede.

### 2. Reset attività fantasma

Al primo click su "Pausa Sistema" mostro un dialog con conteggio attività:
> "Hai 2.611 attività in coda. Vuoi azzerarle?"
- **Sì → cancella tutte** (`DELETE` reale dalle 2.611 follow_up auto-generate)
- **Solo da partner reali** (tieni quelle con `partner_id` valorizzato e mappato)
- **No, solo pausa**

Cleanup parallelo: i **8 cockpit_queue** in stato `queued` → marco tutti `cancelled`.

### 3. Fix Coda AI

Due problemi:
- a) La query legge `activities WHERE executed_by_agent_id IS NOT NULL` ma nessun agente scrive in `activities`. I 220 task vivono in `agent_tasks` (status `pending`/`proposed`).
- b) `outreach_missions` è vuota: gli agenti non hanno missioni assegnate, quindi non producono.

**Cosa faccio in questa iterazione**:
- Modifico `CodaAITab` per leggere da **`agent_tasks WHERE status IN ('proposed','pending')`** in OR con activities-con-agent. Così i 220 task esistenti diventano visibili e approvabili.
- Aggiungo nota "Nessuna missione attiva" se `outreach_missions` è vuota, con CTA per crearne una (link a `/v2/missions`).

Non tocco la creazione di missioni autopilot in questo round (è un capitolo a sé).

## Tecnica

**DB (migration):**
```sql
CREATE TABLE public.system_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid
);
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin read" ON public.system_settings FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "admin write" ON public.system_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

-- RPC che applica/rimuove la pausa
CREATE OR REPLACE FUNCTION public.set_system_paused(p_paused boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_paused THEN
    PERFORM cron.unschedule('email_cron_sync_tick');
    PERFORM cron.unschedule('email-sync-worker');
    EXECUTE 'ALTER TABLE public.channel_messages DISABLE TRIGGER trg_on_inbound_message';
  ELSE
    -- ri-creo i cron con la stessa schedule
    PERFORM cron.schedule('email_cron_sync_tick','*/5 * * * *', _cron_invoke_edge_sql('email-sync-worker'));
    PERFORM cron.schedule('email-sync-worker','*/3 * * * *',  _cron_invoke_edge_sql('email-sync-worker'));
    EXECUTE 'ALTER TABLE public.channel_messages ENABLE TRIGGER trg_on_inbound_message';
  END IF;

  INSERT INTO public.system_settings(key,value,updated_by)
  VALUES ('paused', to_jsonb(p_paused), auth.uid())
  ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=now(), updated_by=auth.uid();

  RETURN jsonb_build_object('paused', p_paused);
END $$;

-- RPC pulizia attività fantasma
CREATE OR REPLACE FUNCTION public.purge_inbound_activities(p_only_orphans boolean DEFAULT false)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_count int;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin'::app_role) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_only_orphans THEN
    DELETE FROM public.activities
    WHERE activity_type='follow_up'
      AND title LIKE 'Reply received%'
      AND (partner_id IS NULL OR NOT EXISTS (SELECT 1 FROM partners p WHERE p.id=activities.partner_id));
  ELSE
    DELETE FROM public.activities
    WHERE activity_type='follow_up' AND title LIKE 'Reply received%' AND status='pending';
  END IF;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $$;
```
Nota: trovo il nome esatto del trigger prima della migration; se diverso da `trg_on_inbound_message` lo correggo.

**Frontend:**
- `src/v2/ui/components/admin/SystemPauseToggle.tsx` (nuovo) — switch + dialog cleanup
- Inserito dentro `SystemDiagnosticsBadge.tsx` esistente
- `src/v2/hooks/useSystemPaused.ts` (nuovo) — read/write via RPC
- `src/components/outreach/CodaAITab.tsx` — query estesa a `agent_tasks`
- `src/components/outreach/InUscitaTab.tsx` — opzionale: mappare `queued` → `pending` nel filtro (cleanup pre-emptivo dei record vecchi rende non necessario)

**Cleanup oneshot via insert tool:**
```sql
UPDATE public.cockpit_queue SET status='cancelled' WHERE status='queued';
```

## Cosa NON faccio in questo round

- Non riscrivo la logica del classifier inbound (la blocklist domini per filtrare spam alla fonte è P3.2 dedicato)
- Non creo missioni autopilot di default
- Non tocco `outreach_missions` (resta vuoto fino a quando non crei una missione)

## Verifica post-deploy

1. Badge admin: switch "Sistema in pausa" appare e funziona
2. Click pausa → cron disattivati (verifico con `SELECT * FROM cron.job WHERE active=true`)
3. Cleanup: 2.611 → 0 (o N solo da partner)
4. Coda AI mostra i 220 task agent_tasks
5. Riapro pausa → cron tornano attivi, sync IMAP riprende
