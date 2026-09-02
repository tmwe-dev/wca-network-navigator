# Bonifica — registro operativo

Applicazione del **Protocollo Bonifica v1.0** (documento di metodo, settembre 2026) a WCA Network Navigator.
Piano approvato: `.lovable/plan/piano-applicazione-del-protocollo-bonifica-a-wca-network-nav-2026-09-02.md`.

## Le tre verità (sintesi operativa)

1. Il codice dice cosa PUÒ succedere. Solo la produzione dice cosa succede → Lente 2 (`usage_events`) prima di tagliare.
2. Ogni riga tolta è un rischio, ogni riga lasciata è un costo → un pezzo per commit, diff di sola sottrazione.
3. Chi non sa perché un mattone è lì, non lo toglie → verdetto "non lo so" = non si taglia.

## File del registro

| File | Contenuto |
| ---- | --------- |
| `inventario.md` | Censimento delle 7 categorie (Fase 1) |
| `verdetti.md` | Matrice delle tre lenti, voce per voce (Fasi 2-3) |
| `quarantena.md` | Pezzi in osservazione con date e criteri di uscita (Fase 4) |
| `rollback.md` | Procedura di ritorno, provata e cronometrata (Fase 0/6) |
| `fascicolo-*.md` | Consegna formale, 8 voci obbligatorie (Fase 7) |
| `snapshot-*.json` | Fotografia dello stato, generata da `scripts/bonifica/snapshot.mjs` |

## Strumenti

- `node scripts/bonifica/snapshot.mjs` — fotografia stato (Fase 0).
- Tabella `public.usage_events` — contatore traffico reale: rotte frontend, edge function, pezzi in quarantena (Lente 2 / Fase 4).
- `supabase/functions/_shared/usageTrack.ts` — helper fire-and-forget per edge function.
- `src/lib/usage/trackUsage.ts` + `useRouteUsage` — tracciamento rotte (montato in `AuthenticatedLayout`).

## Regole inviolabili attive

- Mai mescolare togliere e cambiare nello stesso commit.
- Nessuna rimozione senza una prova che vede l'assenza.
- Nessuna decisione su una sola lente: basta una lente "vivo" perché sia vivo; servono tre "morto" per tagliare.
- Interfacce pubbliche (bridge estensioni WA/LI/email, webhook): solo deprecazione annunciata, mai taglio diretto.
- Nodi critici (DAL, AI charter, journalistReview, soft-delete, RLS, edge AI): nessuna rimozione senza verdetto a tre lenti concordi.

## Stato: Fase 7 chiusa (2026-09-02)

Consegna formale in `fascicolo-20260902.md` (8 voci obbligatorie).
Bilancio: 4 cluster di duplicati unificati, **zero rimozioni di comportamento**,
81 pezzi in quarantena osservata (20 frontend Q1 + 61 edge Q2) con scadenza 2026-10-02.
Prossimo giro subordinato alla riattivazione dei cron per 7 giorni con metriche.
