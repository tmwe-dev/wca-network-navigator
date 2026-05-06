# Auto-learning Loop sui Suggerimenti Email

## Cosa fa (in 3 frasi)

Quando assegni un gruppo diverso da quello suggerito dall'AI, il sistema raccoglie un campione delle email di quel mittente e chiede a un agente "Refiner" di capire perché l'AI ha sbagliato. L'agente produce una **proposta di modifica** alle regole di classificazione (descrizione del gruppo, hint, esempi negativi) con una motivazione testuale. Tu vedi la proposta in un pannello dedicato e decidi se applicarla, modificarla o ignorarla.

## Esempio pratico

- AI ha suggerito *"Amministrativo"* per `info@brandX.com`.
- Tu correggi in *"Spam commerciale"*.
- Il Refiner legge le ultime 5 email di `info@brandX.com`: tutte listini, prezzi, broadcast.
- Propone: **«Aggiungi al gruppo Spam commerciale: "broadcast di listini/prezzi anche se intestati come 'Amministrazione'"»** + nota: «"Amministrativo" deve restare su comunicazioni 1-a-1 di natura contabile/contrattuale, non su mailing list di prodotti».
- Tu vedi nel pannello "Proposte AI", clicchi **Applica** e l'hint viene aggiunto al gruppo `Spam commerciale` (o al prompt operativo).

## Componenti

### 1. Tabella `ai_classification_insights`
Salva le proposte. Campi chiave: `trigger_address`, `ai_suggested_group`, `user_chosen_group`, `sample_message_ids[]`, `proposed_target` (group | prompt), `proposed_target_id`, `proposed_change_text`, `reasoning`, `confidence`, `user_note`, `status` (pending/applied/rejected/superseded), `applied_at`, `applied_by`.

### 2. Edge function `refine-classification-rule`
Trigger automatico al click "Assegna" quando il gruppo scelto ≠ `ai_suggested_group`. Input: `address_rule_id`, `chosen_group_id`, `user_note?`. Logica:
- Carica 5 email recenti del mittente (subject + estratto body)
- Carica definizione gruppo AI proposto + gruppo scelto + prompt operativo "Email Groups Classifier"
- Chiama Lovable AI con prompt strutturato → tool-call con schema `{target, change_type, change_text, reasoning, confidence}`
- Inserisce riga in `ai_classification_insights` con `status='pending'`

### 3. Pannello UI "Proposte di apprendimento"
Nuova sezione in cima alla tab Suggerimenti AI con badge contatore. Per ogni proposta:
- Mittente trigger + gruppo AI vs gruppo utente
- Testo proposta in evidenza + reasoning collassabile
- Campioni email cliccabili (apre la pop-up zoom esistente)
- Campo libero per aggiungere/modificare la nota utente
- Pulsanti **Applica**, **Modifica e applica**, **Ignora**

### 4. Edge function `apply-classification-insight`
On approval:
- Se `target=group`: aggiorna `email_sender_groups.classification_hint` (append controllato, dedup)
- Se `target=prompt`: crea nuova versione del prompt operativo "Email Groups Classifier" con la regola aggiunta in sezione "Anti-pattern noti"
- Marca insight `applied`, registra autore + timestamp
- Logga in `ai_interaction_log`

### 5. Auto-promozione (opzionale, on by default)
Se 3+ correzioni indipendenti convergono sulla stessa proposta entro 7 giorni → l'insight passa direttamente a `auto_apply_pending` con notifica e applicazione automatica dopo 24h salvo veto.

## Come ti tocca operativamente

- Lavori normalmente sulla tab Suggerimenti AI: assegni un gruppo diverso quando serve.
- Compare un badge **"3 proposte da rivedere"** in alto.
- Apri il pannello, leggi la proposta in 10 secondi, clicchi Applica (o modifichi il testo).
- Le prossime classificazioni AI useranno automaticamente la regola aggiornata, su tutti gli operatori.

## Dettagli tecnici

- **DAL**: `src/data/aiClassificationInsights.ts` (no `supabase.from()` in UI).
- **Query keys**: nuova famiglia in `src/lib/queryKeys.ts` → `aiInsights`.
- **AI Charter**: `refine-classification-rule` registrato in `ai_scope_registry` con scope `learning.classification`.
- **Editorial review**: non si applica (non è messaging outbound).
- **Soft-delete**: insight rifiutati restano in tabella con `status='rejected'` per audit.
- **RLS**: visibilità globale tra operatori autenticati (coerente con `email_address_rules` shared).
- **Hard guard**: `apply-classification-insight` richiede operatore autenticato; modifica prompt = nuova versione (mai overwrite).
- **Fallback**: se AI non produce proposta valida (low confidence < 0.5), insight non viene creato.

## Scope NON incluso (su richiesta)

- Niente propagazione automatica per dominio (l'utente vuole ragionamento qualitativo, non pattern matching).
- Niente conferma a 2 voci come trigger (basta 1 correzione per scatenare l'analisi; l'auto-apply richiede invece convergenza).

## File da creare/modificare

**Nuovi:**
- `supabase/functions/refine-classification-rule/index.ts`
- `supabase/functions/apply-classification-insight/index.ts`
- `src/data/aiClassificationInsights.ts`
- `src/components/email-intelligence/ClassificationInsightsPanel.tsx`
- migrazione: tabella + RLS + insert in `ai_scope_registry`

**Modificati:**
- `src/components/email-intelligence/AISuggestionsTab.tsx` (pannello in alto + trigger refine post-assign)
- `src/lib/queryKeys.ts`
