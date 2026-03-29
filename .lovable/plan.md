

# Ristrutturazione Architettura: CRM + Outreach + Email

## Problema attuale

- **CRM** ha 4 tab (Contatti, Prospect, Import, Biglietti) ma "Prospect" ora e' ridondante perche' RA ha la sua sezione dedicata
- **Outreach** mischia 3 cose diverse: Cockpit (lavoro singolo), Workspace (email bulk), Email Composer (editor) — l'Email Composer non c'entra con le operazioni automatizzate
- Le attivita' e le campagne non hanno visibilita' diretta nell'area Outreach
- Il CRM esclude i contatti WCA, che invece dovrebbero essere visibili come origine

## Proposta di ristrutturazione

### CRM — Hub di tutti i contatti per origine

```text
CRM (4 tab)
├── Contatti ........... TUTTI i contatti unificati (WCA + Import + RA + Biglietti)
│                       con filtro "Origine" come nel Cockpit (toggle colorati)
├── Import ............. Import file (rimane com'e')
├── Biglietti .......... Business Cards (rimane com'e')
└── Report Aziende ..... Link/redirect al modulo RA (o tab embedded leggero)
```

- **Rimuovere il tab "Prospect"** — i prospect RA sono gestiti dal modulo dedicato
- **Tab "Contatti"** diventa la vista unificata di tutte le origini con gli stessi toggle del Cockpit (WCA blu, Import verde, RA arancio, Biglietti viola)
- Quando un prospect RA o un biglietto vengono "convertiti", entrano nel flusso contatti

### Outreach — Centro operativo di lavoro

```text
Outreach (4 tab)
├── Cockpit ............ Lavoro pulito: email singole, interazione 1-a-1
├── Workspace .......... Email bulk, scheduling, invii massivi
├── Campagne ........... Elenco campagne attive/completate (campaign_jobs + email_campaign_queue)
└── Attivita' .......... Elenco attivita' assegnate (activities) con stati e filtri
```

- **Email Composer rimosso** da Outreach
- **Aggiunti 2 tab**: Campagne e Attivita' per dare visibilita' diretta

### Email Composer — Sezione dedicata

```text
Sidebar
├── Dashboard
├── Network
├── CRM
├── Outreach
├── Email Composer ..... Nuovo link diretto nella sidebar (icona Mail)
├── Agenda
├── Agenti
├── ...
```

L'Email Composer diventa un ambiente autonomo raggiungibile dalla sidebar, separato dalle operazioni automatizzate di Outreach.

## Flusso dati rivisto

```text
ORIGINI                          LAVORO                    USCITA
─────────                        ──────                    ──────
WCA (Network) ──────┐
Import (file) ──────┤
RA (Report Az.) ────┤──→ CRM ──→ Cockpit (1-a-1)    ──→ Email singola
Biglietti da visita ┘            Workspace (bulk)     ──→ Coda invio
                                 Email Composer       ──→ Draft/Template
                                 Campagne             ──→ Monitoring
                                 Attivita'            ──→ Task tracking
```

## Modifiche tecniche

1. **`src/pages/CRM.tsx`**: rimuovere tab Prospect, aggiungere tab RA (redirect o embed leggero), rendere tab Contatti una vista unificata multi-origine
2. **`src/pages/Outreach.tsx`**: rimuovere Email Composer, aggiungere tab Campagne e Attivita'
3. **`src/components/layout/AppSidebar.tsx`**: aggiungere voce "Email Composer" come route autonoma `/email-composer`
4. **`src/App.tsx`**: rimuovere redirect di `/email-composer` verso `/outreach`, renderlo route diretta
5. **Nuovo componente tab Campagne**: lista da `campaign_jobs` + `email_campaign_queue` con stati e contatori
6. **Nuovo componente tab Attivita'**: riuso di `useAllActivities` con vista filtrata per stato/tipo

