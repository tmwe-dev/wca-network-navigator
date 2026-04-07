

# Arricchimento card contatti sidebar + azioni rapide + fix email CRM

## Problemi identificati

1. **Card contatti nella sidebar troppo scarne** — mostrano solo bandiera, nome azienda, nome contatto e email. Manca: città, telefono, origine, azioni rapide (⋮)
2. **Icona globo inutile** — nel gruppo "country" il globo non serve, la bandiera del paese basta
3. **Nessun filtro per città** dentro i gruppi espansi
4. **Nessun menu azioni rapide (⋮)** sulle card nella sidebar (né contatti né biglietti)
5. **Email dal CRM non porta all'email composer** — il click sull'icona mail nella barra bulk non trasferisce correttamente i destinatari

## Piano di intervento

### 1. Arricchire la card contatto nella sidebar CRM

Nel `CRMContactNavigator` (riga ~955 di `FiltersDrawer.tsx`), la card di ogni contatto dentro un gruppo espanso diventa:

```text
🇮🇹 Azienda Nome                    ⋮
   👤 Contatto · Ruolo   📍 Milano
   📧 email@...  📱 +39...
```

- Bandiera sempre visibile (già c'è)
- Aggiungere città sotto il nome
- Aggiungere icona telefono se presente
- Aggiungere mini-badge origine (come nel Cockpit)
- Aggiungere menu ⋮ con `ContactActionMenu` per azioni rapide (Email, WhatsApp, Cockpit, ecc.)
- Rimuovere il globo inutile dal label del gruppo

Dati già disponibili nella query: `id, name, company_name, company_alias, country, email, position, origin` → aggiungere `phone, city, lead_status, enrichment_data` alla select

### 2. Filtro per città dentro il gruppo espanso

Quando un gruppo è espanso e contiene >10 contatti, mostrare un mini-input "Filtra per città/nome…" in cima al gruppo espanso che filtra client-side i contatti caricati.

### 3. Sub-filtro gruppo ↔ paese / paese ↔ gruppo

Nella sezione "Raggruppa per", quando si raggruppa per origine, dentro ogni gruppo espanso mostrare un chip-filter per paese. E viceversa: se raggruppo per paese, mostrare chip-filter per origine dentro il gruppo. Questo viene fatto client-side sui contatti già caricati nel gruppo.

### 4. Menu azioni rapide (⋮) nella sidebar

Importare `ContactActionMenu` e renderizzarlo su ogni riga contatto nella sidebar. Il menu si apre al click sul ⋮ senza selezionare il contatto.

Per i biglietti da visita (BCA), aggiungere lo stesso pattern: ⋮ con azioni Email, WhatsApp, Cockpit disponibili direttamente dalla lista.

### 5. Fix: email bulk dal CRM → email composer

In `ContactListPanel.tsx` il bottone "Workspace" nella barra bulk (riga ~117) chiama `actions.handleAICommand({ type: "send_to_workspace" })`. Verificare che questa azione:
- Raccolga gli email dei contatti selezionati
- Navighi a `/email-composer` con i destinatari precompilati
- Se non funziona, correggere usando `useDirectContactActions.handleSendEmail` o navigazione diretta con `prefilledRecipients` (plurale, array)

### 6. Stessa cosa per BCA

Nella lista biglietti (`BusinessCardsHub.tsx`), aggiungere il menu ⋮ a ogni card nella vista compact/list, usando `useDirectContactActions` per le azioni Email e WhatsApp.

## File coinvolti

| File | Modifica |
|------|----------|
| `src/components/global/FiltersDrawer.tsx` | Arricchire card nel `CRMContactNavigator`: aggiungere campi alla query (phone, city, lead_status), layout 2 righe, menu ⋮, filtro città inline, sub-filtro cross-group |
| `src/components/contacts/BusinessCardsHub.tsx` | Aggiungere menu ⋮ alle card nella lista compact |
| `src/components/contacts/ContactListPanel.tsx` | Fix bulk email → email composer con destinatari corretti |
| `src/hooks/useContactActions.ts` | Verificare/correggere `send_to_workspace` per passare email array al composer |

Nessuna migrazione DB.

