

## Piano: Separare Goal e Proposte + 10 default per ciascuno

### Problema attuale
Goal e Proposte sono combinati nello stesso preset (`workspace_presets.goal` e `workspace_presets.base_proposal`). L'utente vuole due sezioni indipendenti nel ContentManager, ciascuna con i propri elementi, e 10 contenuti predefiniti per il settore freight forwarding/logistics.

### Approccio
Usare la tabella `app_settings` per salvare goal e proposte come voci separate (key: `default_goals`, `default_proposals` con value JSON array). Nessuna nuova tabella necessaria. I default vengono inseriti in-code e salvati al primo utilizzo.

### Modifiche

#### 1. `src/components/settings/ContentManager.tsx` — Riscrivere la sezione "Goal e Proposte"

Sostituire l'unica sezione "Goal e Proposte" con due accordion separati:

**A) Sezione "Goal"** (icona Target)
- Lista di goal editabili inline (nome + descrizione)
- Bottone "Aggiungi Goal" personalizzato
- Bottone "Carica default" che inserisce 10 goal predefiniti se la lista è vuota
- Ogni goal ha edit/delete

**B) Sezione "Proposte"** (icona FileText)  
- Stessa struttura dei Goal ma per le proposte commerciali
- Ogni proposta ha nome + testo completo

**I 10 Goal predefiniti** (contesto: spedizioniere italiano Transport Management che cerca partner nel mondo):
1. Primo contatto commerciale — Presentarsi e verificare possibilità di collaborazione
2. Richiesta informazioni servizi — Raccogliere dettagli per inserimento nel database fornitori
3. Presentazione servizi rapida — Descrivere i propri servizi e proporre un approfondimento
4. Invito a meeting conoscitivo — Incontro per esplorare collaborazioni potenziali
5. Ricerca partner per network espresso/cargo aereo — Comunicare la costruzione del network con booking real-time
6. Richiesta tariffe e accordo commerciale — Chiedere listino e condizioni per accordo operativo
7. Follow-up dopo primo contatto — Riprendere il dialogo dopo un contatto iniziale
8. Proposta di partnership esclusiva paese — Offrire esclusiva territoriale per servizi specifici
9. Richiesta referenze e volumi — Verificare affidabilità e capacità operativa del partner
10. Cross-selling servizi aggiuntivi — Proporre servizi complementari a partner già attivi

**Le 10 Proposte predefinite:**
1. Collaborazione trasporti aerei e corriere espresso con tariffe competitive
2. Servizio door-to-door con tracking real-time e sdoganamento incluso
3. Partnership per distribuzione locale con magazzino e consegna ultimo miglio
4. Accordo per groupage marittimo FCL/LCL con consolidamento settimanale
5. Network di trasporto terrestre con flotta propria e tempi garantiti
6. Servizio di logistica integrata: stoccaggio, picking, distribuzione
7. Accordo per spedizioni dangerous goods con certificazione ADR/IATA
8. Partnership per e-commerce logistics con fulfillment e resi
9. Servizio trasporti project cargo e carichi eccezionali
10. Proposta per gestione traffico import/export con sdoganamento dedicato

#### 2. `src/data/defaultContentPresets.ts` — Nuovo file con i 10+10 default

Costanti esportate `DEFAULT_GOALS` e `DEFAULT_PROPOSALS`, ciascuna array di `{ name: string, text: string }`.

#### 3. Persistenza

Salvare goal e proposte custom in `app_settings` con chiavi `custom_goals` e `custom_proposals` (JSON array). I default sono sempre disponibili dal codice; l'utente può aggiungerne di nuovi o eliminare quelli che non servono.

### File da creare/modificare
1. **Creare** `src/data/defaultContentPresets.ts` — costanti 10 goal + 10 proposte
2. **Modificare** `src/components/settings/ContentManager.tsx` — due sezioni separate con CRUD e default precaricati

