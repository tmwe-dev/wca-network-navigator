

# Fix: WhatsApp reply from Inbox fails to find contact

## Root Cause

When you reply from the inbox, the system passes the **contact display name** (e.g., "Papa Ernesto") as the `phone` parameter to `sendWhatsApp`. The extension then:
1. Searches WhatsApp Web's search bar for that name
2. If no result title matches (case-sensitive `includes`), tries first name only
3. If still no match, checks for digits in the string — a name has none → "Contatto non trovato"

The fallback `extractPhoneFromThread` also fails because `raw_payload` only stores `{contact, lastMessage, unreadCount, time}` — no phone number or JID.

The cockpit works because it sends actual phone numbers from CRM data.

## Solution: Two changes

### 1. Extension: Check if chat is already open before searching (actions.js)

Before doing a search-bar lookup, inject a check that reads the **currently open chat header** in WhatsApp Web. If the header name matches the contact (case-insensitive, partial match), skip the search entirely and go straight to typing in the compose box.

This covers the main use case: the user is already viewing the chat in WhatsApp Web.

```text
sendWhatsApp flow (updated):
  1. Check current chat header → matches contact? → skip search, type directly
  2. Search bar lookup by full name
  3. Search bar lookup by first name only
  4. If has ≥5 digits → URL fallback
  5. Otherwise → "Contatto non trovato"
```

### 2. Inbox view: Improve name matching tolerance (WhatsAppInboxView.tsx)

Before calling `sendWhatsApp`, normalize the contact name:
- Trim whitespace
- Remove emoji and special Unicode characters that might interfere with search matching

This is a minor improvement but helps with contacts like "Polly 💃".

## Files to modify

- **`public/whatsapp-extension/actions.js`** — Add "current chat header check" at the start of the injected script, before the `openChat` call. Read the header from `[data-testid="conversation-info-header-chat-title"]` or `#main header span[title]`, compare with contact name (lowercase, trimmed). If match → proceed directly to compose box.

- **`src/components/outreach/WhatsAppInboxView.tsx`** — Normalize `activeTab` before passing to `sendWhatsApp`: strip emoji, trim. Minor change.

## Technical detail

The header check in the extension script (pseudocode):
```text
headerTitle = qsDeep('#main header span[title]')?.title
if headerTitle and headerTitle.toLowerCase().includes(contact.toLowerCase()):
  skip search, go straight to compose box
```

This is the most impactful fix because the user is typically already in the right chat on WhatsApp Web when replying from the inbox.

