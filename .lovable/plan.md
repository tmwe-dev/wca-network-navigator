

## Immagini per Firma e Piè di Pagina Email

### Stato attuale

La sezione "Profilo AI" in `AIProfileSettings.tsx` ha un campo **Firma Email (Signature)** testuale ma **nessun campo per caricare immagini** (logo firma, banner piè di pagina). Manca anche il supporto lato backend (storage + settings keys).

### Piano

#### 1. Aggiungere due campi immagine in `AIProfileSettings.tsx`

Nella card "Identità e Alias", sotto il blocco firma testuale, aggiungere:

- **Immagine Firma** (`ai_signature_image_url`): logo personale o aziendale inserito nella firma
- **Immagine Piè di Pagina** (`ai_footer_image_url`): banner/footer visibile in fondo a tutte le email

Ogni campo avrà:
- Anteprima dell'immagine caricata (se presente)
- Pulsante "Carica immagine" con input file
- Pulsante "Rimuovi" per cancellare
- Upload verso il bucket storage `templates` (già esistente)

#### 2. Aggiungere le chiavi ai settings salvati

- Aggiungere `"ai_signature_image_url"` e `"ai_footer_image_url"` all'array `AI_KEYS`
- Il salvataggio è automatico tramite il loop esistente su `AI_KEYS`

#### 3. Utilizzare le immagini nell'invio email

- Aggiornare `send-email/index.ts` per leggere `ai_signature_image_url` e `ai_footer_image_url` da `app_settings`
- Appendere automaticamente le immagini all'HTML prima dell'invio:
  - Signature image dopo il blocco firma testuale
  - Footer image come ultimo elemento dell'email

#### File coinvolti
- `src/components/settings/AIProfileSettings.tsx` — UI upload + anteprima
- `supabase/functions/send-email/index.ts` — inject immagini nell'HTML

