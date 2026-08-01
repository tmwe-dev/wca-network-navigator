---
name: RadioChat Extract 2026-05-11
description: Inventario tecnico repo tmwe-dev/radiochat (TS/Vite/Supabase) + tabella confronto pattern riusabili in TMWE. Fonti per multi-agent debate, convergence engine, memory hierarchy, prompt sections, TTS knowledge base.
type: reference
---

# Inventario RadioChat (clone https://github.com/tmwe-dev/radiochat.git)

Repo è **TypeScript** (l'audit Claude Opus diceva JS vanilla — superato). Stack: React 18 + Vite + Supabase + Vercel + 4 provider AI + ElevenLabs.

## File chiave per prompt engineering
| File | LOC | Cosa contiene |
|---|---|---|
| `src/lib/agents.ts` | 82 | 4 agenti: Albert (OpenAI), Archimede (Anthropic), Pitagora (Gemini), Newton (Groq) — id, color, voice, model |
| `src/lib/prompts.ts` | 258 | `AGENT_PERSONALITIES` (role/style/strengths/approach/debateRule per agente), `DEBATE_FRAMEWORK` localizzato in 6 lingue, `buildRichSystemPrompt` a 11 sezioni |
| `src/lib/orchestrator.ts` | 325 | Engine sequenziale: forced rounds → consultation/standard, **skip logic per consenso** in 18 lingue, integration con memory + convergence |
| `src/lib/convergence.ts` | 178 | `analyzeConvergence`: stagnation/agreement/divergence/neutral via keywords multilingua + similarity con stop-words |
| `src/lib/memory.ts` | 446 | **Memory hierarchy a 3 livelli** (Full / Condensed / Summary) + auto-summary trigger ogni 20 msg + token tracking |
| `src/lib/promptSections.ts` | 129 | Sezioni dinamiche RULES/TOPIC/CONTEXT con priority + tag matching sull'input utente |
| `src/lib/taskTemplates.ts` | 171 | 9 task type (report, analysis, plan, lesson, creative, code, brainstorm, review, custom) ognuno con **phase engine** (setup → analysis → debate → synthesis → deliverable) |
| `src/lib/ttsPreprocessor.ts` | 285 | Strip markdown/emoji + `buildTTSKnowledgeBase` (regole iniettate nel prompt per scrittura voice-friendly language-agnostic) |
| `src/lib/convergence.ts` keywords | — | 18 lingue agreement/divergence — supera le 6 di TMWE |
| `api/ai-proxy.js` | 515 | Proxy unificato 4 provider con vault-based key decryption (AES-256-GCM), JWT verify, rate limit, CORS whitelist, body size limit |

## Tabella confronto con TMWE
| Pattern RadioChat | Già in TMWE? | Riusabile? | Dove integrare |
|---|---|---|---|
| 4 personas con role/style/strengths/approach/debateRule | Schema sì (`agent_personas`), contenuto **NO** (8 vuote) | ✅ ALTO | Seed `agent_personas` con i 4 profili (Architect/Director/Refiner/Harmonizer) |
| DEBATE_FRAMEWORK 6 lingue (intro/rules/consultation/buildOn/disagree/conclude) | NO | ✅ ALTO | `_shared/prompts/debateFramework.ts` per Command multi-agente |
| Skip logic consenso 18 lingue | NO | ✅ MEDIO | `agent-loop` per evitare turni ridondanti |
| Convergence engine (stagnation/agreement/divergence) | NO | ✅ ALTO | Command Page orchestrator + outreach A/B converging |
| Memory hierarchy 3 livelli (Full/Condensed/Summary) | Sì L1-L3 (cognitive memory) | Confronto/migliorie | Verificare auto-summary trigger ogni 20 msg |
| Prompt sections RULES/TOPIC/CONTEXT con tag matching | Parziale (`operative_prompts` con scope) | ✅ MEDIO | Aggiungere campo `topic_tags` a `operative_prompts` |
| Phase engine (setup→analysis→debate→synthesis→deliverable) | Parziale (Sherlock 3 livelli, campaigns) | ✅ ALTO | Generalizzare in `task_phases` per Command + Outreach |
| 9 task templates con phaseInstructions | NO | ✅ MEDIO | `task_templates` table per Command Page |
| TTS knowledge base iniettata nel prompt (language-agnostic) | NO (no voice nativo) | Bassa priorità | Solo se attivata Aurora/Bruce |
| Vault AES-256-GCM per API keys | NO (Lovable AI Gateway) | NO | TMWE usa BYOK via gateway |
| 18-language agreement/divergence keywords | TMWE supporta 6 | ✅ MEDIO | Estendere `convergence.ts` se creato |

## Cosa NON portare
- localStorage come storage (TMWE ha Supabase + RLS)
- Chiavi API nel client (TMWE usa AI Gateway)
- 4 provider separati (TMWE usa Lovable AI Gateway unificato)
- Sistema crediti Stripe (TMWE già rimosso, uso interno)

## File usati come fonte
- `/tmp/radiochat/src/lib/{agents,prompts,orchestrator,convergence,memory,promptSections,taskTemplates,ttsPreprocessor}.ts`
- `/tmp/radiochat/api/ai-proxy.js`