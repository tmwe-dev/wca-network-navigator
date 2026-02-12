

# Refactoring e Pagina Documentazione

## Obiettivo
Pulire il progetto rimuovendo codice morto, eliminando duplicazioni e aggiungendo una pagina "Guida" che spiega il funzionamento di ogni sezione. La pagina Campaigns NON viene toccata.

---

## Fase 1 — Rimozione pagine orfane

Queste pagine esistono nel codice ma non sono raggiungibili da nessun menu o link. Contengono funzionalita' gia' presenti altrove:

| File | Motivo rimozione |
|------|-----------------|
| `src/pages/Dashboard.tsx` | Non collegato a nessuna rotta, non usato |
| `src/pages/Agents.tsx` (627 righe) | Vecchia versione di PartnerHub, non in uso |
| `src/pages/Export.tsx` | Duplicato della tab Import/Export in Impostazioni |
| `src/pages/Partners.tsx` | Versione semplificata di PartnerHub, non in uso |
| `src/pages/WCA.tsx` | Duplicato della tab WCA in Impostazioni |
| `src/pages/PartnerDetail.tsx` | Non collegato a nessuna rotta |

Verranno anche rimossi i componenti associati che diventano orfani (es. `src/components/dashboard/`, `src/components/agents/`), solo se non sono usati da nessun'altra pagina attiva.

## Fase 2 — Pulizia rotte e layout

- Rimuovere la rotta duplicata `/partners` (gia' identica a `/`)
- Aggiungere rotta `/guida` per la nuova pagina documentazione
- Aggiungere voce "Guida" nella sidebar (icona libro)
- Pulire `AppLayout.tsx` rimuovendo riferimenti a pagine eliminate dal mapping `PAGE_INFO`

## Fase 3 — Nuova pagina "Guida Progetto"

Una pagina statica, chiara e sintetica che spiega:

- **Partner Hub**: Consultazione, ricerca e filtro dei partner WCA. Dettaglio con contatti, servizi, network e rating.
- **Acquisizione Partner**: Pipeline automatizzata che scarica i profili WCA tramite l'estensione Chrome, estrae contatti privati e salva tutto nel database. Include retry automatici e protezione anti-throttling notturno.
- **Download Management**: Selezione paesi, scansione della directory WCA, creazione di job di download in background con monitoraggio live.
- **Campaigns**: Invio email ai partner selezionati tramite globo 3D interattivo.
- **Agenda**: Calendario reminder e follow-up con i partner.
- **Impostazioni**: Configurazione WhatsApp, connessione WCA (estensione Chrome), import/export CSV/JSON, gestione blacklist.

La pagina usa un layout a card semplice, senza logica complessa.

## Fase 4 — Verifica hooks orfani

Controllo che gli hooks rimangano tutti utilizzati. Se qualcuno diventa orfano dopo la rimozione delle pagine, verra' eliminato:
- `useActivities.ts` → usato solo da Agents
- `useTeamMembers.ts` → usato solo da Agents

---

## Cosa NON viene toccato

- `src/pages/Campaigns.tsx` e tutti i componenti in `src/components/campaigns/`
- `src/components/globe/`
- `src/standalone-globe/`
- `src/backup/`
- Tutti gli hooks attivamente utilizzati dalle pagine rimanenti
- Le edge functions
- Il database

## Rischio

Basso. Si tratta di rimozione di file non collegati e aggiunta di una pagina statica. Nessuna modifica alla logica di business esistente.

