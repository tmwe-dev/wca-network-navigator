// ══════════════════════════════════════════════════════════
// Partner Connect — WhatsApp Web Bridge Content Script
// Runs on web.whatsapp.com, bridges commands from webapp
// via background.js. Handles: ping, verifySession, setConfig,
// readUnread, readThread, sendWhatsApp, learnDom
// ══════════════════════════════════════════════════════════

(function () {
  const HEARTBEAT_MS = 4000;
  let alive = true;
  let supabaseConfig = null; // { supabaseUrl, anonKey, authToken }

  function isExtensionAlive() {
    try {
      if (!chrome || !chrome.runtime || !chrome.runtime.id) return false;
      void chrome.runtime.getManifest();
      return true;
    } catch (e) {
      return false;
    }
  }

  function post(payload) {
    try { window.postMessage(payload, window.location.origin); }
    catch (_) {}
  }

  function respond(action, requestId, response) {
    post({
      direction: "from-extension-wa",
      action,
      requestId,
      response,
    });
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
    // WhatsApp Web shows #app with specific elements when logged in
    const sidePanel = querySafe('[data-testid="chat-list"]') ||
                      querySafe('#pane-side') ||
                      querySafe('[aria-label*="Chat"]') ||
                      querySafe('div[data-tab="3"]');
    return !!sidePanel;
  }

  // ── Read Sidebar (Unread Messages) ──

  function readSidebar() {
    const messages = [];
    
    // Try multiple selector strategies
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
                       item.querySelector('div._ak8i') ||
                       item.querySelector('span[dir="auto"]:last-child');
        const time = timeEl?.textContent?.trim() || '';

        const unreadEl = item.querySelector('[data-testid="icon-unread-count"]') ||
                         item.querySelector('span[data-testid="icon-unread-count"]') ||
                         item.querySelector('.aumms1qt') || // unread badge class
                         item.querySelector('span._ahlk');
        const unreadCount = unreadEl ? parseInt(unreadEl.textContent || '1', 10) : 0;

        messages.push({
          contact,
          lastMessage,
          time,
          unreadCount,
          direction: 'inbound',
        });
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
            time,
            direction: isOut ? 'outbound' : 'inbound',
            prePlain,
          });
        }
      } catch (_) {}
    }

    return messages;
  }

  // ── Open a specific chat ──

  async function openChat(contactName) {
    // Click search
    const searchBtn = querySafe('[data-testid="chat-list-search"]') ||
                      querySafe('[data-icon="search"]') ||
                      querySafe('[title="Search input textbox"]');
    
    const searchBox = querySafe('[data-testid="chat-list-search"]') ||
                      querySafe('[contenteditable="true"][data-tab="3"]') ||
                      querySafe('#side [contenteditable="true"]');

    if (searchBox) {
      searchBox.focus();
      // Clear existing text
      document.execCommand('selectAll', false, null);
      document.execCommand('delete', false, null);
      // Type contact name
      document.execCommand('insertText', false, contactName);
      
      // Wait for search results
      await new Promise(r => setTimeout(r, 1500));

      // Click first matching result
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

  async function sendMessage(phone, text) {
    // Open chat via URL for phone numbers
    const cleanPhone = phone.replace(/[^0-9+]/g, '').replace(/^\+/, '');
    window.open(`https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(text)}`, '_self');
    
    await new Promise(r => setTimeout(r, 3000));

    // Click send button
    const sendBtn = querySafe('[data-testid="send"]') ||
                    querySafe('[aria-label="Send"]') ||
                    querySafe('button [data-icon="send"]')?.closest('button');
    
    if (sendBtn) {
      sendBtn.click();
      return { success: true };
    }
    return { success: false, error: 'Send button not found' };
  }

  // ── DOM Learning (AI-powered) ──

  async function learnDomSelectors() {
    if (!supabaseConfig?.supabaseUrl || !supabaseConfig?.anonKey) {
      return { success: false, error: 'Supabase config not set — call setConfig first' };
    }

    // Capture a snapshot of the visible DOM structure
    const domSnapshot = captureDomSnapshot();

    // Call the AI edge function to analyze
    try {
      const resp = await fetch(`${supabaseConfig.supabaseUrl}/functions/v1/extension-brain`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseConfig.authToken || supabaseConfig.anonKey}`,
          'apikey': supabaseConfig.anonKey,
        },
        body: JSON.stringify({
          action: 'analyze-dom',
          context: 'whatsapp-web',
          prompt: `Analyze this WhatsApp Web DOM snapshot and return a JSON object with CSS selectors for:
- sidebar: the main chat list panel
- chatList: individual chat items in the sidebar
- messageBubble: message containers in an open thread
- inputBox: the message input field
- sendButton: the send message button
- unreadBadge: unread message count badge
- contactName: contact/chat name in sidebar
- lastMessage: last message preview in sidebar
- timestamp: timestamp in sidebar
- msgText: text content within a message bubble
- msgTime: timestamp within a message bubble
- msgOutgoing: selector to identify outgoing messages
- searchBox: the search input field

Return ONLY valid JSON, no explanation. Each value should be a CSS selector string.`,
          data: domSnapshot,
        }),
      });

      if (!resp.ok) {
        return { success: false, error: `AI response ${resp.status}` };
      }

      const result = await resp.json();
      
      // Parse AI response — extract JSON from response
      let schema;
      const rawText = result.result || result.text || result.response || JSON.stringify(result);
      
      try {
        // Try direct parse
        schema = typeof rawText === 'object' ? rawText : JSON.parse(rawText);
      } catch {
        // Try extracting JSON from markdown code block
        const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/) ||
                          rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          schema = JSON.parse(jsonMatch[1] || jsonMatch[0]);
        } else {
          return { success: false, error: 'Could not parse AI response' };
        }
      }

      // Validate: schema should have at least some keys
      const requiredKeys = ['sidebar', 'chatList', 'messageBubble', 'inputBox'];
      const hasKeys = requiredKeys.filter(k => schema[k]);
      if (hasKeys.length < 2) {
        return { success: false, error: 'AI returned insufficient selectors' };
      }

      return { success: true, schema };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  function captureDomSnapshot() {
    // Capture structural info without full content (privacy-safe)
    const snapshot = [];
    const elements = document.querySelectorAll('[data-testid], [role], [aria-label], #app *');
    const seen = new Set();
    let count = 0;

    for (const el of elements) {
      if (count >= 200) break; // Limit to prevent huge payloads
      
      const tag = el.tagName.toLowerCase();
      const testId = el.getAttribute('data-testid') || '';
      const role = el.getAttribute('role') || '';
      const ariaLabel = el.getAttribute('aria-label') || '';
      const classes = el.className && typeof el.className === 'string' ? el.className.split(' ').slice(0, 5).join(' ') : '';
      const id = el.id || '';

      const sig = `${tag}|${testId}|${role}|${id}`;
      if (seen.has(sig)) continue;
      seen.add(sig);

      snapshot.push({
        tag,
        id: id || undefined,
        testId: testId || undefined,
        role: role || undefined,
        ariaLabel: ariaLabel || undefined,
        classes: classes || undefined,
        childCount: el.children.length,
      });
      count++;
    }

    return snapshot;
  }

  // ── AI-powered sidebar scan (fallback when DOM selectors fail) ──

  async function readSidebarAI() {
    if (!supabaseConfig?.supabaseUrl) return readSidebar(); // fallback to DOM

    const sidebarHtml = (querySafe('#pane-side') || querySafe('[data-testid="chat-list"]'))?.innerHTML || '';
    if (!sidebarHtml || sidebarHtml.length < 100) return readSidebar();

    // Truncate to avoid huge payloads
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
          action: 'extract-data',
          context: 'whatsapp-sidebar',
          prompt: `Extract all visible chat conversations from this WhatsApp Web sidebar HTML.
Return a JSON array where each item has: contact (string), lastMessage (string), time (string), unreadCount (number).
Return ONLY the JSON array, no explanation.`,
          data: truncated,
        }),
      });

      if (!resp.ok) return readSidebar();
      const result = await resp.json();
      const raw = result.result || result.text || result.response || '';
      
      let parsed;
      try {
        parsed = typeof raw === 'object' ? raw : JSON.parse(raw);
      } catch {
        const m = (typeof raw === 'string' ? raw : '').match(/\[[\s\S]*\]/);
        parsed = m ? JSON.parse(m[0]) : null;
      }

      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(m => ({ ...m, direction: 'inbound', method: 'ai' }));
      }
    } catch (_) {}

    return readSidebar(); // Final fallback
  }

  // ── Command Router ──

  async function handleCommand(data) {
    const { action, requestId } = data;

    switch (action) {
      case 'ping':
        respond(action, requestId, {
          success: true,
          version: '3.0-ai',
          authenticated: isLoggedIn(),
        });
        post({ direction: 'from-extension-wa', action: 'contentScriptReady' });
        return;

      case 'setConfig':
        supabaseConfig = {
          supabaseUrl: data.supabaseUrl,
          anonKey: data.anonKey,
          authToken: data.authToken,
        };
        respond(action, requestId, { success: true });
        return;

      case 'verifySession':
        respond(action, requestId, {
          success: true,
          authenticated: isLoggedIn(),
          reason: isLoggedIn() ? 'Session active' : 'Not logged in',
        });
        return;

      case 'readUnread': {
        let messages;
        // Try DOM first, if too few results try AI
        messages = readSidebar();
        if (messages.length < 2 && supabaseConfig?.supabaseUrl) {
          messages = await readSidebarAI();
        }
        respond(action, requestId, {
          success: true,
          messages,
          scanned: messages.length,
          method: messages[0]?.method || 'dom',
        });
        return;
      }

      case 'readThread': {
        const contact = data.contact;
        const maxMessages = data.maxMessages || 50;

        // If contact specified, try to open that chat
        if (contact) {
          await openChat(contact);
        }

        const messages = readThreadMessages(maxMessages);
        respond(action, requestId, {
          success: true,
          messages,
          scanned: messages.length,
          contact,
        });
        return;
      }

      case 'sendWhatsApp': {
        const result = await sendMessage(data.phone, data.text);
        respond(action, requestId, result);
        return;
      }

      case 'learnDom': {
        const result = await learnDomSelectors();
        respond(action, requestId, result);
        return;
      }

      default:
        respond(action, requestId, {
          success: false,
          error: `Unknown WA action: ${action}`,
        });
    }
  }

  // ── Message Listener ──

  window.addEventListener('message', function (event) {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.direction !== 'from-webapp-wa') return;
    handleCommand(data);
  });

  // ── Heartbeat ──

  setInterval(function () {
    const nowAlive = isExtensionAlive();
    if (nowAlive && !alive) {
      alive = true;
      post({ direction: 'from-extension-wa', action: 'contentScriptReady' });
      console.info('[WA Bridge] Extension reconnected');
    } else if (!nowAlive && alive) {
      alive = false;
      post({ direction: 'from-extension-wa', action: 'extensionDead' });
      console.warn('[WA Bridge] Extension context lost');
    }
  }, HEARTBEAT_MS);

  // ── Announce ──
  post({ direction: 'from-extension-wa', action: 'contentScriptReady' });
  console.log('[WA Bridge] WhatsApp content script loaded — v3.0-ai');
})();
