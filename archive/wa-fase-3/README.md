# WA Fase 3 — Backup pre quick-win latenza

Data: 2026-05-09
Versione manifest WhatsApp extension al momento del backup: 5.10.17

Snapshot dei file prima dell'intervento "quick win latenza WA":
- happy-path invio attuale: ~4.0s
- target post-patch: <1.5s su numero ripetuto, <2.5s su nuovo numero

## File salvati
- actions.js.bak               → public/whatsapp-extension/actions.js
- content.js.bak               → public/whatsapp-extension/content.js
- manifest.json.bak            → public/whatsapp-extension/manifest.json
- WhatsAppTest.tsx.bak         → src/components/test-extensions/WhatsAppTest.tsx
- whatsappExtensionZip.ts.bak  → src/lib/whatsappExtensionZip.ts

## Ripristino
```
cp archive/wa-fase-3/actions.js.bak public/whatsapp-extension/actions.js
cp archive/wa-fase-3/content.js.bak public/whatsapp-extension/content.js
cp archive/wa-fase-3/manifest.json.bak public/whatsapp-extension/manifest.json
cp archive/wa-fase-3/WhatsAppTest.tsx.bak src/components/test-extensions/WhatsAppTest.tsx
cp archive/wa-fase-3/whatsappExtensionZip.ts.bak src/lib/whatsappExtensionZip.ts
```
