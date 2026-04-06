

# Azioni interattive sui contatti: audit completo e allineamento

## Analisi dello stato attuale

Ho esaminato tutti i punti del sistema dove vengono mostrati contatti con email/telefono/WhatsApp. Ecco la situazione:

| Sezione | Email | WhatsApp | Circuito di attesa | Stato |
|---------|-------|----------|-------------------|-------|
| **Network → PartnerDetailCompact** | ✅ Apre Email Composer + attività | ✅ Invio via extension bridge + attività | ✅ | Completo |
| **BCA Hub → BusinessCardDetailPanel** | ❌ Solo `mailto:` passivo | ❌ Solo link `wa.me/` esterno | ❌ Nessuna attività | Da fare |
| **BCA View (Operations)** | ❌ Solo icone tooltip, non cliccabili | ❌ Assente | ❌ | Da fare |
| **Contatti → ContactDetailPanel** | ❌ Solo `mailto:` passivo | ❌ Solo link `wa.me/` esterno | ❌ Nessuna attività | Da fare |
| **Prospect → ProspectListPanel** | ❌ Solo `mailto:` passivo | ❌ Assente | ❌ | Da fare |
| **Cockpit → AIDraftStudio** | ✅ Via `handleSend` + `handleSendWhatsApp` | ✅ Via extension bridge | ✅ | Completo |
| **ContactRecordActions (drawer)** | ❌ Solo `mailto:` | ❌ Solo `wa.me/` esterno | ❌ | Da fare |

## Problema

5 aree su 7 usano link passivi (`mailto:`, `wa.me/`) che non passano per il sistema interno: nessuna attività creata, nessun ingresso nel circuito di attesa, nessun tracciamento.

## Piano di intervento

### 1. BusinessCardDetailPanel (BCA Hub) — Priorità alta
File: `src/components/contacts/BusinessCardsHub.tsx` (righe 320-420)

- Aggiungere `useNavigate` e `useWhatsAppExtensionBridge`
- Sostituire il link `mailto:` con un bottone che naviga a `/email-composer` con il contatto pre-compilato (stessa logica di PartnerDetailCompact)
- Sostituire il link telefonico del mobile con un bottone WhatsApp che usa il bridge dell'estensione
- Dopo invio WhatsApp riuscito: creare record in tabella `activities` con tipo `whatsapp_message`
- Aggiornare `lead_status` del biglietto a `contacted` se era `new`

### 2. ContactDetailPanel (Contatti Commerciali)
File: `src/components/contacts/ContactDetailPanel.tsx` (righe 242-258)

- Sostituire `<a href="mailto:">` con bottone che naviga a `/email-composer`
- Sostituire il link `wa.me/` con invio via extension bridge + creazione attività
- Aggiornare lead_status del contatto

### 3. ProspectListPanel
File: `src/components/prospects/ProspectListPanel.tsx` (righe 375-410)

- Stessa logica: email → composer, WhatsApp → bridge, creazione attività per ogni contatto del prospect

### 4. ContactRecordActions (drawer contatto)
File: `src/components/contact-drawer/ContactRecordActions.tsx`

- Sostituire `mailto:` e `wa.me/` con le azioni interne (composer + bridge)

### 5. BCA View (Operations) — Cards nella lista
File: `src/components/operations/BusinessCardsView.tsx` (righe 440-500)

- Rendere le icone Mail/Phone cliccabili nelle 3 view mode (compact, card, expanded)
- Click su Mail → `/email-composer`, click su icona WhatsApp → bridge

## Dettagli tecnici

Pattern uniforme per ogni area:
```text
handleSendEmail(contact):
  navigate("/email-composer", { state: { prefilledRecipient: { email, name, company, ... } } })

handleSendWhatsApp(contact):
  cleanPhone → sendWhatsApp(cleanPhone, "")
  if success → supabase.from("activities").insert({ activity_type: "whatsapp_message", ... })
  if success → update lead_status to "contacted" if "new"
  if fail → toast.error con contesto
```

## File coinvolti

| File | Intervento |
|------|-----------|
| `src/components/contacts/BusinessCardsHub.tsx` | Detail panel: azioni email/WA interattive |
| `src/components/contacts/ContactDetailPanel.tsx` | Quick actions: email/WA via sistema interno |
| `src/components/prospects/ProspectListPanel.tsx` | Contatti prospect: email/WA interattive |
| `src/components/contact-drawer/ContactRecordActions.tsx` | Drawer: azioni via sistema interno |
| `src/components/operations/BusinessCardsView.tsx` | Icone cliccabili nelle card BCA |

## Risultato atteso

Ogni punto del sistema dove compare un'email o un numero di telefono diventa un'azione diretta che: (1) apre il composer email o invia via WhatsApp bridge, (2) crea un record attività, (3) aggiorna il lead_status per far entrare il contatto nel circuito di attesa. Comportamento identico a quello già funzionante nel Network e nel Cockpit.

