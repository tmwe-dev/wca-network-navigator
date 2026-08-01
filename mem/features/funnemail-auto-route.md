---
name: Funnemail Auto-Route
description: Edge funnemail-auto-route auto-instrada inbound nei gruppi mittente utente. Triggered fire-and-forget da classify-inbound-message dopo classificazione. Logica - skip se rule esiste, match dominio se gruppo già noto, altrimenti AI sceglie tra email_sender_groups con classification_hint. Soglie - 0.85 upsert email_address_rules (auto-route futuro), 0.60 solo ai_classification_suggestion in channel_messages, sotto skip. Modello google/gemini-3-flash-preview via LOVABLE_API_KEY. Fail-safe.
type: feature
---
