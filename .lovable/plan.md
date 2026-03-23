

# Piano: Super Assistente Conversazionale con STT Continuo e Daily Plan

## Problema

1. **Microfono si ferma dopo 2-3 secondi** — in tutte le implementazioni (GlobalChat, HomeAIPrompt, IntelliFlow) il SpeechRecognition ha `continuous = false` e `interimResults = false`. Il riconoscimento cattura una sola frase e si spegne.

2. **Nessuna distinzione tra modalita' conversazionale e operativa** — oggi ogni chat e' operativa (esegue comandi). Manca una modalita' "consulente strategico" per discutere, pianificare, ragionare insieme.

3. **Nessun Super Assistente** — serve un livello sopra Luca e sopra tutti gli agenti: un consulente che affianca l'utente costantemente, mantiene memoria della giornata, crea daily plan, riassume ogni 10 messaggi.

## Soluzione: 5 interventi

### 1. Fix STT — Microfono continuo fino a disattivazione manuale

In tutti e 3 i componenti (GlobalChat, HomeAIPrompt, IntelliFlowOverlay):
- `continuous = true` — il microfono resta attivo
- `interimResults = true` — mostra testo parziale in tempo reale nell'input
- Il microfono si ferma SOLO quando l'utente clicca di nuovo il bottone
- `onresult` accumula il testo invece di sovrascrivere
- `onend` con auto-restart se ancora in modalita' ascolto (workaround per Chrome che stoppa dopo ~60s)

### 2. Selettore di modalita': Conversational vs Operational

Nell'header o nel pannello AI, aggiungere un toggle/segmented control:

```text
[ 🗣 Conversational ] [ ⚡ Operational ]
```

- **Operational** (default): comportamento attuale — comandi, tool-calling, azioni
- **Conversational**: chiama una nuova edge function `super-assistant` con system prompt da consulente strategico. Nessun tool-calling, solo ragionamento, pianificazione, consigli. Contesto completo della pagina corrente iniettato automaticamente.

### 3. Edge function `super-assistant`

Nuova funzione che:
- Ha un system prompt da "Super Consulente Strategico" con accesso alla Knowledge Base completa (Sales KB, procedure operative, stato sistema)
- Riceve il contesto della pagina corrente + statistiche sistema
- NON esegue tool — ragiona, pianifica, suggerisce
- Puo' creare/aggiornare il Daily Plan (via query diretta al DB)
- Ogni 10 messaggi nella conversazione, genera automaticamente un mini-riassunto e lo salva in `ai_memory` con tag `daily_plan` e `session_summary`
- Legge i riassunti precedenti per mantenere continuita' tra sessioni

### 4. Tabella `ai_daily_plans` per il Daily Plan

Nuova tabella per tracciare il piano giornaliero collaborativo:

```sql
CREATE TABLE ai_daily_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan_date date NOT NULL DEFAULT CURRENT_DATE,
  objectives jsonb NOT NULL DEFAULT '[]',
  completed jsonb NOT NULL DEFAULT '[]',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, plan_date)
);
ALTER TABLE ai_daily_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own daily plans" ON ai_daily_plans FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

### 5. Memoria intelligente con riassunti automatici

Il `super-assistant` implementa:
- **Ultimi messaggi freschi**: gli ultimi 20 messaggi inviati completi
- **Riassunti compressi**: ogni 10 messaggi, il sistema genera un riassunto di 2-3 righe salvato in `ai_memory` con tag `session_summary`
- **Daily plan**: obiettivi della giornata letti/scritti dalla tabella dedicata
- **Contesto pagina**: la pagina corrente e le statistiche rilevanti

## File da creare/modificare

| File | Azione |
|------|--------|
| `src/components/global/GlobalChat.tsx` | Fix STT continuo + toggle modalita' |
| `src/components/home/HomeAIPrompt.tsx` | Fix STT continuo |
| `src/components/intelliflow/IntelliFlowOverlay.tsx` | Fix STT continuo + toggle modalita' |
| `supabase/functions/super-assistant/index.ts` | Creare — consulente strategico senza tool-calling |
| Migrazione DB | Creare tabella `ai_daily_plans` |

## Risultato

- Il microfono resta attivo finche' l'utente non lo spegne manualmente
- L'utente puo' scegliere se parlare con il consulente strategico (conversational) o dare comandi operativi (operational)
- Il Super Assistente mantiene memoria della giornata, crea piani di lavoro, riassume le sessioni
- La continuita' tra sessioni e' garantita dai riassunti compressi in `ai_memory`

