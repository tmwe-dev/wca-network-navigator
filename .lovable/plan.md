

# Piano: Configurazione individuale di tutti gli 11 agenti

## Team attuale

| # | Nome | Ruolo | Prompt | Tools | ElevenLabs |
|---|------|-------|--------|-------|------------|
| 1 | Luca | Account | Template generico | 12 generici | ❌ |
| 2 | Marco | Strategy | Template generico | 9 generici | ❌ |
| 3 | Gianfranco | Account | Template generico | 12 generici | ❌ |
| 4 | Imane | Research | Template generico | 12 generici | ❌ |
| 5 | Gigi | Research | Template generico | 12 generici | ❌ |
| 6 | Felice | Download | Template generico | 9 generici | ❌ |
| 7 | Robin | Outreach | Template generico | 11 generici | ❌ |
| 8 | Bruce | Outreach | Template generico | 11 generici | ❌ |
| 9 | Renato | Outreach | Template generico | 11 generici | ❌ |
| 10 | Carlo | Outreach | Template generico | 11 generici | ❌ |
| 11 | Leonardo | Outreach | Template generico | 11 generici | ❌ |

## Configurazione dedicata per agente

### 1. Luca — Account Manager Senior (Clienti Premium)
- **Focus**: Gestione top-tier clienti convertiti, upselling, retention
- **Prompt**: Specializzato su relazioni VIP, check-in periodici, analisi satisfaction
- **Tools**: 14 (aggiunge `update_lead_status`, `get_global_summary`)
- **ElevenLabs**: `agent_3801k1xqxat6et78e3z2a36h579c`

### 2. Marco — Chief Strategy Officer
- **Focus**: Analisi macro, copertura mondiale, allocazione risorse, briefing team
- **Prompt**: KPI-driven, genera report settimanali, identifica gap geografici, propone priorità
- **Tools**: 11 (aggiunge `search_contacts`, `search_prospects`)
- **ElevenLabs**: `agent_3801k1xqxat6et78e3z2a36h579c`

### 3. Gianfranco — Account Manager (Re-engagement)
- **Focus**: Recupero clienti persi/inattivi, promozioni rientro, analisi churn
- **Prompt**: Specializzato su ex-clienti e clienti dormienti, strategie win-back
- **Tools**: 14 (aggiunge `check_blacklist`, `update_lead_status`)
- **ElevenLabs**: `agent_3801k1xqxat6et78e3z2a36h579c`

### 4. Imane — Research Analyst (Market Intelligence)
- **Focus**: Analisi mercato, identificazione target per settore/paese, ranking aziende
- **Prompt**: Data-driven, crea report di opportunità, valuta quality score partner
- **Tools**: 14 (aggiunge `create_reminder`, `get_global_summary`)
- **ElevenLabs**: `agent_3801k1xqxat6et78e3z2a36h579c`

### 5. Gigi — Research Operative (Enrichment)
- **Focus**: Arricchimento profili, deep search massivo, pulizia dati, alias generation
- **Prompt**: Operativo puro, esegue batch di enrichment, verifica completezza
- **Tools**: 14 (aggiunge `update_partner`, `manage_partner_contact`)
- **ElevenLabs**: `agent_3801k1xqxat6et78e3z2a36h579c`

### 6. Felice — Download Controller
- **Focus**: Gestione download WCA, monitoraggio job, retry, verifica completezza
- **Prompt**: Prudente su rate-limit, prioritizza paesi strategici, gestisce code
- **Tools**: 11 (aggiunge `create_activity`, `save_memory`)
- **ElevenLabs**: `agent_3801k1xqxat6et78e3z2a36h579c`

### 7. Robin — Sales Hunter (Primo contatto)
- **Ruolo cambiato**: outreach → **sales**
- **Focus**: Primo contatto freddo, qualificazione lead, apertura conversazione
- **Prompt**: Chris Voss hook + calibrated questions, specializzato in cold outreach
- **Tools**: 18 (template sales completo)
- **ElevenLabs**: `agent_3801k1xqxat6et78e3z2a36h579c`

### 8. Bruce — Sales Closer (Chiusura contratti)
- **Ruolo cambiato**: outreach → **sales**
- **Focus**: Negoziazione finale, gestione obiezioni, chiusura deal
- **Prompt**: Tecniche di chiusura avanzate, urgenza controllata, proposta contrattuale
- **Tools**: 18 (template sales + focus su update_lead_status)
- **ElevenLabs**: `agent_3801k1xqxat6et78e3z2a36h579c`

### 9. Renato — Outreach Europa
- **Focus**: Outreach specializzato per mercato europeo (IT, DE, FR, ES, UK, NL)
- **Prompt**: Multilingue europeo, conosce specificità culturali, regolamenti UE
- **Tools**: 13 (aggiunge `list_activities`, `update_activity`)
- **ElevenLabs**: `agent_3801k1xqxat6et78e3z2a36h579c`

### 10. Carlo — Outreach Asia/Middle East
- **Focus**: Outreach per mercati asiatici e mediorientali
- **Prompt**: Adattato a culture business asiatiche, formalità, relazioni lunghe
- **Tools**: 13 (come Renato)
- **ElevenLabs**: `agent_3801k1xqxat6et78e3z2a36h579c`

### 11. Leonardo — Outreach Americas/Africa
- **Focus**: Outreach per Americhe e Africa
- **Prompt**: English-first, adattato a mercati emergenti e consolidati
- **Tools**: 13 (come Renato)
- **ElevenLabs**: `agent_3801k1xqxat6et78e3z2a36h579c`

## Implementazione

### Cosa viene fatto
- **11 UPDATE** sulla tabella `agents` via insert tool — uno per agente, ciascuno con:
  - `system_prompt` dedicato e personalizzato (non il template generico)
  - `assigned_tools` ottimizzato per la specializzazione
  - `elevenlabs_agent_id` = `agent_3801k1xqxat6et78e3z2a36h579c`
  - `avatar_emoji` aggiornato dove il ruolo cambia
  - `role` aggiornato per Robin e Bruce (→ sales)

### File da modificare
Nessun file di codice viene toccato. Solo dati nel database.

### Risultato
Ogni agente avrà un'identità unica con prompt specializzato, tool calibrati per il suo ruolo specifico e voce ElevenLabs collegata. Robin e Bruce diventano i 2 agenti vendita dedicati richiesti.

