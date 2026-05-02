## Cosa farò (3 azioni mirate, una per problema)

---

### 1) Pipeline filtri Giornalista/Revisore — consolidare e memorizzare come INTOCCABILE

**Verifica oggettiva fatta sul codice:**

Esiste UN layer editoriale unico (`_shared/journalistReviewLayer.ts`) ed è già attivo su TUTTI i punti di produzione/invio messaggi:

| Canale | Edge function | Journalist attivo |
|---|---|---|
| Email — generazione | `generate-email` | ✓ (line 270) |
| Email — miglioramento | `improve-email` | ✓ (line 445) |
| Email — coda outreach | `process-email-queue` | ✓ (line 225) |
| Email — invio diretto | `send-email` | ✓ (line 346, doppio guard se `journalist_reviewed` mancante) |
| WhatsApp — invio | `send-whatsapp` | ✓ (line 167) |
| LinkedIn — invio | `send-linkedin` | ✓ (line 210) |
| Mario · `send_email` (agent-execute) | `emailTools.ts` | ✓ (line 73) |
| Mario · `send_whatsapp` (agent-execute) | `emailTools.ts` | ✓ (line 165) |
| Mario · `compose-email` (Command) | usa `generate-email` → ✓ |
| Mario · `send-linkedin` (Command) | usa edge `send-linkedin` → ✓ |
| Mario · `send-whatsapp` (Command) | usa edge `send-whatsapp` → ✓ |

**Smentita audit precedente:** avevo segnalato che `composeEmail` bypassava il revisore. Rileggendo il file, `composeEmail.ts` chiama `generate-email` (non più `unified-assistant`), quindi il giornalista È applicato. Pipeline già completa su tutti e 3 i canali.

**Cosa farò:**
1. Salvare in memoria persistente una nuova entry `mem://tech/editorial-review-layer-mandatory` che dichiara: layer `journalistReview` obbligatorio su ogni produzione/invio email/WA/LI; matrice canali sopra; vietato bypassarlo; ogni nuovo tool che produce o invia messaggi DEVE invocarlo o passare per un'edge che lo invoca.
2. Aggiungere riga in `mem://index.md` Core: "Editorial review (journalistReview) obbligatorio su ogni email/WA/LI prodotti o inviati. Mai bypassarlo."
3. Aggiungere commento `// 🔒 EDITORIAL LAYER — INTOCCABILE` in testa a `_shared/journalistReviewLayer.ts` per segnalarne lo stato di file critico.

Nessuna modifica funzionale al codice della pipeline (è già corretta).

---

### 2) Duplicati `operative_prompts` nel DB — pulizia oggettiva

**Verifica oggettiva fatta:** 6 gruppi distinti (context+tags), ognuno replicato esattamente 5 volte → 30 record, di cui 24 da rimuovere. Tutti hanno `updated_at` identico per gruppo (stessa migrazione li ha duplicati).

| Context | Tags | Copie | Da tenere | Da eliminare |
|---|---|---|---|---|
| classification | classification, lead-status, email-quality, universale | 5 | 1 | 4 |
| command | OBBLIGATORIA, briefing | 5 | 1 | 4 |
| command | OBBLIGATORIA, identita | 5 | 1 | 4 |
| command | OBBLIGATORIA, memoria | 5 | 1 | 4 |
| command | OBBLIGATORIA, proattivita | 5 | 1 | 4 |
| command | OBBLIGATORIA, scheduling | 5 | 1 | 4 |
| command | OBBLIGATORIA, voce | 5 | 1 | 4 |
| command | tool-routing, router, OBBLIGATORIA | 5 | 1 | 4 |
| command | tool-routing, whatsapp, linkedin, OBBLIGATORIA | 5 | 1 | 4 |
| general | aliases, copywriting, universale | 5 | 1 | 4 |
| outreach | outreach, email-quality, universale, OBBLIGATORIA | 5 | 1 | 4 |
| outreach | outreach, multi-canale, holding-pattern, … | 5 | 1 | 4 |

(in totale 12 gruppi × 5 = 60 record, di cui 48 da rimuovere — la query iniziale era troncata, controllerò esattamente prima di eseguire)

**Prima di eliminare farò una verifica oggettiva del CONTENUTO:**
- Per ogni gruppo, leggerò il `body` di tutte le copie e verificherò che siano identiche o quasi-identiche.
- Se sono identiche → elimino tenendo l'`id` più vecchio (per non perdere riferimenti).
- Se NON sono identiche (anche se context+tags coincidono) → ti mostro le differenze e NON elimino nulla finché non decidi tu.

Esecuzione tramite tool `supabase--insert` (DELETE su tabella business → trigger globale converte automaticamente in soft-delete `deleted_at`, come da policy `mem://constraints/no-physical-delete`).

---

### 3) Export KB/Prompt — confermare il link

**Verifica fatta:** `AIExportPanel` è già esposto. Percorso: **Settings → tab "Backup & Export"** in `/v2/settings` (montato in `src/v2/ui/pages/SettingsPage.tsx` riga 206 via `BackupExportTab`).

Il pannello esporta uno ZIP leggibile (Markdown) con:
- Tutti i prompt operativi
- Tutte le KB entries
- Agenti, capabilities, personas
- Memoria

**Cosa farò:** ti darò qui sotto il link diretto cliccabile alla pagina (`/v2/settings` → tab Backup & Export). Nessuna modifica codice.

---

## Cosa NON farò ora (rimandato come da tua richiesta)

- Audit oggettivo riga-per-riga del CONTENUTO dei prompt e della KB rispetto ai ruoli degli agenti. Ne parliamo dopo, quando questi 3 punti sono chiusi.

---

## Ordine di esecuzione

1. Salvo memoria "editorial layer intoccabile" + commento file.
2. Leggo i body dei duplicati, confronto, ti mostro un riepilogo, poi elimino solo gli identici.
3. Ti do il link `/v2/settings` (tab Backup & Export).

Se confermi, procedo.