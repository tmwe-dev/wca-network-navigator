---
name: Comms Unified Page
description: /v2/comms guscio unico con 5 tab che montano Inbox/Email/WA/LinkedIn/Funnemail
type: feature
---
`src/v2/ui/pages/CommsPage.tsx` monta in 5 tab le pagine canale esistenti via lazy import:
- inbox → InreachPage
- email → EmailComposerPage
- whatsapp → RubricaWhatsAppPage
- linkedin → RubricaLinkedInPage
- smistamento → FunnemailInboxPage

Rotte `/v2/comms` e `/v2/comms/:tab`. I vecchi path restano attivi (no redirect). Pagine canale non modificate.