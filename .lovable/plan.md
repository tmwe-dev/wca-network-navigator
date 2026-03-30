

# Riorganizzazione Sidebar: AI in Settings + Switch Area in Header

## Cosa cambia

### 1. Agenti e Chat Agenti → sotto Impostazioni (non più in Strumenti)

Attualmente "Agenti" e "Chat Agenti" sono nella sezione "Strumenti" del menu. Vanno spostati in una nuova sezione separata **"AI"** posizionata sotto "Sistema", oppure direttamente come sotto-voci di Impostazioni. Per chiarezza li mettiamo in una sezione dedicata **"AI Management"** in fondo al menu, separata dagli strumenti operativi.

### 2. CRM non deve apparire quando sei in Network (e viceversa)

Il codice attuale nasconde CRM quando `inNetwork` e Network quando `inCRM` — ma l'utente riporta che CRM è ancora visibile dall'area Network. Verificando il codice, la logica c'è ma il problema è che nella sezione "Aree" mostra comunque l'altra voce come link. La soluzione: quando sei in un'area specifica, l'altra area non compare nel menu. Al suo posto, nell'**header** della pagina aggiungiamo uno **switch** (toggle o pulsante) per passare rapidamente dall'altra parte senza tornare alla Dashboard.

### 3. Switch rapido nell'header

Quando sei in `/network/*`, l'header mostra un piccolo pulsante "→ CRM" per saltare direttamente. Quando sei in `/crm/*`, mostra "→ Network". Dalla Dashboard o da strumenti condivisi, non appare nessuno switch.

## Piano file

| File | Azione |
|------|--------|
| `src/components/layout/AppSidebar.tsx` | Spostare Agenti e Chat Agenti in nuova sezione "AI" sotto Sistema. Rimuovere completamente CRM/Network dall'area opposta (già fatto ma da verificare). |
| `src/components/layout/AppLayout.tsx` | Aggiungere switch "→ CRM" / "→ Network" nell'header quando in area specifica |

### Struttura menu risultante

```text
Aree
  Dashboard        /
  Network          /network    ← solo se NON in /crm
  CRM              /crm        ← solo se NON in /network

Strumenti
  Outreach         /outreach
  Email Composer   /email-composer
  Agenda           /agenda

AI
  Agenti           /agents
  Chat Agenti      /agent-chat

Sistema
  Impostazioni     /settings
```

### Switch header

```text
┌─[☰]─── WCA Partners ────────────── [→ CRM] ──┐
│  ...contenuto Network...                       │
```

Il pulsante switch usa `useNavigate` per saltare all'altra area. Stile: piccolo badge/button con icona e testo, posizionato nell'header accanto al titolo o a destra.

