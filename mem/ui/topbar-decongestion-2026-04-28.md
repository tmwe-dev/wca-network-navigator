---
name: Top bar V2 decongestion 2026-04-28
description: Top bar ridotta da 17 a 6 elementi; backup vecchio header in LayoutHeader.bak.txt
type: design
---
Da 17 elementi a 6: ☰ Menu, StatusPill, slot campagne | 🔔 Notifiche, 👤 Operator, ⋯ Strumenti, ✨ AI.
Spostati in /v2/settings: VoiceLanguageSelector (tab Voce AI), AIAutomationToggle (tab AI).
Spostati in menu ⋯: Add Contact, Agent Ops, Enrichment, Trace Console, Test Ext, Tema.
Rimossi: pulsante "Cerca rapida" (resta ⌘K), pulsanti → CRM / → Network, badge Offline standalone.
File chiave: src/v2/ui/templates/header/StatusPill.tsx, HeaderToolsMenu.tsx, LayoutHeader.bak.txt (rollback).
