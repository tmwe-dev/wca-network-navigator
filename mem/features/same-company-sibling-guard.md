---
name: Same-Company Sibling Guard
description: Quando si invia/approva un messaggio a contatto X di Partner P, tutti i sibling (stesso partner o stessa azienda con sedi diverse via normalize_company_name) entrano automaticamente in holding. La coda PendingActionsPanel evidenzia in rosso le azioni a rischio e richiede doppia conferma.
type: feature
---
**Backend**:
- `partner_contacts.parent_contact_id`, `auto_held_at`, `auto_held_reason` (motivo: `auto_held_by_sibling`)
- `normalize_company_name(text)` IMMUTABLE: lower + strip suffissi (S.p.A./S.r.l./Inc/Ltd/GmbH/...) + strip non alphanumeric
- `apply_sibling_holding(parent_contact_id)` SECURITY DEFINER: marca i sibling come auto_held
- `check_sibling_risk(partner_id, contact_id?, window_days=30)` SECURITY DEFINER: ritorna i sibling già contattati in outbound recente (stesso partner o stessa company normalizzata)
- Trigger `trg_apply_sibling_holding_on_outbound` su INSERT `channel_messages` direction='outbound': risolve contact da to_address e chiama l'RPC. Mai bloccante (EXCEPTION → RETURN NEW).

**Frontend**:
- DAL `src/data/siblingRisk.ts`: `checkSiblingRisk()`
- `src/components/ai-control/SiblingRiskBadge.tsx`: banner rosso con dettagli + checkbox doppia conferma
- `PendingActionsPanel`: ogni azione `send_email|send_whatsapp|send_linkedin` mostra il badge se a rischio; bottoni Approva/Approva Modificato/Approva come è disabilitati finché la conferma non è spuntata (`ApproveGuardedButton` interno chiama `useHasSiblingRisk`).

**Limiti noti**:
- Nomi azienda con città inclusa ("Barilla — Parma" vs "Barilla — Milano") NON matchano cross-partner. OK per MVP: se sono BCA distinte con stesso `company_name` canonico funziona.
- 30 giorni finestra di guardia (param `_window_days`).
