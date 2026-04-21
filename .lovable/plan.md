# LOVABLE-77B: Email Forge — filosofia "Editor Giornalista WCA"

## Cambio di paradigma
Non più "cita 1 fatto specifico" ma **"comprendi azienda + contesto, scegli UNA leva di interesse, scrivi come editor giornalista"**.

## Filosofia iniettata in ogni prompt
- WCA Network = più grande alleanza globale di freight forwarder indipendenti.
- Destinatario = partner trasporti = (a) fonte di guadagno reciproco + (b) beneficiario del **vantaggio first-mover**:
  primi su tariffe, primi su booking, primi a partire, primi su info di mercato.
- Ogni messaggio deve far PERCEPIRE questa filosofia, anche senza elencarla.

## Ruolo AI: EDITOR, non copywriter
1. LEGGI dossier (profilo, sito, Sherlock, history, BCA, network).
2. COSTRUISCI ritratto preciso (size, specializzazione, rotte, modalità).
3. SCEGLI UNA leva di interesse rilevante per LUI.
4. SCRIVI 80-150 parole, una idea forte, CTA leggera, mai bullet di feature, mai entusiasmo finto.

## File toccati
- `supabase/functions/generate-email/promptBuilder.ts` — system prompt riscritto + Strategic Advisor "metodo editor"
- `supabase/functions/improve-email/index.ts` — filosofia WCA + metodo editor su miglioramento bozze
- `supabase/functions/generate-outreach/promptBuilder.ts` — stessa filosofia su email/WA/LI
- Deploy: generate-email, improve-email, generate-outreach
