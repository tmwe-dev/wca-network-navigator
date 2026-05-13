## Obiettivo

Permettere all'operatore di scegliere la lingua di ogni email (singola e bulk) tra:
- **Italiano** (default attuale)
- **Inglese** (fallback sicuro)
- **Lingua del contatto** (auto: usa lingua del paese/nome solo se rilevazione affidabile, altrimenti fallback automatico a inglese)
- **Lingua specifica** (selettore con tutte le lingue del mondo, ISO 639-1)

La traduzione/generazione viene fatta dall'AI esistente (`generate-content` → `generate-email` / `generate-outreach`) che già rispetta `payload.language` come priorità #1 (fix del 13/05).

## Architettura

### 1. Nuovo modulo lingue — `src/lib/languages.ts`
- Lista completa lingue ISO 639-1 (~180 voci) con `code`, `nameIt`, `nameNative`, `englishName`.
- Mappa `countryCode → primaryLanguage` (riuso/estensione di `getLanguageHint` lato edge, replicata client-side leggera).
- Funzione `resolveAutoLanguage({ countryCode, contactName, confidence }) → { language, source: 'detected'|'fallback_en', confidence }`. Regola Codex: se `confidence < 0.7` o paese sconosciuto → `english`.

### 2. Componente UI condiviso — `src/components/email/EmailLanguagePicker.tsx`
- Toggle a 4 opzioni: 🇮🇹 Italiano · 🇬🇧 Inglese · 🌍 Auto (lingua contatto) · ⚙️ Specifica…
- "Specifica" apre Combobox cercabile con tutte le lingue.
- Mostra badge informativo quando "Auto" → `Rilevata: francese (FR)` o `Fallback: inglese (paese sconosciuto)`.
- Persiste ultima scelta dell'operatore in `localStorage` (`email.preferredLanguage`).

### 3. Integrazione — flussi singoli
- **`useEmailComposerState`** (riga 247): rimuovere hard-coded `language: "italiano"`, leggere da nuovo state `composer.email.language` controllato dal picker.
- **`ForgeOraclePanel`** (riga 46) e **`useEmailForge`**: stesso pattern, picker accanto al goal.
- **`useOutreachGenerator`** / **`useEmailGenerator`**: già accettano `language?: string`, niente da cambiare nelle signature.
- **Composer Email V2** (`useEmailComposerV2`): aggiungere campo `language` allo state.

### 4. Integrazione — flusso bulk
- **`BulkActionMenu`** dialog "Invia email": aggiungere `EmailLanguagePicker` e checkbox "Traduci per ogni destinatario".
  - Modalità **statica** (default): tutti ricevono lo stesso testo nella lingua scelta.
  - Modalità **per destinatario** (auto/traduci): per ciascuno chiama `generate-content?action=translate` (nuovo edge function leggero) oppure usa direttamente `generate-email` con `language` risolta da `resolveAutoLanguage(contact.country, contact.name)`. Costo mostrato in anteprima.
- Nuovo edge function **`translate-text`** (`supabase/functions/translate-text/index.ts`):
  - Input: `{ text, subject, targetLanguage, sourceLanguage? }`.
  - Usa `google/gemini-3-flash-preview` via Lovable AI Gateway, prompt: "Traduci preservando tono e formattazione HTML, niente note".
  - Output: `{ subject, body, detected_source_language }`.
  - Verifica JWT + rate limit standard.
  - Usato sia da bulk sia da pulsante "Traduci ora" nel composer singolo.

### 5. Tooling Command Page
- **`composeEmail/pipeline.ts`** + `singleDraft.ts` + `batchDrafts.ts` (riga 63 `language: "it"`): rendere parametrico, default da `localStorage` o "auto".
- **`sendEmailDirectTool`**: aggiunge `language` opzionale in payload (no traduzione, l'utente fornisce già il testo).

### 6. Edge functions (server)
- Nessuna modifica a `generate-email` / `generate-outreach` (già rispettano `payload.language`).
- Estendere `_shared/getLanguageHint` con la mappa completa paese→lingua (oggi parziale).
- `journalistReviewLayer`: già supporta `language_mismatch`, riceverà la lingua corretta dal payload.

### 7. Test
- Unit: `resolveAutoLanguage` (coverage paesi ambigui → fallback en, paesi forti → lingua locale).
- Edge: `translate-text` test Deno con mock gateway.
- E2E light: `e2e/outreach-flow.spec.ts` aggiungere step "cambia lingua → genera → verifica `language_used` nel debug".

## Files to create
- `src/lib/languages.ts`
- `src/components/email/EmailLanguagePicker.tsx`
- `supabase/functions/translate-text/index.ts`
- `src/__tests__/resolve-auto-language.test.ts`

## Files to edit
- `src/hooks/email-composer/useEmailComposerState.ts` (rimuove hard-code "italiano")
- `src/hooks/email-composer/types.ts` (aggiunge `language` allo state)
- `src/v2/hooks/useEmailComposerV2.ts`
- `src/v2/hooks/useEmailForge.ts`
- `src/v2/ui/pages/email-forge/ForgeOraclePanel.tsx`
- `src/components/cockpit/BulkActionMenu.tsx` (picker + traduzione per destinatario)
- `src/v2/ui/pages/command/tools/composeEmail/{pipeline,singleDraft,batchDrafts}.ts`
- `supabase/functions/_shared/getLanguageHint.ts` (mappa estesa)

## Verifica finale
1. Composer singolo: cambio lingua → generate → `_debug.language_used` corrisponde.
2. Bulk + "Auto": 5 contatti (IT, FR, DE, JP, US-india-name) → IT/FR/DE/EN/EN (india senza certezza → EN).
3. Bulk + "Specifica giapponese": tutte le 5 email tradotte in JP.
4. Memoria: ricarica pagina → ultima scelta lingua ripristinata.

## Note operative
- Nessun cambiamento DB richiesto (lingua passa via payload).
- Nessuna nuova dipendenza npm.
- Editorial review (`journalistReview`) resta obbligatorio e ora intercetta drift di lingua.
- Il default rimane "Italiano" per non rompere flussi esistenti finché l'operatore non sceglie.