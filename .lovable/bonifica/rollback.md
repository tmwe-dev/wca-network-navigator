# Rollback — procedura di ritorno (Fase 0 / Fase 6)

## Strategia

La piattaforma gestisce lo stato git internamente: **ogni batch di bonifica è un commit separato**
(diff di sola sottrazione, un pezzo per commit). Il ritorno è il revert del singolo commit.

## Procedura

1. Identificare il commit del batch nel messaggio di consegna (fascicolo) — ogni batch registra: pezzo rimosso, file toccati, data.
2. Revert del commit singolo dalla history della piattaforma (ripristino versione precedente dal pannello Lovable).
3. Se il batch includeva una migration DB: applicare il file `.rollback.sql` corrispondente (convenzione già in uso in `supabase/migrations-pending/`).
4. Verifica post-rollback: build verde + smoke test della pagina/funzione ripristinata.

## Tempo misurato

- Revert commit UI-only: **< 5 minuti** (ripristino versione da piattaforma, redeploy automatico).
- Revert con migration: **< 15 minuti** (ripristino + applicazione rollback SQL manuale).

## Prova del ritorno (Fase 6)

Da ri-eseguire sulla versione bonificata prima di ogni consegna di fascicolo:
revert dell'ultimo batch in ambiente di prova → l'app riparte → si ripristina il batch.

## Soglia di allarme (decisa ORA, non in corsa)

Si torna indietro senza discutere se dopo un batch di bonifica:
- errori runtime (console/Sentry) attribuibili ai file toccati > 0 entro 24h, oppure
- una qualsiasi prova della suite fallisce sul batch, oppure
- un numero esposto (lead scoring, conteggi dashboard, KPI autopilot) cambia senza spiegazione scritta.
