# LinkedIn dispatch queue orfana — Debito noto

**Stato:** DOCUMENTATO (non bloccante). Ultimo aggiornamento 2026-05-26.

## Contesto

La tabella `extension_dispatch_queue` esiste come reliquia di un design
precedente in cui WhatsApp + LinkedIn passavano da una coda unica
letta dall'estensione browser. Per LinkedIn la regola attuale è
univoca (vedi `mem://constraints/linkedin-single-channel-rule`):

> LinkedIn passa SOLO da `from-webapp-li` (LinkedIn Cookie Sync).
> Partner Connect 3.4.3 respinge le LI-action con `LI_DELEGATED`.

Quindi i record `channel='linkedin'` eventualmente ancora presenti in
`extension_dispatch_queue` sono **orfani**: nessun consumer li legge,
nessun cron li promuove, l'estensione li ignora.

## Perché lasciamo il debito

Bonificare richiederebbe:
1. Migrazione DELETE con archiviazione (vincolo `mem://constraints/no-physical-delete` → soft-delete).
2. Rimozione dei tipi generati Supabase (rigenerazione lato Lovable).
3. Audit di tutti i punti che ancora referenziano la coda per WhatsApp.

Costo > beneficio: la coda non produce side-effect dannosi, non
occupa risorse e non rallenta query critiche (zero JOIN nel hot path).

## Mitigazioni in vigore

- **Hard guard server-side**: `from-webapp-li` è l'unico produttore.
- **Memoria attiva**: `linkedin-single-channel-rule` blocca qualunque
  AI agent dal proporre dispatch LI via coda.
- **Audit periodico**: query manuale ogni trimestre (vedi sotto).

## Query di audit (manuale, trimestrale)

```sql
-- Quanti record LinkedIn orfani esistono?
SELECT
  status,
  COUNT(*) AS n,
  MIN(created_at) AS oldest,
  MAX(created_at) AS newest
FROM extension_dispatch_queue
WHERE channel = 'linkedin'
GROUP BY status
ORDER BY n DESC;

-- Se n > 1000 considerare cleanup (soft-delete batch).
```

## Quando bonificare

Quando avverrà uno di questi trigger:
- La tabella supera 10k record orfani.
- Rifattorizzazione completa di `extension_dispatch_queue` per WhatsApp.
- Migrazione delle estensioni a un altro protocollo.

Fino ad allora: **debito accettato e tracciato**.