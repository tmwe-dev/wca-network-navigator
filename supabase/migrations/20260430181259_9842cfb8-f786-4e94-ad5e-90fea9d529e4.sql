UPDATE public.kb_entries
SET
  content = $$INDICE SEMANTICO DELLO SCHEMA DATI

Questo è l'indice che ti dice DOVE vivono le informazioni nel database. Per i campi esatti (colonne, tipi, enum) chiama sempre l'RPC `ai_introspect_schema(table_name)` o consulta lo SCHEMA REALE iniettato nel prompt — non fidarti di nomi colonna che ricordi.

═══════════════════════════════════════════════════
IL MONDO
═══════════════════════════════════════════════════

La piattaforma gestisce migliaia di aziende di spedizioni internazionali ("partner") membri di network professionali sotto l'ombrello WCA: WCA base, WCA Dangerous Goods, WCA Perishables, WCA Projects, WCA eCommerce, WCA Pharma, WCA Time Critical, WCA Relocations, Elite Global Logistics, Lognet Global, GAA Global Affinity, IFC Infinite Connection e altri. Ogni partner ha un wca_id numerico univoco e un country_code ISO-2.

Quando l'utente parla di "gruppo", "network", "specializzazione WCA", "appartiene a Time Critical/Pharma/Projects/Relocations/Dangerous Goods/Perishables", intende quasi sempre l'appartenenza del partner a uno o più network WCA. Questa informazione NON è il profilo descrittivo del partner: vive nella tabella `partner_networks`, collegata a `partners` tramite `partner_networks.partner_id = partners.id`.

═══════════════════════════════════════════════════
DOVE TROVI COSA — mappa concettuale
═══════════════════════════════════════════════════

▸ PARTNER (aziende WCA)
  • `partners` — tabella principale. Contiene anagrafica + indirizzo principale + contatti aziendali piatti:
      anagrafica: company_name, wca_id, country_code, lead_status, rating/scoring
      indirizzo principale: address, city, country_code
      contatti aziendali: email, email_status, phone, emergency_phone
    Per "dov'è il partner X" / "email del partner X" / "telefono del partner X" → cerca QUI.
  • `partner_networks` — appartenenze dei partner ai network/gruppi WCA. Campi chiave: partner_id, network_id, network_name, expires.
    Per "partner nel gruppo Time Critical", "quanti partner WCA Pharma", "membri di WCA Projects", "Double C dentro Time Critical" → cerca QUI, filtrando `network_name` con `ilike` (es. Time Critical) e poi, se serve il dettaglio anagrafico, collega/usa `partner_id` verso `partners`.
    Network/gruppi tipici: WCA Time Critical, WCA Pharma, WCA Projects, WCA Relocations, WCA Dangerous Goods, WCA Perishables, WCA eCommerce, WCA First, WCA Inter Global, Lognet Global, Elite Global Logistics, GAA Global Affinity, IFC Infinite Connection.
  • `network_configs` — configurazione e disponibilità dei network (metadati su network, non lista dei partner membri). Usala per sapere quali network sono noti/configurati, non per contare i partner.
  • `partner_contacts` — contatti PERSONA aggiuntivi del partner (referenti, decision maker con nome/ruolo/email/telefono individuali). Usala quando cerchi una persona specifica, non l'email aziendale generica.
  • `partner_services` — servizi/categorie operative strutturate quando disponibili.

▸ PROSPECT (aziende non-WCA / lead esterni)
  • `prospects` — anagrafica prospect (aziende fuori network).
  • `prospect_contacts` — contatti persona dei prospect.

▸ BIGLIETTI DA VISITA
  • `business_cards` — biglietti digitalizzati via OCR. Contiene tipicamente: full_name/contact_name, company_name, email, phone, address/location, city/country nei dati grezzi, ocr_confidence, matched_partner_id (se collegato a un partner WCA esistente). Cerca qui per "biglietti di [città/paese/azienda]".

▸ CONTATTI CRM IMPORTATI
  • `imported_contacts` — contatti importati da CSV/Excel/altre fonti (clienti, lead, prospect generici non legati a partner WCA).

▸ COMUNICAZIONI (multicanale)
  • `channel_messages` — TUTTI i messaggi inbound + outbound unificati (email, WhatsApp, LinkedIn). Sorgente di verità per "ultime comunicazioni" e per riferimenti testuali nelle conversazioni.
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

1. NETWORK/GRUPPO/SPECIALIZZAZIONE WCA di un partner → `partner_networks.network_name`. Non cercare prima in KB e non cercare solo nel testo descrittivo di `partners`.
2. CONTEGGIO partner in un network → query su `partner_networks` filtrando `network_name`; conta i partner_id distinti quando possibile.
3. DETTAGLIO anagrafico dei partner in un network → parti da `partner_networks`, poi usa `partner_id` per recuperare righe in `partners`.
4. INDIRIZZO/EMAIL/TELEFONO AZIENDALE di un partner → campi diretti su `partners` (address, city, email, phone). NON serve join.
5. CONTATTO PERSONA SPECIFICA di un partner (nome, ruolo) → `partner_contacts`.
6. BIGLIETTI DA VISITA → `business_cards` (campi piatti + raw_data OCR).
7. PROSPECT vs PARTNER: prospect = NON ancora in WCA; partner = membro WCA. Tabelle separate.
8. COMUNICAZIONI cross-canale → `channel_messages` (unificato).
9. Per i CAMPI ESATTI di una tabella (colonne, tipi, valori enum permessi) consulta SEMPRE lo schema reale iniettato nel prompt o chiama `ai_introspect_schema(<table>)`. Mai inventare nomi colonna.
10. Per ricerche testuali (azienda, città, persona, network_name) usa `ilike` con wildcard. Per paesi usa `country_code` ISO-2.
11. Zero risultati è un risultato VALIDO, non un errore: mostra comunque tabelle, colonne e filtri usati nell'audit.$$,
  updated_at = now()
WHERE id = '7c4615c8-ddea-406a-a80e-191fee9e48d6';