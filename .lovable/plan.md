
# Audit Sistema Operativo + Piano Sidebar Destra (MissionDrawer)

## PARTE 1: Stato attuale delle funzionalità operative

### 1.1 Invio Email — 3 percorsi (2 sono OK, 1 duplicato)
| Percorso | Come funziona | Stato |
|----------|---------------|-------|
| **Email Composer** (`/email-composer`) | UI manuale → edge function `send-email` via SMTP | ✅ OK, percorso principale |
| **AI Agent** (`ai-assistant` / `agent-execute`) | Tool `send_email` → chiama edge function `send-email` | ✅ OK, stesso endpoint |
| **Outreach Queue** (`outreach_queue` table) | Agent inserisce in coda → `useOutreachQueue` processa client-side → chiama `send-email` | ⚠️ Ridondante: è un wrapper attorno a `send-email` che aggiunge complessità. Utile solo per batch/delay |

**Proposta**: Mantenere tutti e 3 ma documentare che `send-email` è l'unico endpoint SMTP. La queue resta per batch automatici.

### 1.2 Invio WhatsApp — 2 percorsi (entrambi client-side)
| Percorso | Come funziona |
|----------|---------------|
| **Click diretto** (card, sidebar, cockpit) | Apre `wa.me/{phone}` in nuovo tab |
| **Outreach Queue** | Agent inserisce in `outreach_queue` con `channel: "whatsapp"` → `useOutreachQueue` inietta messaggio via estensione Chrome |

**Proposta**: OK così. Il click diretto è per azione manuale, la queue per automazione via agent. Nessun duplicato.

### 1.3 Invio LinkedIn — 2 percorsi (OK)
| Percorso | Come funziona |
|----------|---------------|
| **Click diretto** | Apre profilo LinkedIn in nuovo tab |
| **Outreach Queue** | Agent inserisce in queue → estensione Chrome inietta messaggio nel tab LinkedIn attivo |

**Proposta**: OK, stesso pattern di WhatsApp.

### 1.4 Inserimento Cockpit — 1 percorso
Via evento `crm-send-cockpit` dal CRM / dal MissionDrawer. Inserisce in `cockpit_queue`.
**Stato**: ✅ unico percorso.

### 1.5 Inserimento Workspace — 1 percorso
Via evento `send_to_workspace` / azione bulk. Crea attività con `source_type: "workspace"`.
**Stato**: ✅ unico percorso.

### 1.6 Deep Search — 2 edge functions (non duplicati)
| Funzione | Target |
|----------|--------|
| `deep-search-partner` | Partner WCA (tabella `partners`) |
| `deep-search-contact` | Contatti CRM (tabella `imported_contacts`) |

**Proposta**: OK, servono entrambi perché operano su tabelle diverse.

### 1.7 Ricerca Alias — 1 percorso
Edge function `generate-aliases` → AI genera alias per company_name.
**Stato**: ✅ unico.

### 1.8 Ricerca Logo Google — integrata in deep search
Il logo viene cercato durante `enrich-partner-website` (scraping sito partner).
**Stato**: ✅ nessun duplicato.

### 1.9 Enrichment pipeline
```
deep-search-partner/contact → {
  enrich-partner-website   (scrape sito)
  linkedin-profile-api     (scrape LI)
  parse-profile-ai         (analisi AI profilo)
  whatsapp-ai-extract      (verifica WA)
}
```
Tutto orchestrato dal `DeepSearchOptionsDialog` che permette selezione granulare.
**Stato**: ✅ modulare, nessun duplicato reale.

### 1.10 Duplicati da eliminare/consolidare
| Problema | Dettaglio | Azione |
|----------|-----------|--------|
| `send-email` vs `email-imap-proxy` (action: send) | Entrambi inviano email via SMTP. `email-imap-proxy` con action "send" fa la stessa cosa di `send-email` | **Consolidare**: far puntare tutto a `send-email`, deprecare la send in `email-imap-proxy` |
| `ai-assistant` vs `cockpit-assistant` | Due edge function AI con tool identici (send_email, search_partners, ecc.) ma prompt diversi | **OK**: servono entrambi, uno per contesto outreach, l'altro per assistente generale |
| `agent-execute` vs `ai-assistant` | `agent-execute` è per task batch automatici degli Agent, `ai-assistant` è interattivo | **OK**: architetture diverse, stessi tool |

---

## PARTE 2: Piano Sidebar Destra (MissionDrawer) — Stato attuale e proposta

### 2.1 Dove è visibile oggi
Il MissionDrawer è **globale** — si apre da qualsiasi pagina tramite la linguetta destra. Ma il contenuto cambia in base alla route:

| Pagina | Sezione mostrata | Contenuto |
|--------|-----------------|-----------|
| `/outreach` | Mission Config completo | Preset, Obiettivo, Proposta, Docs, Link, Qualità, Destinatari |
| `/network` | Azioni Network | Sync WCA, Deep Search, Alias batch, Export + Destinatari |
| `/crm` | Azioni CRM | Deep Search, LinkedIn, → Cockpit, Export + Destinatari |
| `/settings` | Strumenti | Avvia batch, Export |
| `/email-composer` | Mission Config + Destinatari | Come outreach |
| Altre pagine | Mission Config base | Solo preset/obiettivo/proposta (senza azioni contestuali) |

