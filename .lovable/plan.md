
# Due Rubriche Separate — WhatsApp · LinkedIn

## Principio

Email ha già la sua infrastruttura (indirizzi, gruppi, regole, prompt per sender) e **non viene toccata**.

Servono **due nuove rubriche distinte e separate**, una per WhatsApp e una per LinkedIn. Non vanno fuse fra loro né con il CRM. Se un'entry è collegata a un partner o cliente CRM lo mostriamo come **badge informativo**, ma i due elenchi restano fisicamente e visivamente separati.

I CRM ufficiali (`partner_contacts`, `partners`, business cards / WCA) **non vengono toccati**.

---

## 1. Due tabelle DB indipendenti

### `whatsapp_addresses`
- `id`, `user_id`, `operator_id`
- `handle` (numero E.164 normalizzato quando disponibile, altrimenti slug del thread)
- `phone_e164` nullable
- `display_name` (es. "Papa Ernesto", "Imane")
- `chat_thread_id` (id del thread WA quando esposto dal bridge)
- `first_seen_at`, `last_seen_at`, `messages_in_count`, `messages_out_count`, `last_message_at`, `last_direction`
- `linked_partner_id`, `linked_partner_contact_id` nullable → solo badge
- `source` (`auto_inbound` | `auto_outbound` | `manual` | `import`)
- `notes`, `deleted_at`, `deleted_by`
- UNIQUE `(user_id, handle)`

### `linkedin_addresses`
- `id`, `user_id`, `operator_id`
- `profile_url` (canonical, es. `https://www.linkedin.com/in/<slug>`)
- `profile_slug`
- `display_name`
- `headline` (titolo profilo se visibile)
- `first_seen_at`, `last_seen_at`, `messages_in_count`, `messages_out_count`, `last_message_at`, `last_direction`
- `linked_partner_id`, `linked_partner_contact_id` nullable → solo badge
- `source`, `notes`, `deleted_at`, `deleted_by`
- UNIQUE `(user_id, profile_slug)`

Per entrambe:
- soft-delete via trigger globale già esistente,
- RLS coerente con `partner_contacts` (visibilità condivisa autenticati, write protetti),
- index trigram su `display_name` e sull'identificatore.

## 2. Popolamento automatico (lazy)

### Aggiunte minime a `channel_messages`
- `from_name TEXT` e `to_name TEXT` (display name leggibile, separati da `from_address`/`to_address`).
- Backfill da `raw_payload->>'contact'` per i messaggi WA storici.

### Sorgenti di upsert
- **WhatsApp**: `receive-channel-message` (channel=whatsapp) e `send-whatsapp` → upsert in `whatsapp_addresses` con `display_name` da `raw_payload.contact` e `phone_e164`/`handle` quando disponibili.
- **LinkedIn**: `receive-channel-message` (channel=linkedin) e l'edge function di invio LI → upsert in `linkedin_addresses` con `profile_slug`/`profile_url`.

### Estensione bridge WA/LI
Modifiche additive al payload inviato dal bridge: `from_handle` (numero o slug profilo) e `from_display_name` separati. `tab-manager.js` non viene toccato.

### Backfill
Script una-tantum che legge `channel_messages` storici e popola le due tabelle. Idempotente, basato su UNIQUE.

**Niente auto-creazione di `partner_contacts`** → CRM resta pulito. La promozione a CRM è un click manuale.

## 3. Due pagine UI completamente separate

Due voci nella sidebar V2, in un nuovo gruppo "Rubriche" (o sotto "Acquisizione & Ricerca"):

- `/v2/rubrica/whatsapp` → **Rubrica WhatsApp**
- `/v2/rubrica/linkedin` → **Rubrica LinkedIn**

Ogni pagina è un componente a sé, con tabella e colonne dedicate.

### Rubrica WhatsApp
Colonne: Nome visualizzato · Numero (E.164) · Thread · Ultimo messaggio (data + anteprima) · In/Out · Associato a (badge partner se `linked_partner_id`) · Azioni (Apri chat · Scrivi WA · Promuovi a CRM).

### Rubrica LinkedIn
Colonne: Nome visualizzato · Profilo (link) · Headline · Ultima interazione · In/Out · Associato a · Azioni (Apri profilo · Scrivi LI · Promuovi a CRM).

Ricerca **locale** in ogni pagina (cerca solo nella sua tabella). Niente mescolamento fra i due canali.

## 4. Associazione con CRM (solo badge)

`linked_partner_id` viene popolato così:
- WhatsApp → match per `phone_e164` su `partner_contacts.direct_phone`/`mobile` (normalizzato E.164).
- LinkedIn → match su `partner_social_links.url` (linkedin canonical).

Se trovato salviamo l'id come riferimento; se no, resta `null`. In UI mostriamo un badge cliccabile "Partner: Acme S.r.l." che apre la scheda partner. I dati restano nella rubrica del canale, il CRM resta separato.

## 5. Composer (riuso, non nuovo)

- Composer WhatsApp esistente → autocomplete pesca da `whatsapp_addresses`.
- Composer LinkedIn esistente → autocomplete pesca da `linkedin_addresses`.

Due picker separati, ognuno punta solo alla rubrica del proprio canale. Nessuna logica AI/orchestrator/holding pattern viene toccata.

---

## Cosa NON facciamo

- **Non** tocchiamo l'email (indirizzi, gruppi, regole, prompt per sender restano com'è).
- **Non** fondiamo WhatsApp e LinkedIn in una tabella unica.
- **Non** creiamo `partner_contacts` automatici.
- **Non** tocchiamo `check-inbox`, `email-imap-proxy`, `mark-imap-seen`.
- **Non** modifichiamo `tab-manager.js` delle estensioni (già fixato in v3.9.4 / v5.10.4).
- **Non** modifichiamo `journalistReview`, holding pattern, AI orchestrators, send pipeline, dispatcher.
- **Non** rompiamo i nodi critici dei messaggi: ordinamento, dedup, realtime su `channel_messages` restano identici.

---

## Conferme

1. Confermi i nomi pagina **"Rubrica WhatsApp"** e **"Rubrica LinkedIn"**?
2. La **promozione manuale** a CRM (`partner_contacts`) la includiamo nello stesso step o la lasciamo per dopo?
