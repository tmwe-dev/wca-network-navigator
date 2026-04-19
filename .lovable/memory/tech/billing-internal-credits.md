---
name: Billing Interno (sospeso)
description: Sistema interno aziendale → nessun billing attivo; Stripe rimosso; sistema crediti preservato in DB ma disattivato via kill-switch
type: feature
---

## Stato corrente

- **Nessun piano di abbonamento** (Stripe rimosso integralmente).
- **Nessun credit gate attivo** sull'AI: vedi `mem://tech/cost-control-guardrails`.
- Tabelle `user_credits`, `credit_transactions` restano nel DB per:
  - mostrare un saldo informativo nella UI (non blocca nulla);
  - tracking analytics per stimare costi futuri se si commercializzerà.

## Saldo iniziale

Il trigger `handle_new_user` continua ad assegnare 100 crediti di benvenuto al signup. È irrilevante per l'operatività attuale.

## Display UI

`useCredits` hook mostra `balance`/`totalConsumed` come informazione. Nessun componente lo usa più come gate di accesso.

## Riattivazione billing

Quando si decide di commercializzare:
1. Settare `AI_USAGE_LIMITS_ENABLED=true` (vedi cost-control-guardrails).
2. Reintegrare Stripe + tier dei piani.
3. La logica `consume-credits` + `deduct_credits` RPC è già pronta.
