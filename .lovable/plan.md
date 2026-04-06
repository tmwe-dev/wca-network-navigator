
# AI Matching + Azioni operative + Layout migliorato per CRM (Contatti & Biglietti)

## 3 blocchi di lavoro

### 1. Bottone AI Matching nel tab bar CRM

Aggiungere un terzo bottone nella barra tab di `CRM.tsx` (di fianco a Contatti e Biglietti): **"🤖 AI Match"** che apre un `Dialog` fullscreen-like.

**Popup AI Match:**
- Chiama Lovable AI (gemini-flash) passando la lista dei biglietti `unmatched` + un campione di partner dal DB
- L'AI confronta nome azienda, paese, città, telefono, email e restituisce candidati con % di confidenza
- UI: lista ordinata per confidenza decrescente, ogni riga mostra affiancati:
  - **Sinistra**: dati BCA (nome, contatto, paese, città, telefono)
  - **Destra**: dati Partner suggerito (nome, alias, paese, città)
  - **Centro**: % confidenza con barra colorata
- Checkbox per selezione multipla + bottone "Conferma selezionati" che fa `updateBusinessCard` in batch
- Elaborazione in batch da 20 alla volta per non sovraccaricare

### 2. Azioni operative su selezione (Contatti + Biglietti)

**BusinessCardsHub** — quando `selectedIds.size > 0`, aggiungere barra azioni bulk (stesso pattern del `ContactListPanel`):
- **Workspace** → crea attività email per i biglietti selezionati
- **Campagna** → crea campaign_jobs
- **Deep Search** → invoca deep-search per arricchimento
- **LinkedIn Lookup** → cerca URL LinkedIn
- **Email diretta** → apre composer con i selezionati
- **WhatsApp** → invia messaggio ai selezionati con telefono

**BusinessCardDetailPanel** — aggiungere sotto "Azioni rapide":
- **→ Cockpit** (trasferisci al cockpit)
- **→ Workspace** (crea attività email)
- **Genera Alias**
- **Programma follow-up** (stessa logica ContactActionMenu)

### 3. Layout migliorato card BCA (CompactRow)

La CompactRow attuale è troppo compressa e illeggibile. Ristrutturazione:

**CompactRow → due righe:**
```text
Riga 1: [checkbox] [🇮🇹] Nome Azienda                    [Match/No match] [📧] [📞]
Riga 2:           👤 Nome Contatto · Posizione  · 📍 Città   [Evento] [Anno WCA]
```

- Allineamento fisso a sinistra per tutti gli elementi
- Spazio minimo `py-2` invece di `py-1.5`
- Se matched con partner WCA, mostrare anno di membership (da `partner.enrichment_data`)
- Font size aumentato per company name (text-xs → text-sm)

**CardGridItem e ExpandedCardItem:**
- Aggiungere anno membership WCA se disponibile
- Mostrare paese con bandiera emoji
- Allineare icone di azione a destra

### File coinvolti

| File | Modifica |
|------|----------|
| `src/pages/CRM.tsx` | Aggiungere bottone "AI Match" + import Dialog |
| `src/components/contacts/BusinessCardsHub.tsx` | Barra azioni bulk, layout CompactRow su 2 righe, azioni nel detail panel, popup AI Match |
| `src/components/contacts/ContactCard.tsx` | Minor: verificare allineamento consistente (già buono) |

Nessuna migrazione DB. L'AI matching usa Lovable AI (gemini-flash) direttamente dal client via edge function.
