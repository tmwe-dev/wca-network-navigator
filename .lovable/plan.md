

# Ottimizzazioni Sistema Cognitivo — 4 Interventi Mirati

## 1. Latenza Rolling Summary (Fase 3) — Compressione Parallela

**Problema attuale**: `compressMessages` fa una chiamata API bloccante PRIMA della risposta all'utente, aggiungendo 1-3 secondi di latenza.

**Soluzione**: Eseguire la compressione in modo non-bloccante:
- Se `messages.length > 8`, la prima volta si usa il fallback (ultimi 6 messaggi, no API call)
- La compressione viene salvata come "rolling_summary" nella history lato client (`useAiAssistantChat`)
- Al messaggio successivo, il summary pre-calcolato viene incluso nel payload — zero latenza aggiuntiva

**File**:
| File | Modifica |
|------|----------|
| `supabase/functions/ai-assistant/index.ts` | Rendere `compressMessages` asincrono e non-bloccante: se il summary non è ancora pronto, usare truncamento semplice. Salvare il summary in DB come memoria L1 per riuso |
| `src/hooks/useAiAssistantChat.ts` | Dopo ogni risposta AI con >8 messaggi, triggerare la compressione in background (POST separato) e includere il summary nel prossimo invio |

---

## 2. Decay Calibrato (Fase 2) — Prevenire Amnesia

**Problema attuale**: Decay lineare `confidence - (decay_rate × days)`. Con 2%/giorno, una L1 a confidence 0.50 viene pruned (< 0.05) in ~23 giorni. Potrebbe essere troppo aggressivo per utenti che tornano dopo un weekend.

**Modifiche**:
- Cambiare formula a **decay esponenziale**: `confidence × (1 - decay_rate)^days` — più morbido, non azzera mai completamente
- Aggiungere **grace period**: nessun decay per i primi 3 giorni dopo l'ultimo accesso
- Ridurre soglia pruning da 0.05 a **0.02** per L1
- Aggiungere log delle stats nel promoter per monitoraggio

**File**:
| File | Modifica |
|------|----------|
| `supabase/functions/memory-promoter/index.ts` | Formula esponenziale + grace period 3 giorni + soglia pruning 0.02 |

---

## 3. Auto-Save Potenziato (Fase 2) — Meno Dipendenza da Feedback Utente

**Problema**: I FeedbackButtons esistono ma gli utenti li usano raramente. L'auto-save post-tool è più determinante.

**Modifiche**:
- Nell'esecuzione dei tool in `ai-assistant`, aggiungere auto-save L1 per: `send_email`, `create_download_job`, `deep_search_partner`, `deep_search_contact`, `bulk_update_partners`, `create_reminder`
- Se lo stesso pattern viene auto-salvato 3+ volte → promozione automatica a L2 (senza feedback)
- Aggiungere logica di **deduplicazione**: prima di salvare, verificare se esiste già una memoria simile (stesso tag + contenuto parziale)

**File**:
| File | Modifica |
|------|----------|
| `supabase/functions/ai-assistant/index.ts` | Auto-save dopo ogni tool call significativo + dedup check |

---

## 4. Campo "Current Focus" nel Profilo (suggerimento bonus)

**Aggiunta**: Campo `ai_current_focus` in `AIProfileSettings` — una stringa breve tipo "Questo mese il focus è l'acquisizione partner in Germania" che viene iniettata nel system prompt di tutti gli agenti.

**File**:
| File | Modifica |
|------|----------|
| `src/components/settings/AIProfileSettings.tsx` | Aggiungere campo "Focus Corrente" con placeholder e icona |
| `supabase/functions/ai-assistant/index.ts` | In `loadUserProfile`, includere `ai_current_focus` come prima riga del profilo |
| `supabase/functions/super-assistant/index.ts` | Idem |

---

## Riepilogo tecnico

| Intervento | Impatto | Rischio |
|-----------|---------|---------|
| Summary parallelo | -2s latenza media | Basso — fallback sicuro |
| Decay esponenziale | Memorie vivono ~3x più a lungo | Basso — più conservativo |
| Auto-save potenziato | +80% memorie utili senza feedback | Medio — serve dedup |
| Current Focus | Risposte AI più proattive | Zero |

Nessuna migrazione DB necessaria — le colonne esistono già. Solo modifiche a codice edge functions + 1 campo UI.

