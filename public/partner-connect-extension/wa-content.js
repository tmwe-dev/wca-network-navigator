// ══════════════════════════════════════════════════════════
// Partner Connect — WhatsApp Web Content Script v3.4
// Runs on web.whatsapp.com
// Receives commands via chrome.runtime.onMessage (from background.js relay)
// ══════════════════════════════════════════════════════════

(function () {
  const HEARTBEAT_MS = 4000;
  let alive = true;
  let supabaseConfig = null;

  function isExtensionAlive() {
    try {
      if (!chrome || !chrome.runtime || !chrome.runtime.id) return false;
      void chrome.runtime.getManifest();
      return true;
    } catch (e) {
      return false;
    }
  }

  // ── DOM Helpers ──
  function querySafe(selector) {
    try { return document.querySelector(selector); } catch { return null; }
  }
  function queryAllSafe(selector) {
    try { return [...document.querySelectorAll(selector)]; } catch { return []; }
  }

  // ── Session Check ──
  function isLoggedIn() {
    const sidePanel = querySafe('[data-testid="chat-list"]') ||
                      querySafe('#pane-side') ||
                      querySafe('[aria-label*="Chat"]') ||
                      querySafe('div[data-tab="3"]');
    return !!sidePanel;
  }

  // ── Read Sidebar ──
  function readSidebar() {
    const messages = [];
    const chatItems = queryAllSafe('[data-testid="cell-frame-container"]');
    const fallbackItems = chatItems.length > 0 ? chatItems : queryAllSafe('#pane-side [role="listitem"]');
    const items = fallbackItems.length > 0 ? fallbackItems : queryAllSafe('#pane-side > div > div > div > div');

    for (const item of items) {
      try {
        const nameEl = item.querySelector('[data-testid="cell-frame-title"] span[title]') ||
                       item.querySelector('span[title][dir="auto"]');
        const contact = nameEl?.getAttribute('title') || nameEl?.textContent?.trim() || '';
        if (!contact) continue;

        const lastMsgEl = item.querySelector('[data-testid="last-msg-status"]') ||
                          item.querySelector('span[title][dir="ltr"]') ||
                          item.querySelector('span.matched-text') ||
                          item.querySelector('[data-testid="cell-frame-secondary"] span');
        const lastMessage = lastMsgEl?.textContent?.trim() || '';

        const timeEl = item.querySelector('[data-testid="cell-frame-primary-detail"]') ||
                       item.querySelector('div._ak8i');
        const time = timeEl?.textContent?.trim() || '';

        const unreadEl = item.querySelector('[data-testid="icon-unread-count"]') ||
                         item.querySelector('span[data-testid="icon-unread-count"]') ||
                         item.querySelector('span._ahlk');
        const unreadCount = unreadEl ? parseInt(unreadEl.textContent || '1', 10) : 0;

        messages.push({ contact, lastMessage, time, unreadCount, direction: 'inbound' });
      } catch (_) {}
    }
    return messages;
  }

  // ── Read Thread Messages ──
  function readThreadMessages(maxMessages) {
    const messages = [];
    const msgContainers = queryAllSafe('[data-testid="msg-container"]');
    const items = msgContainers.length > 0 ? msgContainers : queryAllSafe('.message-in, .message-out');
    const slice = items.slice(-maxMessages);

    for (const item of slice) {
      try {
        const isOut = item.classList.contains('message-out') ||
                      !!item.querySelector('[data-testid="msg-dblcheck"]') ||
                      !!item.querySelector('[data-testid="msg-check"]');

        const textEl = item.querySelector('[data-testid="balloon-text"] span') ||
                       item.querySelector('.selectable-text span') ||
                       item.querySelector('[dir="ltr"]');
        const text = textEl?.textContent?.trim() || '';

        const timeEl = item.querySelector('[data-testid="msg-meta"] span') ||
                       item.querySelector('.copyable-text [data-pre-plain-text]');
        const time = timeEl?.textContent?.trim() || '';
        const prePlain = item.querySelector('.copyable-text')?.getAttribute('data-pre-plain-text') || '';

        if (text || prePlain) {
          messages.push({
            text: text || prePlain.replace(/^\[.*?\]\s*.*?:\s*/, ''),
            time, direction: isOut ? 'outbound' : 'inbound', prePlain,
          });
        }
      } catch (_) {}
    }
    return messages;
  }

  // ── Open Chat ──
  async function openChat(contactName) {
    const searchBox = querySafe('[data-testid="chat-list-search"]') ||
                      querySafe('[contenteditable="true"][data-tab="3"]') ||
                      querySafe('#side [contenteditable="true"]');
    if (searchBox) {
      searchBox.focus();
      document.execCommand('selectAll', false, null);
      document.execCommand('delete', false, null);
      document.execCommand('insertText', false, contactName);
      await new Promise(r => setTimeout(r, 1500));
      const results = queryAllSafe('#pane-side [role="listitem"]');
      for (const r of results) {
        const title = r.querySelector('span[title]')?.getAttribute('title') || '';
        if (title.toLowerCase().includes(contactName.toLowerCase())) {
          r.click();
          await new Promise(r2 => setTimeout(r2, 800));
          return true;
        }
      }
    }
    return false;
  }

  // ── Send Message ──
  async function sendMessage(contactOrPhone, text) {
    // Try to find and open the contact's chat first
    const opened = await openChat(contactOrPhone);
    if (!opened) {
      // Fallback: try as phone number via URL
      const cleanPhone = contactOrPhone.replace(/[^0-9+]/g, '').replace(/^\+/, '');
      if (cleanPhone.length >= 6) {
        window.location.href = `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(text)}`;
        await new Promise(r => setTimeout(r, 3000));
      } else {
        return { success: false, error: 'Cannot find contact: ' + contactOrPhone };
      }
    }

    // Type the message
    const inputBox = querySafe('[data-testid="conversation-compose-box-input"]') ||
                     querySafe('#main [contenteditable="true"][data-tab="10"]') ||
                     querySafe('#main [contenteditable="true"]');
    if (inputBox && opened) {
      inputBox.focus();
      document.execCommand('insertText', false, text);
      await new Promise(r => setTimeout(r, 300));
    }

    // Click send
    const sendBtn = querySafe('[data-testid="send"]') ||
                    querySafe('[aria-label="Send"]') ||
                    querySafe('button [data-icon="send"]')?.closest('button');
    if (sendBtn) {
      sendBtn.click();
      return { success: true };
    }
    return { success: false, error: 'Send button not found' };
  }

  // ── AI Sidebar Scan ──
  async function readSidebarAI() {
    if (!supabaseConfig?.supabaseUrl) return readSidebar();
    const sidebarHtml = (querySafe('#pane-side') || querySafe('[data-testid="chat-list"]'))?.innerHTML || '';
    if (!sidebarHtml || sidebarHtml.length < 100) return readSidebar();
    const truncated = sidebarHtml.slice(0, 15000);
    try {
      const resp = await fetch(`${supabaseConfig.supabaseUrl}/functions/v1/extension-brain`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseConfig.authToken || supabaseConfig.anonKey}`,
          'apikey': supabaseConfig.anonKey,
        },
        body: JSON.stringify({
          action: 'extract-data', context: 'whatsapp-sidebar',
          prompt: 'Extract all visible chat conversations from this WhatsApp Web sidebar HTML. Return a JSON array where each item has: contact (string), lastMessage (string), time (string), unreadCount (number). Return ONLY the JSON array.',
          data: truncated,
        }),
      });
      if (!resp.ok) return readSidebar();
      const result = await resp.json();
      const raw = result.result || result.text || result.response || '';
      let parsed;
      try { parsed = typeof raw === 'object' ? raw : JSON.parse(raw); }
      catch { const m = (typeof raw === 'string' ? raw : '').match(/\[[\s\S]*\]/); parsed = m ? JSON.parse(m[0]) : null; }
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(m => ({ ...m, direction: 'inbound', method: 'ai' }));
      }
    } catch (_) {}
    return readSidebar();
  }

  // ── DOM Learning ──
  function captureDomSnapshot() {
    const snapshot = [];
    const elements = document.querySelectorAll('[data-testid], [role], [aria-label], #app *');
    const seen = new Set();
    let count = 0;
    for (const el of elements) {
      if (count >= 200) break;
      const tag = el.tagName.toLowerCase();
      const testId = el.getAttribute('data-testid') || '';
      const role = el.getAttribute('role') || '';
      const ariaLabel = el.getAttribute('aria-label') || '';
      const classes = el.className && typeof el.className === 'string' ? el.className.split(' ').slice(0, 5).join(' ') : '';
      const id = el.id || '';
      const sig = `${tag}|${testId}|${role}|${id}`;
      if (seen.has(sig)) continue;
      seen.add(sig);
      snapshot.push({ tag, id: id || undefined, testId: testId || undefined, role: role || undefined, ariaLabel: ariaLabel || undefined, classes: classes || undefined, childCount: el.children.length });
      count++;
    }
    return snapshot;
  }

  async function learnDomSelectors() {
    if (!supabaseConfig?.supabaseUrl || !supabaseConfig?.anonKey) {
      return { success: false, error: 'Supabase config not set' };
    }
    const domSnapshot = captureDomSnapshot();
    try {
      const resp = await fetch(`${supabaseConfig.supabaseUrl}/functions/v1/extension-brain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseConfig.authToken || supabaseConfig.anonKey}`, 'apikey': supabaseConfig.anonKey },
        body: JSON.stringify({ action: 'analyze-dom', context: 'whatsapp-web', prompt: 'Analyze this WhatsApp Web DOM snapshot and return a JSON object with CSS selectors for: sidebar, chatList, messageBubble, inputBox, sendButton, unreadBadge, contactName, lastMessage, timestamp, msgText, msgTime, msgOutgoing, searchBox. Return ONLY valid JSON.', data: domSnapshot }),
      });
      if (!resp.ok) return { success: false, error: `AI response ${resp.status}` };
      const result = await resp.json();
      let schema;
      const rawText = result.result || result.text || result.response || JSON.stringify(result);
      try { schema = typeof rawText === 'object' ? rawText : JSON.parse(rawText); }
      catch { const m = rawText.match(/```(?:json)?\s*([\s\S]*?)```/) || rawText.match(/\{[\s\S]*\}/); schema = m ? JSON.parse(m[1] || m[0]) : null; }
      if (!schema) return { success: false, error: 'Could not parse AI response' };
      return { success: true, schema };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // ── Command Handler ──
  async function handleCommand(action, payload) {
    switch (action) {
      case 'ping':
        return { success: true, version: '3.4.0', authenticated: isLoggedIn() };

      case 'setConfig':
        supabaseConfig = {
          supabaseUrl: payload.supabaseUrl,
          anonKey: payload.anonKey,
          authToken: payload.authToken,
        };
        return { success: true };

      case 'verifySession':
        return { success: true, authenticated: isLoggedIn(), reason: isLoggedIn() ? 'Session active' : 'Not logged in' };

      case 'readUnread': {
        let messages = readSidebar();
        if (messages.length < 2 && supabaseConfig?.supabaseUrl) {
          messages = await readSidebarAI();
        }
        return { success: true, messages, scanned: messages.length, method: messages[0]?.method || 'dom' };
      }

      case 'readThread': {
        const contact = payload.contact;
        const maxMessages = payload.maxMessages || 50;
        if (contact) await openChat(contact);
        const messages = readThreadMessages(maxMessages);
        return { success: true, messages, scanned: messages.length, contact };
      }

      case 'sendWhatsApp': {
        return await sendMessage(payload.phone || payload.contact, payload.text);
      }

      case 'learnDom':
        return await learnDomSelectors();

      default:
        return { success: false, error: `Unknown WA action: ${action}` };
    }
  }

  // ── Listen for commands from background.js (via chrome.runtime.onMessage) ──
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type !== 'wa-command') return false;
    handleCommand(msg.action, msg.payload || {})
      .then(sendResponse)
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // async response
  });

  // ── MutationObserver: watch sidebar for changes (event-driven, zero polling cost) ──
  let observer = null;
  let observerDebounce = null;
  let lastSidebarHash = '';

  function hashSidebar() {
    const items = queryAllSafe('[data-testid="cell-frame-container"]');
    if (!items.length) return '';
    let h = '';
    for (const item of items.slice(0, 20)) {
      const badge = item.querySelector('[data-testid="icon-unread-count"]');
      const lastMsg = item.querySelector('[data-testid="last-msg-status"]') ||
                      item.querySelector('[data-testid="cell-frame-secondary"] span');
      h += (badge?.textContent || '0') + '|' + (lastMsg?.textContent || '').slice(0, 30) + ';';
    }
    return h;
  }

  function startObserver() {
    if (observer) return;
    const sidebar = querySafe('#pane-side') || querySafe('[data-testid="chat-list"]');
    if (!sidebar) {
      // Retry in 5s if sidebar not yet loaded
      setTimeout(startObserver, 5000);
      return;
    }

    lastSidebarHash = hashSidebar();

    observer = new MutationObserver(() => {
      if (observerDebounce) clearTimeout(observerDebounce);
      observerDebounce = setTimeout(() => {
        const newHash = hashSidebar();
        if (newHash && newHash !== lastSidebarHash) {
          lastSidebarHash = newHash;
          // Notify background.js → webapp that sidebar changed
          try {
            chrome.runtime.sendMessage({
              type: 'wa-sidebar-changed',
              timestamp: Date.now(),
            });
          } catch (_) {}
        }
      }, 800); // debounce 800ms to avoid spam
    });

    observer.observe(sidebar, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    console.log('[WA Bridge] MutationObserver active on sidebar');
  }

  // Start observer when DOM is ready
  if (isLoggedIn()) {
    startObserver();
  } else {
    // Wait for login, check every 3s
    const loginCheck = setInterval(() => {
      if (isLoggedIn()) {
        clearInterval(loginCheck);
        startObserver();
      }
    }, 3000);
  }

  // ── Heartbeat ──
  setInterval(function () {
    const nowAlive = isExtensionAlive();
    if (!nowAlive && alive) {
      alive = false;
      console.warn('[WA Bridge] Extension context lost');
    } else if (nowAlive && !alive) {
      alive = true;
      console.info('[WA Bridge] Extension reconnected');
    }
  }, HEARTBEAT_MS);

  console.log('[WA Bridge] WhatsApp content script loaded — v3.5.0 (MutationObserver)');
})();
