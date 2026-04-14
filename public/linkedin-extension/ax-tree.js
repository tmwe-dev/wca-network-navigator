// ══════════════════════════════════════════════════
// Accessibility Tree (AX Tree) Module for LinkedIn
// Uses Chrome DevTools Protocol to query semantic roles
// instead of fragile CSS selectors
// ══════════════════════════════════════════════════

const AXTree = (function () {
  // Attach debugger to tab, run query, detach
  async function withDebugger(tabId, fn) {
    try {
      await chrome.debugger.attach({ tabId: tabId }, "1.3");
    } catch (e) {
      if (/already attached/i.test(e.message)) {
        // Already attached, proceed
      } else {
        throw new Error("AX_ATTACH_FAILED: " + e.message);
      }
    }
    try {
      const result = await fn(tabId);
      return result;
    } finally {
      try { await chrome.debugger.detach({ tabId: tabId }); } catch (_) {}
    }
  }

  // Send a CDP command
  function cdp(tabId, method, params) {
    return chrome.debugger.sendCommand({ tabId: tabId }, method, params || {});
  }

  // Get the full accessibility tree
  async function getFullTree(tabId) {
    const result = await cdp(tabId, "Accessibility.getFullAXTree");
    return result.nodes || [];
  }

  // Find nodes by role and optional name pattern
  function findByRole(nodes, role, namePattern) {
    const matches = [];
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const nodeRole = n.role && n.role.value;
      if (nodeRole !== role) continue;
      if (namePattern) {
        const nodeName = n.name && n.name.value ? n.name.value : "";
        if (namePattern instanceof RegExp) {
          if (!namePattern.test(nodeName)) continue;
        } else {
          if (nodeName.toLowerCase().indexOf(namePattern.toLowerCase()) === -1) continue;
        }
      }
      matches.push(n);
    }
    return matches;
  }

  // Find a single node by role + name
  function findOne(nodes, role, namePattern) {
    const results = findByRole(nodes, role, namePattern);
    return results.length > 0 ? results[0] : null;
  }

  // Get the DOM nodeId for an AX node so we can interact with it
  async function getBackendNodeId(tabId, axNode) {
    if (!axNode || !axNode.backendDOMNodeId) return null;
    return axNode.backendDOMNodeId;
  }

  // Focus a DOM node by its backend node ID
  async function focusNode(tabId, backendNodeId) {
    await cdp(tabId, "DOM.focus", { backendNodeId: backendNodeId });
  }

  // Click a node using DOM.getBoxModel + Input.dispatchMouseEvent
  async function clickNode(tabId, backendNodeId) {
    try {
      // Resolve to a Runtime object to call click()
      const resolveResult = await cdp(tabId, "DOM.resolveNode", { backendNodeId: backendNodeId });
      if (resolveResult && resolveResult.object && resolveResult.object.objectId) {
        await cdp(tabId, "Runtime.callFunctionOn", {
          objectId: resolveResult.object.objectId,
          functionDeclaration: "function() { this.scrollIntoViewIfNeeded(); this.click(); }",
          arguments: [],
        });
        return true;
      }
    } catch (e) {
      // Fallback: try box model click
      try {
        const box = await cdp(tabId, "DOM.getBoxModel", { backendNodeId: backendNodeId });
        if (box && box.model && box.model.content) {
          const quad = box.model.content;
          const x = (quad[0] + quad[2] + quad[4] + quad[6]) / 4;
          const y = (quad[1] + quad[3] + quad[5] + quad[7]) / 4;
          await cdp(tabId, "Input.dispatchMouseEvent", { type: "mousePressed", x: x, y: y, button: "left", clickCount: 1 });
          await cdp(tabId, "Input.dispatchMouseEvent", { type: "mouseReleased", x: x, y: y, button: "left", clickCount: 1 });
          return true;
        }
      } catch (_) {}
    }
    return false;
  }

  // Type text into a focused element
  async function typeText(tabId, text) {
    for (let i = 0; i < text.length; i++) {
      await cdp(tabId, "Input.dispatchKeyEvent", {
        type: "keyDown",
        text: text[i],
        key: text[i],
        code: "Key" + text[i].toUpperCase(),
      });
      await cdp(tabId, "Input.dispatchKeyEvent", {
        type: "keyUp",
        key: text[i],
        code: "Key" + text[i].toUpperCase(),
      });
    }
  }

  // Insert text using Input.insertText (better for contenteditable)
  async function insertText(tabId, text) {
    await cdp(tabId, "Input.insertText", { text: text });
  }

  // Press Enter key
  async function pressEnter(tabId) {
    await cdp(tabId, "Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
    await cdp(tabId, "Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
  }

  // ── LinkedIn-specific high-level operations ──

  // Extract profile data using AX Tree (headings, text nodes)
  async function extractProfile(tabId) {
    return await withDebugger(tabId, async function (tid) {
      const nodes = await getFullTree(tid);

      const result = { name: null, headline: null, location: null, about: null, connectionStatus: "unknown" };

      // Name: first heading level 1
      const h1 = findOne(nodes, "heading");
      if (h1 && h1.name) result.name = h1.name.value;

      // Also search for more specific data using all StaticText nodes
      const textNodes = findByRole(nodes, "StaticText");

      // Try to find connection status buttons
      const connectBtn = findOne(nodes, "button", /connect|collegati|connetti/i);
      const messageBtn = findOne(nodes, "button", /messag|scrivi/i);
      const pendingBtn = findOne(nodes, "button", /pending|in attesa/i);

      if (pendingBtn) result.connectionStatus = "pending";
      else if (messageBtn && !connectBtn) result.connectionStatus = "connected";
      else if (connectBtn) result.connectionStatus = "not_connected";

      return result;
    });
  }

  // Find and click the Message button on a profile
  async function clickMessageButton(tabId) {
    return await withDebugger(tabId, async function (tid) {
      const nodes = await getFullTree(tid);
      // Look for button with "Message" or "Messaggio" in name
      let btn = findOne(nodes, "button", /^messag|^scrivi/i);
      if (!btn) {
        // Try link role
        btn = findOne(nodes, "link", /^messag|^scrivi/i);
      }
      if (!btn || !btn.backendDOMNodeId) return { success: false, error: "AX: Message button not found" };
      const clicked = await clickNode(tid, btn.backendDOMNodeId);
      return { success: clicked, method: "ax_tree" };
    });
  }

  // Find the message textbox and type into it
  async function typeMessage(tabId, text) {
    return await withDebugger(tabId, async function (tid) {
      let nodes = await getFullTree(tid);
      // Find textbox (contenteditable message input)
      let textbox = findOne(nodes, "textbox", /write a message|scrivi un messaggio/i);
      if (!textbox) textbox = findOne(nodes, "textbox");
      if (!textbox || !textbox.backendDOMNodeId) return { success: false, error: "AX: Message textbox not found" };

      await focusNode(tid, textbox.backendDOMNodeId);
      await new Promise(function (r) { setTimeout(r, 300); });
      await insertText(tid, text);

      // Find Send button
      let sendBtn = findOne(nodes, "button", /^send$|^invia$/i);
      if (!sendBtn) {
        // Re-fetch tree after typing (DOM may have changed)
        nodes = await getFullTree(tid);
        sendBtn = findOne(nodes, "button", /^send$|^invia$/i);
      }
      if (sendBtn && sendBtn.backendDOMNodeId) {
        await clickNode(tid, sendBtn.backendDOMNodeId);
        return { success: true, method: "ax_tree" };
      }
      return { success: false, error: "AX: Send button not found. Message typed but not sent." };
    });
  }

  // Click Connect button
  async function clickConnect(tabId) {
    return await withDebugger(tabId, async function (tid) {
      let nodes = await getFullTree(tid);
      let btn = findOne(nodes, "button", /^connect$|^collegati$|^connetti$/i);

      if (!btn) {
        // Try "More" / "Altro" dropdown first
        const moreBtn = findOne(nodes, "button", /^more$|^altro$|^più$/i);
        if (moreBtn && moreBtn.backendDOMNodeId) {
          await clickNode(tid, moreBtn.backendDOMNodeId);
          await new Promise(function (r) { setTimeout(r, 1200); });
          // Re-fetch tree
          nodes = await getFullTree(tid);
          btn = findOne(nodes, "menuitem", /connect|collegati|connetti/i)
            || findOne(nodes, "option", /connect|collegati|connetti/i)
            || findOne(nodes, "link", /connect|collegati|connetti/i);
        }
      }

      if (!btn || !btn.backendDOMNodeId) return { success: false, error: "AX: Connect button not found" };
      await clickNode(tid, btn.backendDOMNodeId);
      return { success: true, method: "ax_tree" };
    });
  }

  // Add connection note in modal
  async function addNote(tabId, noteText) {
    return await withDebugger(tabId, async function (tid) {
      let nodes = await getFullTree(tid);
      // Click "Add a note"
      const addNoteBtn = findOne(nodes, "button", /add a note|aggiungi nota|aggiungi un messaggio/i);
      if (!addNoteBtn || !addNoteBtn.backendDOMNodeId) return { success: false, error: "AX: Add Note button not found" };
      await clickNode(tid, addNoteBtn.backendDOMNodeId);
      await new Promise(function (r) { setTimeout(r, 1000); });

      // Find textarea
      nodes = await getFullTree(tid);
      const textarea = findOne(nodes, "textbox");
      if (!textarea || !textarea.backendDOMNodeId) return { success: false, error: "AX: Note textarea not found" };

      await focusNode(tid, textarea.backendDOMNodeId);
      await new Promise(function (r) { setTimeout(r, 300); });
      await insertText(tid, noteText);

      // Click Send
      await new Promise(function (r) { setTimeout(r, 500); });
      nodes = await getFullTree(tid);
      const sendBtn = findOne(nodes, "button", /^send$|^invia$/i);
      if (sendBtn && sendBtn.backendDOMNodeId) {
        await clickNode(tid, sendBtn.backendDOMNodeId);
        return { success: true, method: "ax_tree" };
      }
      return { success: false, error: "AX: Send button not found in note modal" };
    });
  }

  // Read inbox conversations using AX Tree
  async function readInbox(tabId) {
    return await withDebugger(tabId, async function (tid) {
      const nodes = await getFullTree(tid);
      const threads = [];
      const seen = {};

      // Strategy A: Find links containing /messaging/thread/
      const links = findByRole(nodes, "link");
      for (let i = 0; i < links.length; i++) {
        const link = links[i];
        const rawName = link.name && link.name.value ? link.name.value : "";
        if (!rawName || rawName.length < 2) continue;
        if (link.backendDOMNodeId) {
          try {
            const resolved = await cdp(tid, "DOM.resolveNode", { backendNodeId: link.backendDOMNodeId });
            if (resolved && resolved.object) {
              const hrefResult = await cdp(tid, "Runtime.callFunctionOn", {
                objectId: resolved.object.objectId,
                functionDeclaration: "function() { var h = this.href || ''; var name = ''; var h3 = this.querySelector('h3'); if (h3) name = h3.textContent.replace(/\\s+/g,' ').trim(); if (!name) { var spans = this.querySelectorAll('span'); for (var s=0;s<spans.length;s++) { var t = (spans[s].textContent||'').trim(); if (t.length>1 && t.length<60 && !/^\\d/.test(t) && !/^(passa|go to|details)/i.test(t)) { name = t; break; } } } if (!name) { var img = this.querySelector('img[alt]'); if (img) { var alt = (img.getAttribute('alt')||'').trim(); if (alt.length>1 && alt.length<60 && !/photo|foto|avatar/i.test(alt)) name = alt; } } return JSON.stringify({href:h, name:name}); }",
                returnByValue: true,
              });
              let parsed = null;
              try { parsed = JSON.parse(hrefResult && hrefResult.result && hrefResult.result.value); } catch (_) {}
              if (parsed && parsed.href && /\/messaging\/thread\//.test(parsed.href)) {
                if (seen[parsed.href]) continue;
                seen[parsed.href] = true;
                let contactName = parsed.name || rawName;
                if (/^(passa ai|go to|details|dettagli|conversation|conversazione)/i.test(contactName)) contactName = "";
                if (contactName) threads.push({ name: contactName, threadUrl: parsed.href, unread: false, lastMessage: "" });
              }
            }
          } catch (_) {}
        }
      }

      // Strategy B: Find listitem nodes that may represent conversations
      if (threads.length === 0) {
        const listItems = findByRole(nodes, "listitem");
        for (let li = 0; li < listItems.length; li++) {
          const item = listItems[li];
          if (!item.childIds || item.childIds.length === 0) continue;
          // Look for a link child with messaging href
          let threadUrl = "";
          let name = "";
          for (let c = 0; c < item.childIds.length; c++) {
            const childId = item.childIds[c];
            const child = nodes.find(function (n) { return n.nodeId === childId; });
            if (!child) continue;
            if (child.role && child.role.value === "link" && child.backendDOMNodeId) {
              try {
                const res2 = await cdp(tid, "DOM.resolveNode", { backendNodeId: child.backendDOMNodeId });
                if (res2 && res2.object) {
                  const hr = await cdp(tid, "Runtime.callFunctionOn", {
                    objectId: res2.object.objectId,
                    functionDeclaration: "function() { return this.href || ''; }",
                    returnByValue: true,
                  });
                  if (hr && hr.result && hr.result.value && /\/messaging\/thread\//.test(hr.result.value)) {
                    threadUrl = hr.result.value;
                  }
                }
              } catch (_) {}
              if (!name && child.name && child.name.value) {
                const cn = child.name.value.trim();
                if (cn.length > 1 && cn.length < 60 && !/^(passa|go to|details)/i.test(cn)) name = cn;
              }
            }
            if (!name && child.role && child.role.value === "StaticText" && child.name && child.name.value) {
              const sv = child.name.value.trim();
              if (sv.length > 1 && sv.length < 60 && !/^\d/.test(sv)) name = sv;
            }
          }
          if (name && threadUrl && !seen[threadUrl]) {
            seen[threadUrl] = true;
            threads.push({ name: name, threadUrl: threadUrl, unread: false, lastMessage: "" });
          }
        }
      }

      return { success: true, threads: threads, method: "ax_tree" };
    });
  }

  // Read thread messages using AX Tree
  async function readThread(tabId) {
    return await withDebugger(tabId, async function (tid) {
      const nodes = await getFullTree(tid);
      const messages = [];

      // Find all listitem or group nodes that contain message text
      const listItems = findByRole(nodes, "listitem");
      for (let i = 0; i < listItems.length; i++) {
        const item = listItems[i];
        if (!item.childIds || item.childIds.length === 0) continue;
        // Look for text children
        let text = "";
        let sender = "";
        for (let c = 0; c < item.childIds.length; c++) {
          const childId = item.childIds[c];
          const child = nodes.find(function (n) { return n.nodeId === childId; });
          if (child && child.role && child.role.value === "StaticText" && child.name && child.name.value) {
            const val = child.name.value.trim();
            if (val.length > 1 && val.length < 40 && !text) sender = val;
            else if (val.length > 0) text += val + " ";
          }
        }
        if (text.trim()) {
          messages.push({ text: text.trim(), sender: sender, direction: "inbound", timestamp: new Date().toISOString() });
        }
      }

      return { success: true, messages: messages, method: "ax_tree" };
    });
  }

  // Check if AX Tree (debugger) is available
  async function isAvailable(tabId) {
    try {
      await chrome.debugger.attach({ tabId: tabId }, "1.3");
      await chrome.debugger.detach({ tabId: tabId });
      return true;
    } catch (e) {
      return false;
    }
  }

  return {
    withDebugger: withDebugger,
    getFullTree: getFullTree,
    findByRole: findByRole,
    findOne: findOne,
    clickNode: clickNode,
    focusNode: focusNode,
    insertText: insertText,
    typeText: typeText,
    pressEnter: pressEnter,
    extractProfile: extractProfile,
    clickMessageButton: clickMessageButton,
    typeMessage: typeMessage,
    clickConnect: clickConnect,
    addNote: addNote,
    readInbox: readInbox,
    readThread: readThread,
    isAvailable: isAvailable,
  };
})();