### 2.2 Problemi attuali
1. **Pagine senza azioni contestuali**: Agenda, Import, Inreach, Diagnostics, AILab → mostrano solo il Mission Config generico che non serve
2. **Nessuna sincronizzazione dei dati**: quando cambio pagina, il MissionDrawer non riflette il contesto della pagina (es. contatto selezionato nel CRM)
3. **Destinatari solo da `partners`**: la ricerca destinatari cerca solo nella tabella `partners`, non in `imported_contacts` → nel CRM non funziona
4. **Nessun riepilogo attività**: manca un pannello "To-do / prossime attività" che sarebbe utile in ogni contesto
5. **Azioni CRM/Network sono solo bottoni con toast**: non danno feedback reale sullo stato dell'operazione

### 2.3 Proposta di ristrutturazione

La sidebar destra diventa un **pannello operativo contestuale** con 4 sezioni sempre presenti (ma con contenuto dinamico):

```
┌─────────────────────────────┐
│ 🎯 MISSION CONTROL          │  ← Header con contesto pagina
│ [Outreach] [Network] [CRM]  │
├─────────────────────────────┤
│ 📋 ATTIVITÀ                 │  ← Sempre visibile
│ • 3 email da inviare        │     To-do e attività pendenti
│ • 2 follow-up oggi          │     dal DB (activities table)
│ • 1 deep search in corso    │
├─────────────────────────────┤
│ ⚡ AZIONI RAPIDE             │  ← Contestuali alla pagina
│ [Deep Search] [Alias]       │     Cambiano per pagina
│ [Export] [→ Cockpit]        │
├─────────────────────────────┤
│ 🎯 CONFIGURAZIONE           │  ← Mission Config
│ Obiettivo: [dropdown]       │     Sempre disponibile per
│ Proposta: [dropdown]        │     outreach e generazione
│ Qualità: ⚡/🔥/💎            │
│ Docs: 2 allegati            │
├─────────────────────────────┤
│ 👥 DESTINATARI              │  ← Solo in contesti outreach
│ [Cerca partner/contatto...] │     Cerca in ENTRAMBE le
│ Acme Corp 🇮🇹               │     tabelle (partners +
│ Beta Srl 🇩🇪                │     imported_contacts)
└─────────────────────────────┘
```

### 2.4 Azioni per pagina

| Pagina | Azioni rapide proposte |
|--------|----------------------|
| `/outreach` (Cockpit) | Genera email, Genera WA, Genera LI, Deep Search sel., Invia batch |
| `/outreach` (Workspace) | Genera email batch, Rigenera selezionati, Export |
| `/outreach` (In Uscita) | Pausa coda, Riprendi, Svuota coda |
| `/outreach` (Attività) | Filtra completate, Export log |
| `/network` | Sync WCA, Deep Search paese, Alias batch, Export, Download contatti |
| `/crm` | Deep Search contatti, LinkedIn lookup, Match WCA, → Cockpit, → Workspace, Export |
| `/email-composer` | Invia, Salva bozza, Carica template |
| `/inreach` | Sync email, Segna letti, Archivia selezionati |
| `/agenda` | Nuova attività, Segna completata |
| `/import` | Importa file, Normalizza, Transfer to CRM |
| `/settings` | Batch enrichment, Export globale, Pulisci duplicati |
| Altre | Solo Mission Config base |

---

## PARTE 3: Azioni concrete

### Step 1 — Consolidamento (nessun duplicato)
- Deprecare `action: "send"` in `email-imap-proxy` e far puntare tutto a `send-email`
- Documentare in un commento in `send-email/index.ts` che è l'unico endpoint SMTP

### Step 2 — MissionDrawer contestuale
- Aggiungere sezione "Attività" con query sulle activities pendenti dell'utente
- Ampliare le azioni rapide per ogni pagina (tabella 2.4)
- Estendere la ricerca destinatari per cercare anche in `imported_contacts`
- Aggiungere feedback stato operazioni (spinner, completamento)

### Step 3 — Sincronizzazione contesto
- Quando un contatto/partner è selezionato nella pagina principale, mostrarlo nel MissionDrawer come "contesto attivo"
- Permettere azioni dirette sul contesto attivo (genera email per questo contatto, deep search questo partner)

## File coinvolti

| File | Modifica |
|------|----------|
| `src/components/global/MissionDrawer.tsx` | Ristrutturazione completa: 4 sezioni, azioni contestuali per pagina, ricerca estesa |
| `supabase/functions/email-imap-proxy/index.ts` | Deprecare handleSend, redirect a send-email |
| `src/hooks/useOutreachQueue.ts` | Nessuna modifica, documentare il ruolo |

Nessuna migrazione DB necessaria.
