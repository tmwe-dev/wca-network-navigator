UPDATE public.kb_entries
SET 
  content = $$INDICE SEMANTICO DELLO SCHEMA DATI

Questo è l'indice che ti dice DOVE vivono le informazioni nel database. Per i campi esatti (colonne, tipi, enum) chiama sempre l'RPC `ai_introspect_schema(table_name)` o consulta lo SCHEMA REALE iniettato nel prompt — non fidarti di nomi colonna che ricordi.

═══════════════════════════════════════════════════
IL MONDO
═══════════════════════════════════════════════════

La piattaforma gestisce migliaia di aziende di spedizioni internazionali ("partner") membri di network professionali sotto l'ombrello WCA: WCA base, WCA Dangerous Goods, WCA Perishables, WCA Projects, WCA eCommerce, WCA Pharma, WCA Time Critical, WCA Relocations, Elite Global Logistics, Lognet Global, GAA Global Affinity, IFC Infinite Connection e altri. Ogni partner ha un wca_id numerico univoco e un country_code ISO-2.

═══════════════════════════════════════════════════
DOVE TROVI COSA — mappa concettuale
═══════════════════════════════════════════════════

▸ PARTNER (aziende WCA)
  • `partners` — tabella principale. Contiene anagrafica + indirizzo principale + contatti aziendali piatti:
      anagrafica: company_name, wca_id, country_code, network, lead_status, scoring
      indirizzo principale: address, city, country_code
      contatti aziendali: email, email_status, phone, emergency_phone
    Per "dov'è il partner X" / "email del partner X" / "telefono del partner X" → cerca QUI.
  • `partner_contacts` — contatti PERSONA aggiuntivi del partner (referenti, decision maker con nome/ruolo/email/telefono individuali). Usala quando cerchi una persona specifica, non l'email aziendale generica.

▸ PROSPECT (aziende non-WCA / lead esterni)
  • `prospects` — anagrafica prospect (aziende fuori network).
  • `prospect_contacts` — contatti persona dei prospect.

▸ BIGLIETTI DA VISITA
  • `business_cards` — biglietti digitalizzati via OCR. Contiene tipicamente: full_name, company_name, email, phone, address, city, country, ocr_confidence, partner_id (se collegato a un partner WCA esistente). Cerca qui per "biglietti di [città/paese/azienda]".

▸ CONTATTI CRM IMPORTATI
  • `imported_contacts` — contatti importati da CSV/Excel/altre fonti (clienti, lead, prospect generici non legati a partner WCA).

▸ COMUNICAZIONI (multicanale)
  • `channel_messages` — TUTTI i messaggi inbound + outbound unificati (email, WhatsApp, LinkedIn). Sorgente di verità per "ultime comunicazioni".
  • `outreach_queue` — coda messaggi outbound pianificati/in invio.

▸ ATTIVITÀ CRM
  • `activities` — chiamate, follow-up, meeting, reminder, task umani.

▸ AI / AGENTI
  • `agents` — agenti AI configurati.
  • `agent_tasks` — task assegnati agli agenti.
  • `kb_entries` — Knowledge Base (dottrina, manuali, indici come questo).

▸ JOB / SINCRONIZZAZIONI
  • `download_jobs` — sincronizzazioni massive da fonti esterne (WCA scraping, ecc.).
  • `campaign_jobs` — job di campagne outbound assegnati a operatori.

═══════════════════════════════════════════════════
REGOLE D'ORO PER TROVARE I DATI
═══════════════════════════════════════════════════

1. INDIRIZZO/EMAIL/TELEFONO AZIENDALE di un partner → campi diretti su `partners` (address, city, email, phone). NON serve join.
2. CONTATTO PERSONA SPECIFICA di un partner (nome, ruolo) → `partner_contacts`.
3. BIGLIETTI DA VISITA → `business_cards` (campi piatti, dati OCR).
4. PROSPECT vs PARTNER: prospect = NON ancora in WCA; partner = membro WCA. Tabelle separate.
5. COMUNICAZIONI cross-canale → `channel_messages` (unificato).
6. Per i CAMPI ESATTI di una tabella (colonne, tipi, valori enum permessi) consulta SEMPRE lo schema reale iniettato nel prompt o chiama `ai_introspect_schema(<table>)`. Mai inventare nomi colonna.
7. Per ricerche testuali (azienda, città, persona) usa `ilike` con wildcard. Per paesi usa `country_code` ISO-2.
8. Zero risultati è un risultato VALIDO, non un errore.$$,
  updated_at = now()
WHERE id = '7c4615c8-ddea-406a-a80e-191fee9e48d6';