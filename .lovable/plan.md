
# Piano: Social Links, Selezione Multipla, Attivita e Rappresentanti

## Panoramica

Tre grandi novita per la pagina Agenti:

1. **Link social** (Instagram, Facebook, LinkedIn) per ogni partner/contatto
2. **Selezione multipla** di agenti dalla lista con azioni di massa
3. **Sistema attivita** con assegnazione a rappresentanti interni

---

## 1. Link Social per Partner

Aggiungiamo i profili social direttamente nella tabella `partner_contacts` (dove gia esistono i contatti delle persone) e nella tabella `partners` (per i profili aziendali).

**Database:**
- Nuova tabella `partner_social_links` con colonne:
  - `id` (uuid, PK)
  - `partner_id` (uuid, FK -> partners)
  - `contact_id` (uuid, FK -> partner_contacts, nullable - se associato a una persona specifica)
  - `platform` (enum: `linkedin`, `facebook`, `instagram`, `twitter`, `whatsapp`)
  - `url` (text)
  - `created_at` (timestamp)
- RLS: accesso pubblico come le altre tabelle

**UI nella scheda Agente:**
- Sezione "Social" con icone cliccabili per ogni piattaforma
- Possibilita di aggiungere/modificare link social manualmente
- Nella card "Contatti Ufficio", ogni persona mostra le sue icone social

---

## 2. Selezione Multipla Agenti

Nella lista a sinistra, aggiungiamo checkbox per selezionare piu agenti contemporaneamente.

**UI:**
- Checkbox accanto a ogni agente nella lista
- Barra azioni flottante in basso quando ci sono selezioni attive, con:
  - Contatore: "X agenti selezionati"
  - Bottoni azione: "Invia Email", "Inserisci in Campagna", "Assegna Attivita", "Registra Telefonata"
  - "Seleziona tutti" / "Deseleziona"
- Stato gestito con `useState<Set<string>>` come gia fatto nella pagina Campaigns

---

## 3. Sistema Attivita e Rappresentanti

**Database - Nuove tabelle:**

Tabella `team_members` (i rappresentanti interni):
- `id` (uuid, PK)
- `name` (text)
- `email` (text, nullable)
- `role` (text, nullable - es. "Sales", "Account Manager")
- `is_active` (boolean, default true)
- `created_at` (timestamp)

Tabella `activities` (le attivita assegnate):
- `id` (uuid, PK)
- `partner_id` (uuid, FK -> partners)
- `assigned_to` (uuid, FK -> team_members, nullable)
- `activity_type` (enum: `send_email`, `phone_call`, `add_to_campaign`, `meeting`, `follow_up`, `other`)
- `title` (text)
- `description` (text, nullable)
- `status` (enum: `pending`, `in_progress`, `completed`, `cancelled`)
- `priority` (enum: `low`, `medium`, `high`)
- `due_date` (date, nullable)
- `completed_at` (timestamp, nullable)
- `created_at` (timestamp)

RLS: accesso pubblico come le altre tabelle.

**UI - Dialogo "Assegna Attivita":**
- Modale con:
  - Tipo attivita (dropdown)
  - Titolo (precompilato in base al tipo, es. "Inviare email a [N] agenti")
  - Descrizione/note
  - Priorita
  - Data scadenza
  - Assegna a (dropdown con lista rappresentanti, con opzione "Aggiungi nuovo")
- Crea una riga in `activities` per ciascun partner selezionato

**UI - Gestione Rappresentanti:**
- Piccolo dialog accessibile dal dropdown "Assegna a" per aggiungere nuovi rappresentanti
- Lista editabile dei rappresentanti (nome, email, ruolo)

**UI - Vista attivita nel dettaglio agente:**
- Nuova card "Attivita" nel pannello destro che mostra le attivita pendenti e completate per quel partner
- Badge con contatore attivita nella lista laterale

---

## Dettagli Tecnici

### Migrazione SQL
Una singola migrazione con:
- Enum `social_platform` (linkedin, facebook, instagram, twitter, whatsapp)
- Tabella `partner_social_links`
- Tabella `team_members`
- Enum `activity_type` (send_email, phone_call, add_to_campaign, meeting, follow_up, other)
- Enum `activity_status` (pending, in_progress, completed, cancelled)
- Tabella `activities`
- RLS policies per tutte le nuove tabelle

### File da creare
- `src/components/agents/SocialLinks.tsx` - Componente per visualizzare/editare link social
- `src/components/agents/BulkActionBar.tsx` - Barra azioni per selezione multipla
- `src/components/agents/AssignActivityDialog.tsx` - Modale assegnazione attivita
- `src/components/agents/ActivityList.tsx` - Lista attivita nel dettaglio partner
- `src/hooks/useTeamMembers.ts` - Hook per CRUD rappresentanti
- `src/hooks/useActivities.ts` - Hook per CRUD attivita

### File da modificare
- `src/pages/Agents.tsx` - Aggiungere checkbox, stato selezione multipla, barra azioni, social links nel dettaglio, card attivita
- `src/hooks/usePartners.ts` - Includere `partner_social_links` nella query di dettaglio

### Flusso operativo tipico
1. L'utente filtra gli agenti per paese/servizio
2. Seleziona 20 agenti con le checkbox
3. Clicca "Assegna Attivita"
4. Sceglie tipo "Inviare Email", assegna a "Luca", data scadenza domani
5. Il sistema crea 20 righe in `activities`, una per partner
6. Luca apre la pagina e vede le sue 20 attivita da completare
