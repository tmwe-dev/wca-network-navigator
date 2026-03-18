

## Sistema Sincronizzazione Biglietti da Visita

### Architettura

```text
business_cards (tabella)
├── Dati del biglietto (nome, azienda, email, phone, evento...)
├── matched_partner_id → partners.id (match automatico)
├── matched_contact_id → imported_contacts.id (match automatico)
├── met_at (data incontro), event_name, location
└── match_confidence (0-100), match_status (pending/matched/unmatched)

Matching automatico (DB trigger):
  INSERT business_card → cerca partner per company_name/email
                        → cerca contatto per company_name/email
                        → aggiorna match + confidence

Filtro "incontrati personalmente":
  Partner card + Contact card → icona 🤝 se esiste un business_card collegato

AI assistant → nuovo tool search_business_cards + link_business_card
```

### Modifiche

**1. Database: tabella `business_cards` + trigger matching**

Tabella con: `id`, `user_id`, `company_name`, `contact_name`, `email`, `phone`, `mobile`, `position`, `event_name`, `met_at`, `location`, `notes`, `photo_url`, `matched_partner_id` (nullable), `matched_contact_id` (nullable), `match_confidence` (int), `match_status` (pending/matched/unmatched/manual), `tags` (text[]), `created_at`, `raw_data` (jsonb).

RLS: `auth.uid() = user_id`.

Funzione DB `match_business_card()` come trigger AFTER INSERT: cerca in `partners` per `company_name ILIKE` e in `imported_contacts` per `company_name ILIKE` o `email =`. Imposta `matched_partner_id`, `matched_contact_id`, `match_confidence`.

**2. Frontend: indicatori visivi**

- `PartnerListItem.tsx`: aggiungere icona 🤝 (Handshake da lucide) se il partner ha un business card collegato. Query leggera via nuovo hook `useBusinessCardMatches` che ritorna una mappa `partner_id → boolean`.
- `ContactCard.tsx`: stessa icona nel footer se il contatto ha un match.

**3. Filtri "incontrati personalmente"**

- `useContacts.ts` / `ContactFilters`: nuovo campo `metPersonally?: boolean`. Quando attivo, fa un sub-select su `business_cards` per filtrare solo i contatti con un match.
- `usePartners.ts` / `PartnerFilters`: nuovo campo `metPersonally?: boolean`. Filtra via `.in("id", matchedPartnerIds)`.
- UI filtri: toggle "🤝 Incontrati" nelle barre filtri di Partners e Contacts.

**4. AI assistant: 2 nuovi tool**

- `search_business_cards`: cerca per evento, data, nome, azienda
- `link_business_card`: collega manualmente un biglietto a un partner/contatto

**5. Hook `useBusinessCards`**

Hook React Query per CRUD biglietti da visita + query match status.

### File da creare/modificare

1. **Migrazione SQL** — tabella `business_cards`, funzione `match_business_card()`, trigger
2. **`src/hooks/useBusinessCards.ts`** — hook CRUD + matching queries
3. **`src/components/partners/PartnerListItem.tsx`** — icona handshake
4. **`src/components/contacts/ContactCard.tsx`** — icona handshake
5. **`src/hooks/useContacts.ts`** — filtro `metPersonally`
6. **`src/hooks/usePartners.ts`** — filtro `metPersonally`
7. **`supabase/functions/ai-assistant/index.ts`** — 2 nuovi tool
8. **Barre filtri** — toggle "Incontrati" in ContactFiltersBar e PartnerFiltersSheet

