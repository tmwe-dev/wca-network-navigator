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
  • `partners` — anagrafica principale: company_name, wca_id, country_code, network, lead_status, scoring. NON contiene direttamente indirizzi multipli né lista contatti persona.
  • `partner_addresses` — TUTTI gli indirizzi (head office + branch). Cerca qui per "indirizzo/sede/città/via di un partner". Campi tipici: partner_id, address_type (head_office/branch), street, city, country_code, postal_code, phone, email.
  • `partner_contacts` — TUTTI i contatti persona del partner (nomi, email, telefoni, ruoli). Cerca qui per "email/telefono/persona di riferimento di un partner". NON cercare email persona sulla tabella partners.
  • `partner_interactions` — storico interazioni con il partner (email scambiate, call, meeting aggregati).

▸ PROSPECT (aziende non-WCA / lead)
  • `prospects` — anagrafica prospect (aziende fuori network).
  • `prospect_contacts` — contatti persona dei prospect (analogo a partner_contacts).

▸ BIGLIETTI DA VISITA
  • `business_cards` — biglietti digitalizzati via OCR. Contiene: full_name, company_name, email, phone, address, city, country, ocr_confidence, partner_id (se collegato a un partner WCA esistente). Cerca qui per "biglietti di [città/paese/azienda]".

▸ CONTATTI CRM IMPORTATI
  • `imported_contacts` — contatti importati da CSV/Excel/altre fonti (clienti, lead, prospect generici non legati a partner WCA).

▸ COMUNICAZIONI (multicanale)
  • `channel_messages` — TUTTI i messaggi inbound + outbound unificati (email, WhatsApp, LinkedIn). Sorgente di verità per "ultime comunicazioni".
  • `outreach_queue` — coda messaggi outbound pianificati/in invio.
  • Tabelle email_* — inbox dettagliata se serve granularità (bounce, classificazione, ecc.).

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

1. INDIRIZZI di un partner → `partner_addresses` (NON `partners`).
2. EMAIL/TELEFONO PERSONA di un partner → `partner_contacts` (NON `partners`).
3. BIGLIETTI DA VISITA → `business_cards` (campi piatti, dati OCR).
4. PROSPECT vs PARTNER: prospect = NON ancora in WCA; partner = membro WCA. Tabelle separate.
5. COMUNICAZIONI cross-canale → `channel_messages` (unificato).
6. Per i CAMPI ESATTI di una tabella (colonne, tipi, valori enum permessi) consulta SEMPRE lo schema reale: chiama `ai_introspect_schema(<table>)` o leggi lo SCHEMA REALE che ti viene iniettato. Mai inventare nomi colonna.
7. Per ricerche testuali (azienda, città, persona) usa `ilike` con wildcard. Per paesi usa `country_code` ISO-2 dove esiste.
8. Zero risultati è un risultato VALIDO, non un errore.$$,
  updated_at = now()
WHERE id = '7c4615c8-ddea-406a-a80e-191fee9e48d6';