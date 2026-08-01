---
name: Funnemail Prompt Doctrine — regolefunnymail.docx
description: Doctrine ufficiale per i prompt operativi email/WA/LinkedIn/funnemail. Batteria di prompt specializzati (no monolite), con name/context/tags/priority/objective/procedure/criteria/examples. Tag OBBLIGATORIA vince. Stile "scrittore commerciale da bestseller": umano, asciutto, una sola CTA, niente AI smell.
type: feature
---
Fonte: regolefunnymail.docx (utente, 2026-05-10).

Architettura: NON un prompt gigante. Batteria di prompt operativi in `operative_prompts`, ognuno con: name, context, tags (incluso OBBLIGATORIA dove serve), priority, objective, procedure, criteria, examples. Loader esistente (`_shared/operativePromptsLoader.ts`) li inietta per scope/tag; OBBLIGATORIA vince.

Contesti supportati (mappare scope): email, email-quality, outreach, whatsapp, linkedin, multi-channel, lead-status, post-send, classification, agent-loop, command, funnemail_classifier, content-intelligence, conversation-summary, general.

Prompt da inserire (con priorità):
1. Scrittore commerciale da bestseller — email-quality, OBBLIGATORIA, p100 (universale qualità)
2. LinkedIn DM — relazione prima della vendita — linkedin, OBBLIGATORIA, p98 (3-5 frasi, no pitch, CTA leggera)
3. WhatsApp — messaggio operativo breve — whatsapp, OBBLIGATORIA + gate-hard, p98 (2-4 righe, solo se canale appropriato)
4. Email outbound — precisione, fiducia, risposta — email, p95 (subject 6-8 parole, corpo 120-180 parole primo contatto)
5. Funnemail classifier — funnemail_classifier, OBBLIGATORIA, p100 (intento, urgenza, canale, prossimo passo)
6. Content Intelligence — content-intelligence, p? (psicologia + opportunità inbound)
7. Customer story intelligence — outreach, OBBLIGATORIA, p97
8. Quality gate / Verificatore — email-quality, p? (verdict pass | pass_with_edits | block)
9. Lead status playbook — lead-status (NEW/QUALIFIED/etc tono e azioni consentite)
10. Post-send doctrine — post-send (no doppio invio, stati: draft_ready/pending_approval/ready_for_browser, no "inviato" se non confermato)
11. Risposta a email inbound stile alto livello — email
12. No AI smell — output-format/copywriting, p80
13. Anima del messaggio — general/universale, OBBLIGATORIA, p100
14. Channel router — multi-channel, OBBLIGATORIA, p96
15. Outreach strategy/psychology — outreach, OBBLIGATORIA, p97

Regole stile (universali, da applicare in journalistReview e generatori):
- Sembrare scritto da persona reale, una sola CTA, frasi brevi, ritmo pulito.
- VIETATO: "I hope this email finds you well", superlativi vuoti (best/amazing/unbeatable), pitch lunghi LinkedIn, WhatsApp freddo non autorizzato, follow-up ravvicinati, promesse non verificabili.
- Subject email: corto, specifico, non promozionale, max 6-8 parole.
- Email primo contatto: 120-180 parole, un solo obiettivo, una sola domanda finale facile.
- LinkedIn: max 3-5 frasi, leggibile in <15s, niente "book a meeting" al primo contatto.
- WhatsApp: gate hard su lead_status + interazione pregressa; 2-4 righe.

Verdict del Quality Gate: `pass` | `pass_with_edits` (restituisce versione migliorata) | `block` con motivo.

Channel router output: propose | create pending action | send | block. Stati post-send consentiti: draft_ready, pending_approval, ready_for_browser (mai "inviato" senza conferma).

Filosofia: "La creatività deve riempire la forma, non inventare la sostanza." Niente dati inventati.
