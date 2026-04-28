---
name: Content Normalization Layer
description: _shared/contentNormalizer.ts ripulisce email/scrape/OCR/inbound (HTML→text, quoted-replies, firme, OCR fixes, NFKC, whitespace) PRIMA di promptSanitizer e wrapUntrusted; helper normalizeSanitizeAndWrap per pipeline completa
type: feature
---
Layer aggiunto fra contenuti grezzi e prompt LLM.

Pipeline:
1. normalizeContent(raw, { source }) → unicode NFKC, html→text (preservando link), OCR fixes, strip quoted-replies (IT/EN/DE/FR/ES + From:/Sent:/...), strip signatures/disclaimers (-- , Sent from my iPhone, CONFIDENTIALITY), collapse whitespace, truncate (default 12k).
2. sanitizeForPrompt(normalized) → anti-injection (redact/block/log).
3. wrapUntrusted → fence non-trusted.

Sources supportati: email-inbound, email-history, email-html, web-scrape, ocr-business-card, ocr-document, linkedin-message, whatsapp-message, user-chat.

Default per source:
- email-* → strip quoted+signatures, html→text se email-html.
- ocr-* → fixOcr (0/O, 1/l, trattini a-capo, char ripetuti).
- web-scrape → htmlToText.

Helper one-shot: `normalizeSanitizeAndWrap(raw, label, source, { policy })`.

Adottato in:
- agent-execute/contextInjection.ts (email storiche dei clienti)
- classify-email-response/classificationPrompts.ts (body+subject)
- classify-inbound-message/index.ts (multichannel inbound)

Test: 13/13 verdi (`_shared/contentNormalizer.test.ts`).
Idempotente. Non rimuove dati business (email, telefoni, URL, importi).
